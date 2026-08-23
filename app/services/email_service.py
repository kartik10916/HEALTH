import os
import smtplib
import logging
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from app.models import NotificationLog

logger = logging.getLogger("email_service")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")

def send_single_email(recipient_email: str, subject: str, body_html: str) -> (bool, str):
    """
    Attempts SMTP send. Returns (success_bool, error_message_or_empty).
    """
    if SMTP_USER and SMTP_PASS and not SMTP_USER.startswith("notifications@health"):
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SMTP_USER
            msg["To"] = recipient_email
            msg.attach(MIMEText(body_html, "html"))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASS)
                server.sendmail(SMTP_USER, recipient_email, msg.as_string())
            logger.info(f"SMTP Email successfully delivered to {recipient_email}")
            return True, ""
        except Exception as e:
            err_msg = f"SMTP error: {str(e)}"
            logger.error(f"Failed to deliver email to {recipient_email}: {err_msg}")
            return False, err_msg
    else:
        # Mock Email Console Logger for testing / unconfigured SMTP
        logger.info(f"[MOCK EMAIL DELIVERED] To: {recipient_email} | Subject: {subject}")
        return True, ""


def queue_email_notification(
    db: Session,
    user_id: int,
    recipient_email: str,
    subject: str,
    body_html: str,
    channel: str = "email",
    max_retries: int = 3
) -> NotificationLog:
    """
    Queues an email in the database notification_logs table for immediate/background sending.
    """
    log_entry = NotificationLog(
        user_id=user_id,
        channel=channel,
        recipient_email=recipient_email,
        title=subject,
        message=body_html[:300],
        body_html=body_html,
        status="pending",
        retry_count=0,
        max_retries=max_retries,
        error_message=None
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


def process_email_retry_queue(db: Session) -> int:
    """
    Background worker job for retrying failed or pending emails in the queue.
    Returns the number of processed emails.
    """
    pending_emails = db.query(NotificationLog).filter(
        NotificationLog.channel == "email",
        NotificationLog.status.in_(["pending", "failed"]),
        NotificationLog.retry_count < NotificationLog.max_retries
    ).limit(50).all()

    processed_count = 0
    for notif in pending_emails:
        processed_count += 1
        notif.retry_count += 1
        notif.last_attempt_at = datetime.utcnow()

        success, err = send_single_email(
            recipient_email=notif.recipient_email or "patient@health.com",
            subject=notif.title,
            body_html=notif.body_html or notif.message
        )

        if success:
            notif.status = "sent"
            notif.error_message = None
            notif.sent_at = datetime.utcnow()
            logger.info(f"Email ID #{notif.id} sent successfully on attempt {notif.retry_count}.")
        else:
            notif.status = "failed"
            notif.error_message = err
            logger.warning(f"Email ID #{notif.id} retry {notif.retry_count}/{notif.max_retries} failed: {err}")

        db.commit()

    return processed_count


def send_appointment_confirmation_email(db: Session, user_id: int, patient_email: str, patient_name: str, doctor_name: str, date_str: str, time_str: str, room: str, doctor_email: str = None):
    subject = f"SwasthyaCare Confirmation: Consultation with Dr. {doctor_name} on {date_str}"
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #0f172a; background-color: #f8fafc; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h2 style="color: #ea580c; margin-top: 0;">SwasthyaCare AI 🇮🇳 - Booking Confirmation</h2>
          <p>Namaste <strong>{patient_name}</strong>,</p>
          <p>Your doctor consultation has been successfully confirmed!</p>
          <div style="background-color: #fff7ed; padding: 16px; border-left: 4px solid #ea580c; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Specialist:</strong> Dr. {doctor_name}</p>
            <p style="margin: 4px 0;"><strong>Date & Time:</strong> {date_str} at {time_str} IST</p>
            <p style="margin: 4px 0;"><strong>Location / Department:</strong> {room}</p>
          </div>
          <p>Please carry any prior lab reports or prescription history. Emergency helpline: <strong>108 / 112</strong>.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="font-size: 12px; color: #64748b;">SwasthyaCare AI Telemedicine Network &bull; Digital Health India</p>
        </div>
      </body>
    </html>
    """
    notif = queue_email_notification(db, user_id, patient_email, subject, body)
    
    success, err = send_single_email(patient_email, subject, body)
    if success:
        notif.status = "sent"
        notif.sent_at = datetime.utcnow()
    else:
        notif.status = "failed"
        notif.error_message = err
    db.commit()

    if doctor_email:
        doc_subject = f"New Consultation Booked: {patient_name} on {date_str} at {time_str}"
        doc_body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #0f172a; background-color: #f8fafc; padding: 20px;">
            <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
              <h2 style="color: #0f766e; margin-top: 0;">New Appointment Alert</h2>
              <p>Dr. <strong>{doctor_name}</strong>,</p>
              <p>A new patient consultation has been scheduled:</p>
              <div style="background-color: #f0fdfa; padding: 16px; border-left: 4px solid #0f766e; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 4px 0;"><strong>Patient Name:</strong> {patient_name}</p>
                <p style="margin: 4px 0;"><strong>Patient Email:</strong> {patient_email}</p>
                <p style="margin: 4px 0;"><strong>Slot:</strong> {date_str} at {time_str} IST</p>
                <p style="margin: 4px 0;"><strong>Room:</strong> {room}</p>
              </div>
              <p>Log in to your Doctor Command Center to review pre-visit symptoms and clinical records.</p>
            </div>
          </body>
        </html>
        """
        send_single_email(doctor_email, doc_subject, doc_body)


def send_appointment_reminder_email(db: Session, user_id: int, patient_email: str, patient_name: str, doctor_name: str, date_str: str, time_str: str):
    subject = f"SwasthyaCare Reminder: Appointment with Dr. {doctor_name} Tomorrow at {time_str}"
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #0f172a; background-color: #f8fafc; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h2 style="color: #0f766e; margin-top: 0;">Appointment Reminder</h2>
          <p>Namaste <strong>{patient_name}</strong>,</p>
          <p>This is a reminder for your upcoming medical consultation tomorrow.</p>
          <p><strong>Doctor:</strong> Dr. {doctor_name}<br><strong>Date:</strong> {date_str} at {time_str} IST</p>
        </div>
      </body>
    </html>
    """
    queue_email_notification(db, user_id, patient_email, subject, body)


def send_doctor_leave_cancellation_email(db: Session, user_id: int, patient_email: str, patient_name: str, doctor_name: str, date_str: str, reason: str):
    subject = f"Urgent Notice: Doctor Leave Cancellation for Consultation on {date_str}"
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #0f172a; background-color: #f8fafc; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h2 style="color: #dc2626; margin-top: 0;">SwasthyaCare AI 🇮🇳 - Doctor Leave Notice</h2>
          <p>Namaste <strong>{patient_name}</strong>,</p>
          <p>We regret to inform you that <strong>Dr. {doctor_name}</strong> will be on official medical leave on <strong>{date_str}</strong> due to: <em>{reason or 'Unforeseen circumstances'}</em>.</p>
          <div style="background-color: #fef2f2; padding: 16px; border-left: 4px solid #dc2626; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Status:</strong> Consultation Cancelled (Full Refund / Reschedule Eligible)</p>
            <p style="margin: 4px 0;"><strong>Affected Date:</strong> {date_str}</p>
          </div>
          <p>Please log in to your patient portal to pick an alternate date or consult another available specialist.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
          <p style="font-size: 12px; color: #64748b;">SwasthyaCare AI Telemedicine Network &bull; Digital Health Mission India</p>
        </div>
      </body>
    </html>
    """
    notif = queue_email_notification(db, user_id, patient_email, subject, body)
    success, err = send_single_email(patient_email, subject, body)
    if success:
        notif.status = "sent"
        notif.sent_at = datetime.utcnow()
    else:
        notif.status = "failed"
        notif.error_message = err
    db.commit()

