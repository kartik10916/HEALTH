import os
import json
import logging
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
logger = logging.getLogger(__name__)

SPECIALTY_KEYWORDS = {
    "Cardiology": ["chest pain", "heart", "palpitations", "shortness of breath", "cardiac", "blood pressure", "hypertension", "angina"],
    "Dermatology": ["skin", "rash", "itching", "acne", "mole", "eczema", "psoriasis", "lesion", "hives", "dermatitis"],
    "Neurology": ["headache", "migraine", "dizziness", "numbness", "seizure", "tremor", "memory loss", "paralysis", "tingling"],
    "Orthopedics": ["joint pain", "bone", "fracture", "knee", "back pain", "spine", "arthritis", "sprain", "shoulder", "ligament"],
    "Pediatrics": ["child", "infant", "toddler", "pediatric", "baby", "growth", "vaccination", "crying", "teething"],
    "ENT (Ear, Nose & Throat)": ["sore throat", "ear pain", "nasal congestion", "sinus", "tonsils", "hearing", "tinnitus", "runny nose"],
    "General Medicine & Ayush": ["fever", "cough", "flu", "fatigue", "cold", "stomach pain", "nausea", "headache", "body ache", "weakness", "dengue", "chikungunya", "malaria"],
    "Gastroenterology": ["stomach", "acid reflux", "diarrhea", "constipation", "bloating", "abdominal", "vomiting", "ulcer"],
    "Psychiatry": ["anxiety", "depression", "insomnia", "stress", "panic", "mood", "mental health"]
}

EMERGENCY_KEYWORDS = ["chest pain", "difficulty breathing", "unconscious", "stroke", "severe bleeding", "paralysis", "anaphylaxis", "sudden numbness", "choking"]
HIGH_RISK_KEYWORDS = ["high fever", "persistent vomiting", "severe abdominal pain", "head injury", "seizure", "intense pain", "dengue fever"]
MEDIUM_RISK_KEYWORDS = ["fever", "migraine", "rash spreading", "joint swelling", "deep cough", "dizziness"]


def analyze_symptoms_rule_engine(symptoms: str, age: int = None, gender: str = None) -> Dict[str, Any]:
    symptoms_lower = symptoms.lower()
    urgency = "Low"
    urgency_color = "emerald"
    
    for kw in EMERGENCY_KEYWORDS:
        if kw in symptoms_lower:
            urgency = "High"
            urgency_color = "red"
            break
            
    if urgency != "High":
        for kw in HIGH_RISK_KEYWORDS:
            if kw in symptoms_lower:
                urgency = "High"
                urgency_color = "orange"
                break
                
    if urgency not in ["High"]:
        for kw in MEDIUM_RISK_KEYWORDS:
            if kw in symptoms_lower:
                urgency = "Medium"
                urgency_color = "yellow"
                break

    matched_specialty = "General Medicine & Ayush"
    max_matches = 0
    
    for spec, keywords in SPECIALTY_KEYWORDS.items():
        matches = sum(1 for kw in keywords if kw in symptoms_lower)
        if matches > max_matches:
            max_matches = matches
            matched_specialty = spec

    if urgency == "High":
        analysis = "CRITICAL ALERT: Symptoms indicate a potential medical emergency."
        guidance = "Please dial 108 (National Ambulance) or 112 immediately, or visit the nearest emergency casualty department without delay."
    elif urgency == "Medium":
        analysis = f"Moderate symptoms detected. Recommended clinical consultation with {matched_specialty}."
        guidance = "Schedule a consultation within 1 to 2 days. Maintain hydration, rest, and monitor temperature/pulse."
    else:
        analysis = f"Mild symptoms detected. Recommended routine consultation with {matched_specialty}."
        guidance = "You may book a routine consultation at your convenience. Continue observing symptoms."

    return {
        "urgency": urgency,
        "urgency_badge_color": urgency_color,
        "inferred_specialty": matched_specialty,
        "ai_analysis": analysis,
        "guidance": guidance
    }


def analyze_symptoms_with_llm(symptoms: str, age: int = None, gender: str = None) -> Dict[str, Any]:
    if not GEMINI_API_KEY or GEMINI_API_KEY.strip() == "" or GEMINI_API_KEY.startswith("your_"):
        return analyze_symptoms_rule_engine(symptoms, age, gender)

    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        
        # Try modern gemini models first
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: {symptoms}"
            response = model.generate_content(prompt)
            text = response.text.strip()
        except Exception:
            model = genai.GenerativeModel('gemini-pro')
            prompt = f"Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: {symptoms}"
            response = model.generate_content(prompt)
            text = response.text.strip()
        
        rule_fallback = analyze_symptoms_rule_engine(symptoms, age, gender)
        return {
            "urgency": rule_fallback["urgency"],
            "urgency_badge_color": rule_fallback["urgency_badge_color"],
            "inferred_specialty": rule_fallback["inferred_specialty"],
            "ai_analysis": text[:350],
            "guidance": rule_fallback["guidance"]
        }
    except Exception as e:
        logger.warning(f"Gemini LLM call failed ({e}). Fallback to rule engine.")
        return analyze_symptoms_rule_engine(symptoms, age, gender)


def generate_pre_visit_summary(symptoms_text: str, patient_info: dict = None) -> str:
    exact_prompt = f"Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: {symptoms_text}"
    
    if not GEMINI_API_KEY or GEMINI_API_KEY.startswith("your_"):
        return f"Pre-Visit Summary (Fallback):\nChief Complaint: {symptoms_text[:100]}\nUrgency: Medium\nSuggested Questions:\n1. What is the expected recovery timeline?\n2. Are there any dietary restrictions?\n3. When should I schedule a follow-up visit?"

    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(exact_prompt)
            return response.text.strip()
        except Exception:
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content(exact_prompt)
            return response.text.strip()
    except Exception as e:
        logger.warning(f"Pre-visit LLM summary failed ({e}). Using fallback text.")
        return f"Pre-Visit Summary (Fallback):\nChief Complaint: {symptoms_text[:100]}\nUrgency: Medium\nSuggested Questions:\n1. What is the root cause of these symptoms?\n2. What precautions should I follow?\n3. Are diagnostic tests recommended?"


def generate_post_visit_summary(doctor_notes: str, prescription: str) -> str:
    exact_prompt = f"Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: Doctor Notes: {doctor_notes or 'Evaluation complete.'} Prescription: {prescription or 'As advised.'}"

    if not GEMINI_API_KEY or GEMINI_API_KEY.startswith("your_"):
        return f"Patient-Friendly Visit Summary (Fallback):\nDiagnosis & Evaluation: {doctor_notes or 'Clinical consultation completed.'}\nMedication Schedule: {prescription or 'Take prescribed medicines as directed.'}\nFollow-Up Steps: Maintain adequate hydration, rest, and contact hospital helpline if symptoms recur."

    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(exact_prompt)
            return response.text.strip()
        except Exception:
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content(exact_prompt)
            return response.text.strip()
    except Exception as e:
        logger.warning(f"Post-visit LLM summary failed ({e}). Using fallback text.")
        return f"Patient-Friendly Visit Summary (Fallback):\nDiagnosis & Evaluation: {doctor_notes or 'Clinical consultation completed.'}\nMedication Schedule: {prescription or 'Take prescribed medicines as directed.'}\nFollow-Up Steps: Maintain adequate hydration, rest, and contact hospital helpline if symptoms recur."
