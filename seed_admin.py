import datetime
from app.database import engine, Base, SessionLocal
from app.models import User, DoctorProfile, PatientProfile, Appointment, NotificationLog, TriageLog
from app.auth import get_password_hash

def seed_database(drop_existing=True):
    if drop_existing:
        print("Dropping & re-creating database tables for Indian Healthcare schema...")
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("Seeding SwasthyaCare Admin account...")
        admin = User(
            email="admin@swasthya.in",
            hashed_password=get_password_hash("Admin@123"),
            full_name="SwasthyaCare SuperAdmin",
            phone="+91 98000 11122",
            role="admin"
        )
        db.add(admin)
        db.commit()

        print("Seeding Indian Medical Specialists...")
        doctors_data = [
            {
                "email": "dr.sharma@swasthya.in",
                "name": "Dr. Ananya Sharma",
                "specialty": "Cardiology",
                "qualification": "MBBS, MD, DM (Cardiology) - AIIMS New Delhi",
                "exp": 14,
                "fee": 1200.0,
                "room": "Room 102 (Cardiac Care, AIIMS Tower)",
                "bio": "Senior Consultant Cardiologist specializing in preventative cardiac care, hypertension, and coronary angiography."
            },
            {
                "email": "dr.kumar@swasthya.in",
                "name": "Dr. Rajesh Kumar",
                "specialty": "Dermatology",
                "qualification": "MBBS, MD (Derm) - KMC Manipal",
                "exp": 10,
                "fee": 800.0,
                "room": "Room 105 (Skin & Allergy Wing)",
                "bio": "Expert dermatologist specializing in clinical dermatology, eczema, acne, psoriasis, and laser skin therapy."
            },
            {
                "email": "dr.nair@swasthya.in",
                "name": "Dr. Priya Nair",
                "specialty": "Neurology",
                "qualification": "MBBS, MD, DM (Neuro) - NIMHANS Bengaluru",
                "exp": 16,
                "fee": 1500.0,
                "room": "Room 201 (Neuroscience Block)",
                "bio": "Lead Neurologist focusing on stroke management, chronic migraine, epilepsy, and movement disorders."
            },
            {
                "email": "dr.singh@swasthya.in",
                "name": "Dr. Vikramaditya Singh",
                "specialty": "Orthopedics",
                "qualification": "MBBS, MS (Ortho) - Grant Medical College Mumbai",
                "exp": 12,
                "fee": 1000.0,
                "room": "Room 304 (Joint & Spine Care)",
                "bio": "Orthopedic surgeon specializing in robotic joint replacement, knee arthroscopy, and sports traumatology."
            },
            {
                "email": "dr.deshmukh@swasthya.in",
                "name": "Dr. Sunita Deshmukh",
                "specialty": "Pediatrics",
                "qualification": "MBBS, MD (Pediatrics) - KEM Hospital Mumbai",
                "exp": 9,
                "fee": 750.0,
                "room": "Room 108 (Child Health Wing)",
                "bio": "Compassionate pediatrician with expertise in child development, newborn care, and pediatric vaccination."
            },
            {
                "email": "dr.swaminathan@swasthya.in",
                "name": "Dr. Arvind Swaminathan",
                "specialty": "General Medicine & Ayush",
                "qualification": "MBBS, MD (Internal Medicine) - MMC Chennai",
                "exp": 15,
                "fee": 500.0,
                "room": "Room 101 (OPD Block)",
                "bio": "Senior general physician specializing in holistic health assessment, diabetes management, fever triage, and lifestyle medicine."
            }
        ]

        doc_profiles = []
        for d in doctors_data:
            doc_user = User(
                email=d["email"],
                hashed_password=get_password_hash("Doctor@123"),
                full_name=d["name"],
                phone="+91 98765 12345",
                role="doctor"
            )
            db.add(doc_user)
            db.commit()
            db.refresh(doc_user)

            doc_prof = DoctorProfile(
                user_id=doc_user.id,
                specialty=d["specialty"],
                qualification=d["qualification"],
                experience_years=d["exp"],
                bio=d["bio"],
                consultation_fee=d["fee"],
                room_number=d["room"],
                working_start="09:00",
                working_end="17:00",
                slot_duration_minutes=30
            )
            db.add(doc_prof)
            db.commit()
            db.refresh(doc_prof)
            doc_profiles.append(doc_prof)

        print("Seeding Indian Patient accounts & ABHA Health IDs...")
        patients_data = [
            {
                "email": "rahul@example.com",
                "name": "Rahul Verma",
                "phone": "+91 98765 43210",
                "abha": "14-8765-4321-9012",
                "dob": "1992-06-15",
                "gender": "Male",
                "blood": "B+",
                "history": "Seasonal bronchitis, dust allergy."
            },
            {
                "email": "kavita@example.com",
                "name": "Kavita Patel",
                "phone": "+91 91234 56789",
                "abha": "91-2345-6789-0123",
                "dob": "1995-10-24",
                "gender": "Female",
                "blood": "O+",
                "history": "No major prior medical conditions."
            }
        ]

        pat_profiles = []
        for p in patients_data:
            pat_user = User(
                email=p["email"],
                hashed_password=get_password_hash("Patient@123"),
                full_name=p["name"],
                phone=p["phone"],
                role="patient"
            )
            db.add(pat_user)
            db.commit()
            db.refresh(pat_user)

            pat_prof = PatientProfile(
                user_id=pat_user.id,
                abha_id=p["abha"],
                date_of_birth=p["dob"],
                gender=p["gender"],
                blood_group=p["blood"],
                medical_history=p["history"],
                emergency_contact="+91 98989 78787"
            )
            db.add(pat_prof)
            db.commit()
            db.refresh(pat_prof)
            pat_profiles.append(pat_prof)

        print("Seeding Sample Indian Consultations...")
        today_str = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        tomorrow_str = (datetime.datetime.utcnow() + datetime.timedelta(days=1)).strftime("%Y-%m-%d")

        appointments = [
            Appointment(
                patient_id=pat_profiles[0].id,
                doctor_id=doc_profiles[0].id, # Cardiology
                appointment_date=today_str,
                start_time="10:00",
                end_time="10:30",
                status="completed",
                symptom_summary="Palpitations and chest discomfort after morning jog.",
                triage_urgency="medium",
                doctor_notes="ECG normal. Blood pressure recorded 130/84 mmHg. Prescribed 2D Echocardiogram test.",
                prescription="Tab. Telmisartan 40mg once daily in morning. Low sodium diet."
            ),
            Appointment(
                patient_id=pat_profiles[1].id,
                doctor_id=doc_profiles[1].id, # Dermatology
                appointment_date=today_str,
                start_time="11:30",
                end_time="12:00",
                status="scheduled",
                symptom_summary="Skin rash on hands with itching.",
                triage_urgency="low"
            ),
            Appointment(
                patient_id=pat_profiles[0].id,
                doctor_id=doc_profiles[5].id, # General Medicine & Ayush
                appointment_date=tomorrow_str,
                start_time="09:30",
                end_time="10:00",
                status="scheduled",
                symptom_summary="High fever 101°F with body ache (Suspected Dengue/Flu).",
                triage_urgency="high"
            )
        ]
        for appt in appointments:
            db.add(appt)
        db.commit()

        print("SwasthyaCare Database successfully seeded!")
        print("--------------------------------------------------")
        print("DEMO INDIAN CREDENTIALS:")
        print("Admin:   admin@swasthya.in     / Admin@123")
        print("Doctor:  dr.sharma@swasthya.in  / Doctor@123")
        print("Patient: rahul@example.com     / Patient@123")
        print("--------------------------------------------------")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

def seed_if_empty():
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        if user_count == 0:
            print("Database is empty. Running initial database seed...")
            seed_database(drop_existing=False)
    except Exception as e:
        print(f"Check DB error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
