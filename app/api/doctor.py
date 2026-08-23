from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, DoctorProfile, Appointment, DoctorLeave, MedicationReminder
from app.schemas import DoctorProfileOut, DoctorProfileUpdate, AppointmentOut, AppointmentUpdate
from app.auth import get_current_user, require_roles
from app.services.llm_service import generate_post_visit_summary, generate_pre_visit_summary
from app.services.email_service import send_doctor_leave_cancellation_email

router = APIRouter(prefix="/api/doctor", tags=["doctor"])

class DoctorSelfLeaveRequest(BaseModel):
    leave_date: str
    reason: Optional[str] = "Personal / Emergency Leave"

@router.get("/profile", response_model=DoctorProfileOut)
def get_doctor_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    return DoctorProfileOut(
        id=doctor.id,
        user_id=doctor.user_id,
        full_name=current_user.full_name,
        email=current_user.email,
        phone=current_user.phone,
        specialty=doctor.specialty,
        qualification=doctor.qualification,
        experience_years=doctor.experience_years,
        bio=doctor.bio,
        consultation_fee=doctor.consultation_fee,
        room_number=doctor.room_number,
        working_start=doctor.working_start,
        working_end=doctor.working_end,
        slot_duration_minutes=doctor.slot_duration_minutes
    )

@router.put("/profile", response_model=DoctorProfileOut)
def update_doctor_profile(
    payload: DoctorProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    if payload.specialty is not None:
        doctor.specialty = payload.specialty
    if payload.qualification is not None:
        doctor.qualification = payload.qualification
    if payload.experience_years is not None:
        doctor.experience_years = payload.experience_years
    if payload.bio is not None:
        doctor.bio = payload.bio
    if payload.consultation_fee is not None:
        doctor.consultation_fee = payload.consultation_fee
    if payload.room_number is not None:
        doctor.room_number = payload.room_number
    if payload.working_start is not None:
        doctor.working_start = payload.working_start
    if payload.working_end is not None:
        doctor.working_end = payload.working_end
    if payload.slot_duration_minutes is not None:
        doctor.slot_duration_minutes = payload.slot_duration_minutes

    db.commit()
    db.refresh(doctor)

    return DoctorProfileOut(
        id=doctor.id,
        user_id=doctor.user_id,
        full_name=current_user.full_name,
        email=current_user.email,
        phone=current_user.phone,
        specialty=doctor.specialty,
        qualification=doctor.qualification,
        experience_years=doctor.experience_years,
        bio=doctor.bio,
        consultation_fee=doctor.consultation_fee,
        room_number=doctor.room_number,
        working_start=doctor.working_start,
        working_end=doctor.working_end,
        slot_duration_minutes=doctor.slot_duration_minutes
    )

@router.get("/appointments", response_model=List[AppointmentOut])
def list_doctor_appointments(
    date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor:
        return []

    query = db.query(Appointment).filter(Appointment.doctor_id == doctor.id)

    if date:
        query = query.filter(Appointment.appointment_date == date)
    if status:
        query = query.filter(Appointment.status == status)

    appointments = query.order_by(Appointment.appointment_date.desc(), Appointment.start_time.asc()).all()

    result = []
    for appt in appointments:
        patient_user = appt.patient.user if appt.patient else None
        result.append(AppointmentOut(
            id=appt.id,
            patient_id=appt.patient_id,
            doctor_id=appt.doctor_id,
            appointment_date=appt.appointment_date,
            start_time=appt.start_time,
            end_time=appt.end_time,
            status=appt.status,
            symptom_summary=appt.symptom_summary,
            triage_urgency=appt.triage_urgency,
            doctor_notes=appt.doctor_notes,
            prescription=appt.prescription,
            created_at=appt.created_at,
            patient_name=patient_user.full_name if patient_user else "Patient",
            doctor_name=current_user.full_name,
            specialty=doctor.specialty,
            consultation_fee=doctor.consultation_fee
        ))
    return result

@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
def update_appointment_details(
    appointment_id: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if payload.status:
        appt.status = payload.status
    if payload.doctor_notes is not None:
        appt.doctor_notes = payload.doctor_notes
    if payload.prescription is not None:
        appt.prescription = payload.prescription

    if payload.doctor_notes or payload.prescription:
        post_summary = generate_post_visit_summary(payload.doctor_notes or appt.doctor_notes or "", payload.prescription or appt.prescription or "")
        appt.post_visit_summary = post_summary

        if payload.prescription and appt.patient:
            rem = MedicationReminder(
                patient_id=appt.patient_id,
                appointment_id=appt.id,
                medication_name=f"Prescription for Appointment #{appt.id}",
                dosage=payload.prescription[:80],
                frequency_hours=12,
                next_reminder_at=datetime.utcnow() + timedelta(hours=12)
            )
            db.add(rem)

    db.commit()
    db.refresh(appt)

    patient_user = appt.patient.user if appt.patient else None
    return AppointmentOut(
        id=appt.id,
        patient_id=appt.patient_id,
        doctor_id=appt.doctor_id,
        appointment_date=appt.appointment_date,
        start_time=appt.start_time,
        end_time=appt.end_time,
        status=appt.status,
        symptom_summary=appt.symptom_summary,
        triage_urgency=appt.triage_urgency,
        doctor_notes=appt.doctor_notes,
        prescription=appt.prescription,
        created_at=appt.created_at,
        patient_name=patient_user.full_name if patient_user else "Patient",
        doctor_name=appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Doctor",
        specialty=appt.doctor.specialty if appt.doctor else "General Medicine",
        consultation_fee=appt.doctor.consultation_fee if appt.doctor else 800.0
    )


@router.get("/appointments/{appointment_id}/pre-visit-summary")
def get_doctor_pre_visit_summary(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if not appt.pre_visit_summary:
        summary_text = generate_pre_visit_summary(appt.symptom_summary or "General consultation")
        appt.pre_visit_summary = summary_text
        db.commit()

    return {"summary": appt.pre_visit_summary}


@router.post("/leave")
def doctor_self_mark_leave(
    payload: DoctorSelfLeaveRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["doctor", "admin"]))
):
    doctor = db.query(DoctorProfile).filter(DoctorProfile.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")

    existing_leave = db.query(DoctorLeave).filter(
        DoctorLeave.doctor_id == doctor.id,
        DoctorLeave.leave_date == payload.leave_date
    ).first()

    if not existing_leave:
        doctor_leave = DoctorLeave(
            doctor_id=doctor.id,
            leave_date=payload.leave_date,
            reason=payload.reason
        )
        db.add(doctor_leave)
        db.commit()

    affected_appointments = db.query(Appointment).filter(
        Appointment.doctor_id == doctor.id,
        Appointment.appointment_date == payload.leave_date,
        Appointment.status == "scheduled"
    ).all()

    cancelled_count = 0
    for appt in affected_appointments:
        cancelled_count += 1
        appt.status = "cancelled"
        appt.doctor_notes = f"Cancelled due to physician leave: {payload.reason}"

        patient_user = appt.patient.user if appt.patient else None
        if patient_user:
            background_tasks.add_task(
                send_doctor_leave_cancellation_email,
                db=db,
                user_id=patient_user.id,
                patient_email=patient_user.email,
                patient_name=patient_user.full_name,
                doctor_name=current_user.full_name,
                date_str=payload.leave_date,
                reason=payload.reason
            )

    db.commit()

    return {
        "message": f"You are marked on leave for {payload.leave_date}.",
        "affected_appointments_cancelled": cancelled_count
    }
