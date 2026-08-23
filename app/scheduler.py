import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from app.database import SessionLocal
from app.models import Appointment, MedicationReminder, SlotHold, User
from app.services.email_service import send_appointment_reminder_email, queue_email_notification, send_single_email

logger = logging.getLogger("scheduler")
scheduler = BackgroundScheduler()

def check_and_send_reminders():
    db = SessionLocal()
    try:
        tomorrow_str = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        upcoming = db.query(Appointment).filter(
            Appointment.appointment_date == tomorrow_str,
            Appointment.status == "scheduled"
        ).all()

        for appt in upcoming:
            patient_user = appt.patient.user
            doctor_user = appt.doctor.user
            send_appointment_reminder_email(
                db=db,
                user_id=patient_user.id,
                patient_email=patient_user.email,
                patient_name=patient_user.full_name,
                doctor_name=doctor_user.full_name,
                date_str=appt.appointment_date,
                time_str=appt.start_time
            )
    except Exception as e:
        logger.error(f"Error executing reminder job: {e}")
    finally:
        db.close()


def process_medication_reminders():
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        due_reminders = db.query(MedicationReminder).filter(
            MedicationReminder.is_active == True,
            MedicationReminder.next_reminder_at <= now
        ).all()

        for rem in due_reminders:
            patient_user = rem.patient.user
            subject = f"SwasthyaCare Medication Reminder: {rem.medication_name}"
            body = f"""
            <html>
              <body style="font-family: Arial, sans-serif; padding: 20px;">
                <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0;">
                  <h3 style="color: #0f766e;">💊 Scheduled Medication Reminder</h3>
                  <p>Namaste <strong>{patient_user.full_name}</strong>,</p>
                  <p>It is time to take your prescribed medication:</p>
                  <div style="background-color: #f0fdf4; padding: 15px; border-left: 4px solid #16a34a; border-radius: 6px;">
                    <p style="margin: 4px 0;"><strong>Medicine:</strong> {rem.medication_name}</p>
                    <p style="margin: 4px 0;"><strong>Dosage:</strong> {rem.dosage}</p>
                  </div>
                  <p style="font-size: 12px; color: #64748b; margin-top: 15px;">SwasthyaCare Digital Health Network India</p>
                </div>
              </body>
            </html>
            """
            queue_email_notification(db, patient_user.id, patient_user.email, subject, body)
            rem.next_reminder_at = now + timedelta(hours=rem.frequency_hours or 12)
            db.commit()
    except Exception as e:
        logger.error(f"Error processing medication reminders: {e}")
    finally:
        db.close()


def retry_failed_email_notifications():
    from app.services.email_service import process_email_retry_queue
    db = SessionLocal()
    try:
        process_email_retry_queue(db)
    except Exception as e:
        logger.error(f"Error in background email retry job: {e}")
    finally:
        db.close()


def purge_expired_slot_holds():
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        expired = db.query(SlotHold).filter(SlotHold.expires_at <= now).all()
        if expired:
            for hold in expired:
                db.delete(hold)
            db.commit()
    except Exception as e:
        logger.error(f"Error purging expired slot holds: {e}")
    finally:
        db.close()


def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(check_and_send_reminders, 'interval', hours=1, id="reminder_job", replace_existing=True)
        scheduler.add_job(process_medication_reminders, 'interval', minutes=5, id="med_reminder_job", replace_existing=True)
        scheduler.add_job(retry_failed_email_notifications, 'interval', minutes=2, id="email_retry_job", replace_existing=True)
        scheduler.add_job(purge_expired_slot_holds, 'interval', minutes=1, id="slot_hold_job", replace_existing=True)
        scheduler.start()


def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()
