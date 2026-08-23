# SwasthyaCare AI - Enterprise Doctor Appointment & AI Triage Platform 🇮🇳

A full-stack, enterprise-grade healthcare platform built with **FastAPI**, **SQLAlchemy ORM**, **JWT Authentication (RBAC)**, **Google Gemini LLM Integration**, **Google Calendar OAuth 2.0 Sync**, **Background APScheduler Workers**, and **Vanilla HTML5/CSS/JS Portals** for Patients, Doctors, and System Administrators.

---

## 📋 Features & Core Capabilities

- 🔐 **Role-Based Access Control (RBAC)**: Authentication & authorization for `Patient`, `Doctor`, and `Admin` users using JWT bearer tokens.
- 🔒 **Concurrency & Double-Booking Protection**: Database schema constraints (`UniqueConstraint('doctor_id', 'appointment_date', 'start_time')`) and 10-minute temporary slot holds (`SlotHold`) to safely handle simultaneous booking attempts.
- 🏖️ **Doctor Leave Conflict Management**: Automated query of affected scheduled consultations when a doctor is marked on leave, automatic cancellation, and asynchronous background email notification dispatch.
- 🤖 **LLM Clinical Summaries & Triage**:
  - **Pre-Visit Summary Prompt**: `"Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: "`
  - **Post-Visit Summary Prompt**: `"Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: "`
  - **Graceful Degradation**: 100% fail-safe fallback text ensures system uptime even if the LLM API is unreachable.
- ⏰ **Background Jobs & Reminders**: `APScheduler` jobs for periodic medication reminders based on prescription frequency, email retry queues, and temporary slot hold releases.
- 📅 **Google Calendar OAuth 2.0 Integration**: Asynchronous best-effort Google Calendar event creation upon booking, and deletion/update upon cancellation or reschedule.

---

## 🛠️ Tech Stack & Requirements

- **Backend**: Python 3.10+, FastAPI, SQLAlchemy, Pydantic, APScheduler, Passlib (Bcrypt), Python-Jose, Google Generative AI (Gemini).
- **Frontend**: Responsive Semantic HTML5, Vanilla JavaScript (Fetch API with 401/403 auth error handling), and Vanilla CSS3 Design System.
- **Database**: SQLite (local) / PostgreSQL (production compatible).

---

## 🚀 Quick Start Guide

### 1. Clone & Install Dependencies
```bash
git clone <repository_url>
cd healthcare_platform
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

#### `.env.example` Reference:
```ini
# Security & JWT Configuration
SECRET_KEY=supersecret-swasthya-jwt-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# Database Connection URL
DATABASE_URL=sqlite:///./healthcare.db

# LLM Service (Google Gemini API Key - Optional, fallback rule-engine active)
GEMINI_API_KEY=your_gemini_api_key_here

# SMTP Email Configuration (Optional, fallback mock logger active)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@swasthya.in
SMTP_PASS=your_smtp_password

# Google Calendar OAuth 2.0 Credentials (Optional, fallback .ics generator active)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN=your_google_oauth_refresh_token
```

### 3. Seed Database
Initialize SQLite database tables and seed initial Indian doctor profiles, patients, and admin accounts:
```bash
python seed_admin.py 
```

### 4. Run Local Server
```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Open browser at: **`http://127.0.0.1:8000`**

---

## 🔑 Demo Credentials

| Role | Email | Password | Details |
|---|---|---|---|
| **Admin** | `admin@swasthya.in` | `Admin@123` | Full administrative control & ₹ revenue metrics |
| **Doctor** | `dr.sharma@swasthya.in` | `Doctor@123` | Dr. Ananya Sharma (Cardiology, AIIMS) |
| **Patient** | `rahul@example.com` | `Patient@123` | Rahul Verma (ABHA: 14-8765-4321-9012) |
| **Patient** | `kavita@example.com` | `Patient@123` | Kavita Patel (ABHA: 91-2345-6789-0123) |

---

## 🗄️ Database Schema & Models

- **`users`**: `id`, `email`, `hashed_password`, `full_name`, `phone`, `role` (`admin`/`doctor`/`patient`), `is_active`, `created_at`.
- **`doctor_profiles`**: `id`, `user_id`, `specialty`, `qualification`, `experience_years`, `bio`, `consultation_fee`, `room_number`, `working_start`, `working_end`, `slot_duration_minutes`.
- **`patient_profiles`**: `id`, `user_id`, `abha_id`, `date_of_birth`, `gender`, `blood_group`, `medical_history`, `emergency_contact`.
- **`appointments`**: `id`, `patient_id`, `doctor_id`, `appointment_date`, `start_time`, `end_time`, `status`, `symptom_summary`, `triage_urgency`, `pre_visit_summary`, `post_visit_summary`, `doctor_notes`, `prescription`, `google_event_id`.
  - *Constraints*: `UniqueConstraint('doctor_id', 'appointment_date', 'start_time')`.
- **`slot_holds`**: `id`, `doctor_id`, `patient_id`, `appointment_date`, `start_time`, `end_time`, `expires_at`.
- **`doctor_leaves`**: `id`, `doctor_id`, `leave_date`, `reason`.
- **`medication_reminders`**: `id`, `patient_id`, `appointment_id`, `medication_name`, `dosage`, `frequency_hours`, `next_reminder_at`, `is_active`.
- **`notification_logs`**: `id`, `user_id`, `channel`, `recipient_email`, `title`, `message`, `body_html`, `status`, `retry_count`, `max_retries`, `error_message`, `sent_at`, `last_attempt_at`.

---

## 🤖 Exact LLM Prompt Templates

1. **Pre-Visit Symptom Analysis**:
   ```
   "Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: " + symptoms_text
   ```

2. **Post-Visit Patient Summary**:
   ```
   "Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: " + doctor_notes + " Prescription: " + prescription
   ```

---

## 📅 Google Calendar OAuth 2.0 Setup Steps

1. Go to **[Google Cloud Console](https://console.cloud.google.com/)** and create a project.
2. Enable the **Google Calendar API** under API & Services.
3. Configure **OAuth Consent Screen** (User Type: External / Internal).
4. Create **OAuth 2.0 Client ID credentials** (Application type: Web application).
5. Obtain Refresh Token using Google OAuth Playground (`https://developers.google.com/oauthplayground`) with scope `https://www.googleapis.com/auth/calendar`.
6. Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` to your `.env` file.

---

## 🌐 Free Hosting Deployment Instructions (Render / Railway)

### Deploying to Render
1. Create a new **Web Service** on [Render.com](https://render.com).
2. Connect your GitHub repository.
3. Environment: `Python 3`.
4. Build Command:
   ```bash
   pip install -r requirements.txt && python seed_admin.py
   ```
5. Start Command:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
6. Add Environment Variables in the Render dashboard matching `.env.example`.

### Deploying to Railway
1. Create a new project on [Railway.app](https://railway.app).
2. Select **Deploy from GitHub repo**.
3. Set variables in the Railway dashboard (`SECRET_KEY`, `DATABASE_URL`, etc.).
4. Railway automatically detects `requirements.txt` and executes `uvicorn main:app --host 0.0.0.0 --port $PORT`.