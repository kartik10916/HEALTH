from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, PatientProfile, DoctorProfile, Appointment, TriageLog, SlotHold, DoctorLeave
from app.schemas import (
    TriageRequest, TriageResponse, RecommendedDoctorOut,
    DoctorProfileOut, TimeSlot, AppointmentCreate, AppointmentOut
)
from app.auth import get_current_user, require_roles, get_current_user_optional
from app.services.llm_service import analyze_symptoms_with_llm, generate_pre_visit_summary, generate_post_visit_summary
from app.services.email_service import send_appointment_confirmation_email
from app.services.calendar_service import generate_ics_calendar_event, sync_event_to_google_calendar, delete_google_calendar_event

router = APIRouter(prefix="/api/patient", tags=["patient"])

@router.post("/triage", response_model=TriageResponse)
def symptom_triage(
    payload: TriageRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    analysis_result = analyze_symptoms_with_llm(payload.symptoms, payload.age, payload.gender)
    specialty = analysis_result.get("inferred_specialty", "General Medicine & Ayush")
    
    patient_profile = None
    if current_user:
        patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    
    try:
        triage_log = TriageLog(
            patient_id=patient_profile.id if patient_profile else None,
            symptoms_text=payload.symptoms,
            ai_recommendation=analysis_result.get("guidance", ""),
            inferred_specialty=specialty,
            risk_level=analysis_result.get("urgency", "Low")
        )
        db.add(triage_log)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Notice: Triage log commit skipped: {e}")

    matched_doctors = []
    try:
        matched_doctors = db.query(DoctorProfile).filter(
            DoctorProfile.specialty.ilike(f"%{specialty}%")
        ).all()
        
        if not matched_doctors:
            matched_doctors = db.query(DoctorProfile).all()
    except Exception as e:
        print(f"Doctor query notice: {e}")

    doctor_list = []
    for doc in matched_doctors[:5]:
        doctor_list.append(RecommendedDoctorOut(
            id=doc.id,
            full_name=doc.user.full_name,
            specialty=doc.specialty,
            consultation_fee=doc.consultation_fee,
            experience_years=doc.experience_years,
            room_number=doc.room_number
        ))

    return TriageResponse(
        urgency=analysis_result.get("urgency", "Low"),
        urgency_badge_color=analysis_result.get("urgency_badge_color", "emerald"),
        inferred_specialty=specialty,
        ai_analysis=analysis_result.get("ai_analysis", ""),
        guidance=analysis_result.get("guidance", ""),
        recommended_doctors=doctor_list
    )


@router.get("/doctors", response_model=List[DoctorProfileOut])
def list_doctors(
    specialty: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(DoctorProfile)
    if specialty and specialty.strip() and specialty != "All":
        query = query.filter(DoctorProfile.specialty.ilike(f"%{specialty}%"))
    
    doctors = query.all()
    
    if search and search.strip():
        search_lower = search.lower()
        doctors = [
            d for d in doctors 
            if search_lower in d.user.full_name.lower() or search_lower in d.specialty.lower()
        ]

    result = []
    for d in doctors:
        result.append(DoctorProfileOut(
            id=d.id,
            user_id=d.user_id,
            full_name=d.user.full_name,
            email=d.user.email,
            phone=d.user.phone,
            specialty=d.specialty,
            qualification=d.qualification,
            experience_years=d.experience_years,
            bio=d.bio,
            consultation_fee=d.consultation_fee,
            room_number=d.room_number,
            working_start=d.working_start,
            working_end=d.working_end,
            slot_duration_minutes=d.slot_duration_minutes
        ))
    return result


@router.get("/doctors/{doctor_id}/slots", response_model=List[TimeSlot])
def get_available_slots(
    doctor_id: int,
    date: str = Query(..., description="YYYY-MM-DD format"),
    db: Session = Depends(get_db)
):
    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    on_leave = db.query(DoctorLeave).filter(
        DoctorLeave.doctor_id == doctor_id,
        DoctorLeave.leave_date == date
    ).first()
    if on_leave:
        return []

    existing_appointments = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == date,
        Appointment.status != "cancelled"
    ).all()
    booked_start_times = set(a.start_time for a in existing_appointments)

    now = datetime.utcnow()
    active_holds = db.query(SlotHold).filter(
        SlotHold.doctor_id == doctor_id,
        SlotHold.appointment_date == date,
        SlotHold.expires_at > now
    ).all()
    held_start_times = set(h.start_time for h in active_holds)

    try:
        start_dt = datetime.strptime(doctor.working_start, "%H:%M")
        end_dt = datetime.strptime(doctor.working_end, "%H:%M")
    except Exception:
        start_dt = datetime.strptime("09:00", "%H:%M")
        end_dt = datetime.strptime("17:00", "%H:%M")

    step = timedelta(minutes=doctor.slot_duration_minutes or 30)
    current = start_dt
    slots = []

    while current + step <= end_dt:
        start_str = current.strftime("%H:%M")
        end_str = (current + step).strftime("%H:%M")
        is_available = (start_str not in booked_start_times) and (start_str not in held_start_times)
        slots.append(TimeSlot(
            start_time=start_str,
            end_time=end_str,
            is_available=is_available
        ))
        current += step

    return slots


@router.post("/doctors/{doctor_id}/hold-slot")
def reserve_temporary_slot_hold(
    doctor_id: int,
    appointment_date: str = Query(...),
    start_time: str = Query(...),
    end_time: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["patient", "admin"]))
):
    patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not patient_profile:
        patient_profile = PatientProfile(user_id=current_user.id)
        db.add(patient_profile)
        db.commit()
        db.refresh(patient_profile)

    on_leave = db.query(DoctorLeave).filter(
        DoctorLeave.doctor_id == doctor_id,
        DoctorLeave.leave_date == appointment_date
    ).first()
    if on_leave:
        raise HTTPException(status_code=400, detail="Doctor is on leave on this date.")

    booked = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appointment_date,
        Appointment.start_time == start_time,
        Appointment.status != "cancelled"
    ).first()
    if booked:
        raise HTTPException(status_code=400, detail="This slot has already been booked by another patient.")

    now = datetime.utcnow()
    existing_hold = db.query(SlotHold).filter(
        SlotHold.doctor_id == doctor_id,
        SlotHold.appointment_date == appointment_date,
        SlotHold.start_time == start_time,
        SlotHold.expires_at > now,
        SlotHold.patient_id != patient_profile.id
    ).first()
    if existing_hold:
        raise HTTPException(status_code=400, detail="This slot is temporarily reserved by another patient. Try again in a few minutes.")

    expires_at = now + timedelta(minutes=10)
    user_hold = db.query(SlotHold).filter(
        SlotHold.doctor_id == doctor_id,
        SlotHold.patient_id == patient_profile.id,
        SlotHold.appointment_date == appointment_date,
        SlotHold.start_time == start_time
    ).first()

    if user_hold:
        user_hold.expires_at = expires_at
    else:
        user_hold = SlotHold(
            doctor_id=doctor_id,
            patient_id=patient_profile.id,
            appointment_date=appointment_date,
            start_time=start_time,
            end_time=end_time,
            expires_at=expires_at
        )
        db.add(user_hold)

    db.commit()
    return {"message": "Slot temporarily reserved for 10 minutes", "expires_at": expires_at.isoformat()}


@router.post("/appointments", response_model=AppointmentOut)
def book_appointment(
    payload: AppointmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["patient", "admin"]))
):
    patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not patient_profile:
        patient_profile = PatientProfile(user_id=current_user.id)
        db.add(patient_profile)
        db.commit()
        db.refresh(patient_profile)

    doctor = db.query(DoctorProfile).filter(DoctorProfile.id == payload.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    existing = db.query(Appointment).filter(
        Appointment.doctor_id == payload.doctor_id,
        Appointment.appointment_date == payload.appointment_date,
        Appointment.start_time == payload.start_time,
        Appointment.status != "cancelled"
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="This time slot has already been booked. Please choose another slot.")

    pre_summary_text = generate_pre_visit_summary(payload.symptom_summary or "General consultation")

    appointment = Appointment(
        patient_id=patient_profile.id,
        doctor_id=doctor.id,
        appointment_date=payload.appointment_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status="scheduled",
        symptom_summary=payload.symptom_summary,
        triage_urgency=payload.triage_urgency or "Low",
        pre_visit_summary=pre_summary_text
    )
    db.add(appointment)

    user_hold = db.query(SlotHold).filter(
        SlotHold.doctor_id == doctor.id,
        SlotHold.patient_id == patient_profile.id,
        SlotHold.appointment_date == payload.appointment_date,
        SlotHold.start_time == payload.start_time
    ).first()
    if user_hold:
        db.delete(user_hold)

    db.commit()
    db.refresh(appointment)

    background_tasks.add_task(
        send_appointment_confirmation_email,
        db=db,
        user_id=current_user.id,
        patient_email=current_user.email,
        patient_name=current_user.full_name,
        doctor_name=doctor.user.full_name,
        date_str=payload.appointment_date,
        time_str=payload.start_time,
        room=doctor.room_number
    )

    background_tasks.add_task(
        sync_event_to_google_calendar,
        summary=f"SwasthyaCare Consultation: Dr. {doctor.user.full_name} with {current_user.full_name}",
        description=f"Specialty: {doctor.specialty}. Symptoms: {payload.symptom_summary or 'General consultation'}",
        date_str=payload.appointment_date,
        start_time_str=payload.start_time,
        end_time_str=payload.end_time,
        location=f"Room {doctor.room_number}, SwasthyaCare Super Specialty Clinic",
        attendee_email=current_user.email
    )

    return AppointmentOut(
        id=appointment.id,
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        appointment_date=appointment.appointment_date,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        status=appointment.status,
        symptom_summary=appointment.symptom_summary,
        triage_urgency=appointment.triage_urgency,
        doctor_notes=appointment.doctor_notes,
        prescription=appointment.prescription,
        created_at=appointment.created_at,
        patient_name=current_user.full_name,
        doctor_name=doctor.user.full_name,
        specialty=doctor.specialty,
        consultation_fee=doctor.consultation_fee
    )


@router.get("/appointments", response_model=List[AppointmentOut])
def get_patient_appointments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["patient", "admin"]))
):
    patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not patient_profile:
        return []

    appointments = db.query(Appointment).filter(
        Appointment.patient_id == patient_profile.id
    ).order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc()).all()

    result = []
    for appt in appointments:
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
            patient_name=current_user.full_name,
            doctor_name=appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Dr. Unknown",
            specialty=appt.doctor.specialty if appt.doctor else "General Medicine",
            consultation_fee=appt.doctor.consultation_fee if appt.doctor else 800.0
        ))
    return result


@router.delete("/appointments/{appointment_id}")
def cancel_appointment(
    appointment_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["patient", "admin"]))
):
    patient_profile = db.query(PatientProfile).filter(PatientProfile.user_id == current_user.id).first()
    if not patient_profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.patient_id == patient_profile.id
    ).first()

    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt.status = "cancelled"
    db.commit()

    if appt.google_event_id:
        background_tasks.add_task(delete_google_calendar_event, appt.google_event_id)

    return {"message": "Appointment cancelled successfully"}


@router.get("/appointments/{appointment_id}/ics")
def download_ics(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["patient", "doctor", "admin"]))
):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Doctor"
    patient_name = appt.patient.user.full_name if appt.patient and appt.patient.user else "Patient"

    ics_data = generate_ics_calendar_event(
        summary=f"Medical Consultation: Dr. {doctor_name} with {patient_name}",
        description=f"Specialty: {appt.doctor.specialty if appt.doctor else 'Medicine'}. Symptoms: {appt.symptom_summary or 'Routine checkup'}",
        date_str=appt.appointment_date,
        start_time_str=appt.start_time,
        end_time_str=appt.end_time,
        location=f"Room {appt.doctor.room_number if appt.doctor else '101'}, SwasthyaCare Clinic"
    )

    filename = f"appointment_{appt.appointment_date}_{appt.start_time.replace(':', '')}.ics"
    return Response(content=ics_data, media_type="text/calendar", headers={
        "Content-Disposition": f"attachment; filename={filename}"
    })


@router.get("/appointments/{appointment_id}/summary")
def get_patient_visit_summary(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["patient", "doctor", "admin"]))
):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if appt.post_visit_summary:
        return {"summary": appt.post_visit_summary}

    doctor_name = appt.doctor.user.full_name if appt.doctor and appt.doctor.user else "Consultant Specialist"
    summary_text = generate_post_visit_summary(
        doctor_notes=appt.doctor_notes or "",
        prescription=appt.prescription or ""
    )
    appt.post_visit_summary = summary_text
    db.commit()

    return {"summary": summary_text}
