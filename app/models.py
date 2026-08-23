import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    google_id = Column(String(255), unique=True, index=True, nullable=True)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    role = Column(String(20), nullable=False, default="patient")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    doctor_profile = relationship("DoctorProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    patient_profile = relationship("PatientProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("NotificationLog", back_populates="user", cascade="all, delete-orphan")


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    specialty = Column(String(100), index=True, nullable=False)
    qualification = Column(String(255), nullable=False, default="MBBS, MD (AIIMS)")
    experience_years = Column(Integer, default=5)
    bio = Column(Text, nullable=True)
    consultation_fee = Column(Float, default=800.0)
    room_number = Column(String(100), default="Room 101 (Main Block)")
    working_start = Column(String(10), default="09:00")
    working_end = Column(String(10), default="17:00")
    slot_duration_minutes = Column(Integer, default=30)
    avatar_url = Column(String(255), nullable=True)

    user = relationship("User", back_populates="doctor_profile")
    appointments = relationship("Appointment", back_populates="doctor", cascade="all, delete-orphan")
    leaves = relationship("DoctorLeave", back_populates="doctor", cascade="all, delete-orphan")


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    abha_id = Column(String(50), nullable=True, index=True)
    date_of_birth = Column(String(20), nullable=True)
    gender = Column(String(20), nullable=True)
    blood_group = Column(String(10), nullable=True)
    medical_history = Column(Text, nullable=True)
    emergency_contact = Column(String(100), nullable=True)

    user = relationship("User", back_populates="patient_profile")
    appointments = relationship("Appointment", back_populates="patient", cascade="all, delete-orphan")
    triage_logs = relationship("TriageLog", back_populates="patient", cascade="all, delete-orphan")
    slot_holds = relationship("SlotHold", back_populates="patient", cascade="all, delete-orphan")
    medication_reminders = relationship("MedicationReminder", back_populates="patient", cascade="all, delete-orphan")


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        UniqueConstraint('doctor_id', 'appointment_date', 'start_time', name='uix_doctor_schedule_slot'),
    )

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    appointment_date = Column(String(20), nullable=False, index=True)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    status = Column(String(20), default="scheduled", index=True)
    symptom_summary = Column(Text, nullable=True)
    triage_urgency = Column(String(20), default="low")
    pre_visit_summary = Column(Text, nullable=True)
    post_visit_summary = Column(Text, nullable=True)
    doctor_notes = Column(Text, nullable=True)
    prescription = Column(Text, nullable=True)
    google_event_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("PatientProfile", back_populates="appointments")
    doctor = relationship("DoctorProfile", back_populates="appointments")
    reminders = relationship("MedicationReminder", back_populates="appointment", cascade="all, delete-orphan")


class SlotHold(Base):
    __tablename__ = "slot_holds"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id"), nullable=False)
    appointment_date = Column(String(20), nullable=False, index=True)
    start_time = Column(String(10), nullable=False)
    end_time = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("PatientProfile", back_populates="slot_holds")


class DoctorLeave(Base):
    __tablename__ = "doctor_leaves"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    leave_date = Column(String(20), nullable=False, index=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    doctor = relationship("DoctorProfile", back_populates="leaves")


class MedicationReminder(Base):
    __tablename__ = "medication_reminders"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False)
    medication_name = Column(String(255), nullable=False)
    dosage = Column(String(100), nullable=False)
    frequency_hours = Column(Integer, default=12)
    next_reminder_at = Column(DateTime, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("PatientProfile", back_populates="medication_reminders")
    appointment = relationship("Appointment", back_populates="reminders")


class TriageLog(Base):
    __tablename__ = "triage_logs"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patient_profiles.id"), nullable=True)
    symptoms_text = Column(Text, nullable=False)
    ai_recommendation = Column(Text, nullable=False)
    inferred_specialty = Column(String(100), nullable=False)
    risk_level = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    patient = relationship("PatientProfile", back_populates="triage_logs")


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    channel = Column(String(20), default="email")
    recipient_email = Column(String(255), nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    body_html = Column(Text, nullable=True)
    status = Column(String(20), default="pending", index=True)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_attempt_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="notifications")
