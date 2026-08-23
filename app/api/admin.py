from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models import User, DoctorProfile, PatientProfile, Appointment, NotificationLog, TriageLog
from app.schemas import AdminStatsOut, UserOut, DoctorProfileOut, NotificationLogOut
from app.auth import get_current_user, require_roles, get_password_hash

router = APIRouter(prefix="/api/admin", tags=["admin"])

class CreateDoctorRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    specialty: str
    qualification: str
    experience_years: int
    consultation_fee: float
    room_number: str
    working_start: str = "09:00"
    working_end: str = "17:00"

@router.get("/stats", response_model=AdminStatsOut)
def get_admin_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    total_patients = db.query(User).filter(User.role == "patient").count()
    total_doctors = db.query(User).filter(User.role == "doctor").count()
    total_appointments = db.query(Appointment).count()
    
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    today_appointments = db.query(Appointment).filter(Appointment.appointment_date == today_str).count()
    completed_appointments = db.query(Appointment).filter(Appointment.status == "completed").count()

    # Calculate revenue
    completed_appts = db.query(Appointment).filter(Appointment.status == "completed").all()
    revenue = sum(a.doctor.consultation_fee if a.doctor else 50.0 for a in completed_appts)

    # Urgency distribution
    urgency_counts = {
        "emergency": db.query(Appointment).filter(Appointment.triage_urgency == "emergency").count(),
        "high": db.query(Appointment).filter(Appointment.triage_urgency == "high").count(),
        "medium": db.query(Appointment).filter(Appointment.triage_urgency == "medium").count(),
        "low": db.query(Appointment).filter(Appointment.triage_urgency == "low").count()
    }

    return AdminStatsOut(
        total_patients=total_patients,
        total_doctors=total_doctors,
        total_appointments=total_appointments,
        today_appointments=today_appointments,
        completed_appointments=completed_appointments,
        urgency_distribution=urgency_counts,
        revenue_estimate=revenue
    )

@router.get("/users", response_model=List[UserOut])
def list_users(
    role: Optional[str] = Query(None, description="admin, doctor, patient"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    return query.order_by(User.created_at.desc()).all()

@router.post("/doctors", response_model=DoctorProfileOut)
def register_doctor_by_admin(
    payload: CreateDoctorRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    hashed = get_password_hash(payload.password)
    user = User(
        email=payload.email,
        hashed_password=hashed,
        full_name=payload.full_name,
        phone=payload.phone,
        role="doctor"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    doctor_profile = DoctorProfile(
        user_id=user.id,
        specialty=payload.specialty,
        qualification=payload.qualification,
        experience_years=payload.experience_years,
        consultation_fee=payload.consultation_fee,
        room_number=payload.room_number,
        working_start=payload.working_start,
        working_end=payload.working_end
    )
    db.add(doctor_profile)
    db.commit()
    db.refresh(doctor_profile)

    return DoctorProfileOut(
        id=doctor_profile.id,
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        specialty=doctor_profile.specialty,
        qualification=doctor_profile.qualification,
        experience_years=doctor_profile.experience_years,
        bio=doctor_profile.bio,
        consultation_fee=doctor_profile.consultation_fee,
        room_number=doctor_profile.room_number,
        working_start=doctor_profile.working_start,
        working_end=doctor_profile.working_end,
        slot_duration_minutes=doctor_profile.slot_duration_minutes
    )

@router.patch("/users/{user_id}/status")
def toggle_user_active_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Admin cannot deactivate self")

    user.is_active = not user.is_active
    db.commit()
    return {"message": f"User status set to {'active' if user.is_active else 'inactive'}", "is_active": user.is_active}

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from app.models import User, DoctorProfile, PatientProfile, Appointment, NotificationLog, TriageLog, DoctorLeave
from app.services.email_service import send_doctor_leave_cancellation_email

class DoctorLeaveRequest(BaseModel):
    leave_date: str  # YYYY-MM-DD
    reason: Optional[str] = "Medical / Professional Leave"

@router.post("/doctors/{doctor_id}/leave")
def mark_doctor_leave_by_admin(
    doctor_id: int,
    payload: DoctorLeaveRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """
    Marks a doctor on leave for a specific date, cancels all affected appointments,
    and dispatches asynchronous email notifications to patients.
    """
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    # Record Doctor Leave
    existing_leave = db.query(DoctorLeave).filter(
        DoctorLeave.doctor_id == doctor_id,
        DoctorLeave.leave_date == payload.leave_date
    ).first()

    if not existing_leave:
        doctor_leave = DoctorLeave(
            doctor_id=doctor_id,
            leave_date=payload.leave_date,
            reason=payload.reason
        )
        db.add(doctor_leave)
        db.commit()

    # Query all affected scheduled appointments
    affected_appointments = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == payload.leave_date,
        Appointment.status == "scheduled"
    ).all()

    cancelled_count = 0
    for appt in affected_appointments:
        cancelled_count += 1
        appt.status = "cancelled"
        appt.doctor_notes = f"Cancelled due to doctor leave: {payload.reason}"

        patient_user = appt.patient.user if appt.patient else None
        if patient_user:
            background_tasks.add_task(
                send_doctor_leave_cancellation_email,
                db=db,
                user_id=patient_user.id,
                patient_email=patient_user.email,
                patient_name=patient_user.full_name,
                doctor_name=doctor.user.full_name,
                date_str=payload.leave_date,
                reason=payload.reason
            )

    db.commit()

    return {
        "message": f"Doctor {doctor.user.full_name} marked on leave for {payload.leave_date}.",
        "affected_appointments_cancelled": cancelled_count
    }


@router.get("/logs", response_model=List[NotificationLogOut])
def get_notification_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Return the last 200 notification/audit log entries, newest first."""
    logs = db.query(NotificationLog).order_by(NotificationLog.sent_at.desc()).limit(200).all()
    return logs
