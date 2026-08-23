import os
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

# Database & Models
from app.database import engine, Base, get_db
from app.models import (
    User, PatientProfile, DoctorProfile, Appointment,
    SlotHold, DoctorLeave, TriageLog, NotificationLog
)

# Schemas & Auth
from app.schemas import UserRegister, UserLogin, GoogleLoginRequest, Token, UserOut
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user, verify_google_id_token

# Services
from app import services
from app.services import llm_service, email_service, calendar_service

# API Routers
from app.api.patient import router as patient_router
from app.api.doctor import router as doctor_router
from app.api.admin import router as admin_router

# Scheduler
from app.scheduler import start_scheduler, shutdown_scheduler

# Initialize SQLAlchemy Tables
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"DB init notice: {e}")

def run_db_migrations():
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(engine)
        if "users" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("users")]
            if "google_id" not in columns:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN google_id VARCHAR(255)"))
                    conn.commit()
    except Exception as e:
        print(f"DB migration notice: {e}")

run_db_migrations()

IS_VERCEL = bool(os.getenv("VERCEL"))

app = FastAPI(
    title="SwasthyaCare AI Telemedicine Platform API 🇮🇳",
    description="Enterprise Doctor Appointment, AI Symptom Triage, & Clinical Care System",
    version="1.0.0",
    # On Vercel, /api/(.*) routes to this function, so docs must live under /api/
    docs_url="/api/docs" if IS_VERCEL else "/docs",
    openapi_url="/api/openapi.json" if IS_VERCEL else "/openapi.json",
    redoc_url="/api/redoc" if IS_VERCEL else "/redoc",
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include All Routers
app.include_router(patient_router)
app.include_router(doctor_router)
app.include_router(admin_router)

# Mount Static Files Directory (local dev only — Vercel CDN serves them in production)
if not os.getenv("VERCEL"):
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.on_event("startup")
def on_startup():
    try:
        from seed_admin import seed_if_empty
        seed_if_empty()
    except Exception as e:
        print(f"[startup] seed_if_empty skipped: {e}")
    if not os.getenv("VERCEL"):
        start_scheduler()

@app.on_event("shutdown")
def on_shutdown():
    if not os.getenv("VERCEL"):
        shutdown_scheduler()

# --- Auth Endpoints ---

@app.post("/api/auth/register", response_model=Token)
def register_user(payload: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if payload.role == "patient":
        patient_prof = PatientProfile(
            user_id=user.id,
            abha_id=payload.abha_id,
            date_of_birth=payload.date_of_birth,
            gender=payload.gender,
            blood_group=payload.blood_group
        )
        db.add(patient_prof)
        db.commit()

    elif payload.role == "doctor":
        doc_prof = DoctorProfile(
            user_id=user.id,
            specialty=payload.specialty or "General Medicine & Ayush",
            qualification=payload.qualification or "MBBS",
            consultation_fee=payload.consultation_fee or 800.0
        )
        db.add(doc_prof)
        db.commit()

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "full_name": user.full_name
    })
    return Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        full_name=user.full_name
    )


@app.post("/api/auth/login", response_model=Token)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated. Contact admin.")

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "full_name": user.full_name
    })
    return Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        full_name=user.full_name
    )


@app.get("/api/auth/google/config")
def get_google_config():
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id or client_id.startswith("your_") or "your_google_client_id" in client_id:
        return {"client_id": "", "configured": False}
    return {"client_id": client_id, "configured": True}


@app.post("/api/auth/google", response_model=Token)
def google_auth_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    email = None
    google_sub = None
    full_name = None

    if payload.credential:
        verified_info = verify_google_id_token(payload.credential)
        if verified_info:
            email = verified_info.get("email")
            google_sub = verified_info.get("sub")
            full_name = verified_info.get("name")
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Google credential token."
            )
    elif payload.email:
        # Fallback / Direct Google profile data (e.g. demo mode / SDK)
        email = payload.email
        google_sub = payload.google_id
        full_name = payload.full_name or payload.email.split("@")[0].title()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google token credential or email required."
        )

    # Check if user already exists
    user = db.query(User).filter(User.email == email).first()

    if user:
        if not user.is_active:
            raise HTTPException(status_code=400, detail="User account is deactivated. Contact admin.")
        
        # Link google_id if not present
        if google_sub and not user.google_id:
            user.google_id = google_sub
            db.commit()
    else:
        # Create new user via Google Sign-In
        user_role = payload.role if payload.role in ["patient", "doctor", "admin"] else "patient"
        display_name = full_name or email.split("@")[0].title()
        
        user = User(
            email=email,
            hashed_password=get_password_hash(f"google_oauth_{google_sub or email}"),
            google_id=google_sub,
            full_name=display_name,
            role=user_role,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        if user_role == "patient":
            patient_prof = PatientProfile(
                user_id=user.id
            )
            db.add(patient_prof)
            db.commit()
        elif user_role == "doctor":
            doc_prof = DoctorProfile(
                user_id=user.id,
                specialty="General Medicine & Ayush",
                qualification="MBBS",
                consultation_fee=800.0
            )
            db.add(doc_prof)
            db.commit()

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "full_name": user.full_name
    })
    return Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        full_name=user.full_name
    )


@app.get("/api/auth/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/")
def read_root():
    # On Vercel, the frontend SPA is served by CDN at root
    # On local dev, redirect to the static build
    if os.getenv("VERCEL"):
        return {"status": "SwasthyaCare API running", "docs": "/api/docs"}
    return RedirectResponse(url="/static/index.html")
