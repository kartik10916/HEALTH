from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_id: int
    full_name: str

class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: str = "patient"  # patient, doctor, admin
    # Optional fields if registering patient
    abha_id: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    # Optional fields if registering doctor
    specialty: Optional[str] = None
    qualification: Optional[str] = None
    consultation_fee: Optional[float] = 800.0

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    credential: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    google_id: Optional[str] = None
    role: str = "patient"

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Profile Schemas ---
class DoctorProfileOut(BaseModel):
    id: int
    user_id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    specialty: str
    qualification: str
    experience_years: int
    bio: Optional[str] = None
    consultation_fee: float
    room_number: str
    working_start: str
    working_end: str
    slot_duration_minutes: int

    class Config:
        from_attributes = True

class DoctorProfileUpdate(BaseModel):
    specialty: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    bio: Optional[str] = None
    consultation_fee: Optional[float] = None
    room_number: Optional[str] = None
    working_start: Optional[str] = None
    working_end: Optional[str] = None
    slot_duration_minutes: Optional[int] = None

class PatientProfileOut(BaseModel):
    id: int
    user_id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    abha_id: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    medical_history: Optional[str] = None
    emergency_contact: Optional[str] = None

    class Config:
        from_attributes = True

class PatientProfileUpdate(BaseModel):
    phone: Optional[str] = None
    abha_id: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    medical_history: Optional[str] = None
    emergency_contact: Optional[str] = None

# --- Appointment Schemas ---
class AppointmentCreate(BaseModel):
    doctor_id: int
    appointment_date: str  # YYYY-MM-DD
    start_time: str        # HH:MM
    end_time: str          # HH:MM
    symptom_summary: Optional[str] = None
    triage_urgency: Optional[str] = "low"

class AppointmentUpdate(BaseModel):
    status: Optional[str] = None  # scheduled, completed, cancelled
    doctor_notes: Optional[str] = None
    prescription: Optional[str] = None

class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    appointment_date: str
    start_time: str
    end_time: str
    status: str
    symptom_summary: Optional[str] = None
    triage_urgency: str
    doctor_notes: Optional[str] = None
    prescription: Optional[str] = None
    created_at: datetime
    patient_name: str
    doctor_name: str
    specialty: str
    consultation_fee: float

    class Config:
        from_attributes = True

# --- Slot Schema ---
class TimeSlot(BaseModel):
    start_time: str
    end_time: str
    is_available: bool

# --- AI Triage Schemas ---
class TriageRequest(BaseModel):
    symptoms: str
    age: Optional[int] = None
    gender: Optional[str] = None

class RecommendedDoctorOut(BaseModel):
    id: int
    full_name: str
    specialty: str
    consultation_fee: float
    experience_years: int
    room_number: str

class TriageResponse(BaseModel):
    urgency: str  # emergency, high, medium, low
    urgency_badge_color: str
    inferred_specialty: str
    ai_analysis: str
    guidance: str
    recommended_doctors: List[RecommendedDoctorOut] = []

# --- Admin & Stats Schemas ---
class AdminStatsOut(BaseModel):
    total_patients: int
    total_doctors: int
    total_appointments: int
    today_appointments: int
    completed_appointments: int
    urgency_distribution: dict
    revenue_estimate: float

class NotificationLogOut(BaseModel):
    id: int
    user_id: int
    channel: str
    title: str
    message: str
    status: str
    sent_at: datetime

    class Config:
        from_attributes = True
