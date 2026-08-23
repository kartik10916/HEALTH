import React, { useState } from 'react';
import { Search, Stethoscope, Briefcase, ShieldAlert, Award, Star } from 'lucide-react';

export default function HomeView({ onNavigate, onQuickLogin, onSymptomTriage, isAuthenticated }) {
  const [symptomInput, setSymptomInput] = useState('');

  function handleAnalyzeSymptoms() {
    if (!symptomInput.trim()) {
      alert('Please describe your symptoms first.');
      return;
    }
    onSymptomTriage(symptomInput);
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Hero Section with AI Symptom Checker */}
      <section className="triage-hero-card">
        <div style={{ maxWidth: '720px', position: 'relative', zIndex: 2 }}>
          <span className="badge badge-medium" style={{ background: 'rgba(255,255,255,0.18)', color: '#fed7aa', border: 'none', marginBottom: '1rem' }}>
            ✨ AI Clinical Triage & Telemedicine Network India
          </span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
            Smart Indian Healthcare & Doctor Consultations
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#cbd5e1', marginBottom: '2rem' }}>
            Describe symptoms in plain Hindi/English for instant clinical urgency score, AI specialist match, and quick booking with top AIIMS, NIMHANS & KEM trained doctors.
          </p>

          <div style={{ backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', padding: '0.5rem', display: 'flex', gap: '0.5rem', boxShadow: 'var(--shadow-lg)', alignItems: 'center' }}>
            <Search size={20} style={{ marginLeft: '0.75rem', color: 'var(--text-light)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="E.g., High fever 102°F with joint pain, or chest discomfort..."
              value={symptomInput}
              onChange={(e) => setSymptomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeSymptoms()}
              style={{ border: 'none', fontSize: '1rem', boxShadow: 'none', paddingLeft: '0.25rem' }}
            />
            <button className="btn btn-primary" onClick={handleAnalyzeSymptoms} style={{ whiteSpace: 'nowrap', padding: '0.75rem 1.5rem' }}>
              🔍 Analyze Symptoms
            </button>
          </div>

          {/* Quick-triage sample prompt pills */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', animation: 'fadeIn 0.5s ease-out' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', alignSelf: 'center', fontWeight: 600 }}>Templates:</span>
            {[
              { label: "🤒 High Fever", text: "High fever 102°F with severe joint pain and shivering since yesterday" },
              { label: "🫁 Severe Cough", text: "Persistent dry cough, sore throat and mild breathing difficulty" },
              { label: "❤️ Chest Discomfort", text: "Chest pressure and mild shortness of breath during walking" },
              { label: "🌿 Ayurvedic Care", text: "Ayurvedic consultation request for chronic joint stiffness and indigestion" }
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSymptomInput(p.text);
                  onSymptomTriage(p.text);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#e2e8f0',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'var(--color-primary)';
                  e.target.style.borderColor = 'var(--color-primary-hover)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* Demo Accounts & Quick Switcher Cards */}
      <section style={{ marginTop: '3rem' }}>
        <div className="page-header">
          <div>
            <h2 className="page-title">Digital Health Portals</h2>
            <p className="page-subtitle">Access dedicated environments tailored for Patients, Medical Specialists, and Health Administrators.</p>
          </div>
        </div>

        <div className="grid-3">
          {/* Patient Portal Card */}
          <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧑‍⚕️</div>
              <h3 className="card-title">Patient Care Portal</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Run AI symptom triage, link ABHA Health ID, book doctor slots in ₹ (INR), download .ics calendar invites, and view e-prescriptions.
              </p>
            </div>
            <div className="quick-switcher-row">
              <button onClick={() => onNavigate('patient')} className="btn btn-primary" style={{ width: '100%' }}>
                Open Patient Portal
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => onQuickLogin('rahul@example.com', 'Patient@123', 'patient')}
                style={{ width: '100%', fontSize: '0.75rem' }}
              >
                ⚡ Quick Login as Rahul Verma
              </button>
            </div>
          </div>

          {/* Doctor Portal Card */}
          <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👨‍⚕️</div>
              <h3 className="card-title">Doctor Workplace</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Manage OPD consultation schedules, configure consultation fees (₹), record clinical notes, and issue digital prescriptions.
              </p>
            </div>
            <div className="quick-switcher-row">
              <button onClick={() => onNavigate('doctor')} className="btn btn-secondary" style={{ width: '100%' }}>
                Open Doctor Workplace
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => onQuickLogin('dr.sharma@swasthya.in', 'Doctor@123', 'doctor')}
                style={{ width: '100%', fontSize: '0.75rem' }}
              >
                ⚡ Quick Login as Dr. Ananya Sharma
              </button>
            </div>
          </div>

          {/* Admin Portal Card */}
          <div className="card card-hover" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
              <h3 className="card-title">Admin Command Center</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Monitor platform metrics in ₹ (INR), track 108 emergency triage stats, onboard new doctors (AIIMS/NIMHANS), and audit notification logs.
              </p>
            </div>
            <div className="quick-switcher-row">
              <button onClick={() => onNavigate('admin')} className="btn btn-outline" style={{ width: '100%' }}>
                Open Admin Command
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => onQuickLogin('admin@swasthya.in', 'Admin@123', 'admin')}
                style={{ width: '100%', fontSize: '0.75rem' }}
              >
                ⚡ Quick Login as Admin
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Quality Section */}
      <section style={{ marginTop: '4rem', padding: '2rem 1.5rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>National Digital Health Standards</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>We comply fully with India's Ayushman Bharat Digital Mission (ABDM) guidelines.</p>
        </div>
        <div className="grid-3" style={{ textAlign: 'center' }}>
          <div>
            <Award style={{ color: 'var(--color-secondary)', marginBottom: '0.5rem' }} size={32} />
            <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>ABHA Linked</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Securely pull digital records using verified 14-digit Ayushman Bharat Health Accounts.</p>
          </div>
          <div>
            <Star style={{ color: 'var(--color-gold)', marginBottom: '0.5rem' }} size={32} />
            <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Verified Specialists</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Medical council verified practitioners from major Indian teaching hospitals.</p>
          </div>
          <div>
            <ShieldAlert style={{ color: 'var(--color-primary)', marginBottom: '0.5rem' }} size={32} />
            <h4 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>AI Triage Guard</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Urgency validation ensures red-flag cases receive priority consultation queues.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
