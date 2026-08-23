import React, { useState, useEffect } from 'react';
import { Search, Calendar, AlertTriangle, CheckCircle, Activity, FileText, X, Clock, User, Download, Sparkles, Trash2, Filter } from 'lucide-react';

export default function PatientView({ token, onOpenAuth, heroSymptoms, clearHeroSymptoms }) {
  // State for AI Triage
  const [symptoms, setSymptoms] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [triageResult, setTriageResult] = useState(null);
  const [triageLoading, setTriageLoading] = useState(false);

  // State for Doctor Directory
  const [specialty, setSpecialty] = useState('All');
  const [search, setSearch] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);

  // State for Booking Modal
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingSymptoms, setBookingSymptoms] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');

  // State for Appointments
  const [appointments, setAppointments] = useState([]);
  const [apptsLoading, setApptsLoading] = useState(false);

  // State for Summary Modal
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Pre-fill triage if symptoms exist from landing page search
  useEffect(() => {
    if (heroSymptoms) {
      setSymptoms(heroSymptoms);
      clearHeroSymptoms();
      // Auto run triage if symptoms are present
      runTriage(heroSymptoms);
    }
  }, [heroSymptoms]);

  // Load doctors on load and filter change
  useEffect(() => {
    loadDoctors();
  }, [specialty]);

  // Load appointments if token is present
  useEffect(() => {
    if (token) {
      loadAppointments();
    }
  }, [token]);

  // Load slots when booking doctor or date changes
  useEffect(() => {
    if (isBookingOpen && selectedDoctor) {
      loadSlots();
    }
  }, [isBookingOpen, selectedDoctor, bookingDate]);

  async function runTriage(symptomText = symptoms) {
    if (!symptomText.trim()) {
      alert('Please describe your symptoms before running AI triage.');
      return;
    }
    setTriageLoading(true);
    setTriageResult(null);

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch('/api/patient/triage', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          symptoms: symptomText,
          age: age ? parseInt(age) : null,
          gender
        })
      });

      if (res.status === 401 || res.status === 403) {
        onOpenAuth('login');
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Triage failed');

      setTriageResult(data);

      // Auto update specialty filter to recommend matching specialist
      if (data.inferred_specialty) {
        setSpecialty(data.inferred_specialty);
      }
    } catch (err) {
      alert('Error running triage: ' + err.message);
    } finally {
      setTriageLoading(false);
    }
  }

  async function loadDoctors() {
    setDoctorsLoading(true);
    try {
      let url = '/api/patient/doctors?';
      if (specialty && specialty !== 'All') url += `specialty=${encodeURIComponent(specialty)}&`;
      if (search) url += `search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      const data = await res.json();
      setDoctors(data);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setDoctorsLoading(false);
    }
  }

  async function loadSlots() {
    setSlotsLoading(true);
    setSelectedSlot(null);
    setSlots([]);
    try {
      const res = await fetch(`/api/patient/doctors/${selectedDoctor.id}/slots?date=${bookingDate}`);
      const data = await res.json();
      setSlots(data);
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function loadAppointments() {
    setApptsLoading(true);
    try {
      const res = await fetch('/api/patient/appointments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
    } finally {
      setApptsLoading(false);
    }
  }

  function handleOpenBooking(doc) {
    if (!token) {
      alert('Please sign in to book a consultation.');
      onOpenAuth('login');
      return;
    }
    setSelectedDoctor(doc);
    setBookingSymptoms(symptoms || '');
    setBookingError('');
    setBookingSuccess('');
    setIsBookingOpen(true);
  }

  async function handleConfirmBooking() {
    setBookingError('');
    if (!selectedSlot) {
      setBookingError('Please click to select an available time slot.');
      return;
    }

    try {
      const res = await fetch('/api/patient/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          doctor_id: selectedDoctor.id,
          appointment_date: bookingDate,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          symptom_summary: bookingSymptoms
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Booking failed');

      alert(`🎉 Appointment booked successfully with Dr. ${data.doctor_name} for ${bookingDate} at ${selectedSlot.start_time} IST!`);
      setIsBookingOpen(false);
      loadAppointments();
    } catch (err) {
      setBookingError(err.message);
    }
  }

  async function handleCancelAppointment(id) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const res = await fetch(`/api/patient/appointments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        loadAppointments();
      } else {
        const data = await res.json();
        alert('Failed to cancel: ' + (data.detail || 'Error'));
      }
    } catch (err) {
      alert('Error cancelling appointment: ' + err.message);
    }
  }

  async function handleDownloadICS(id) {
    try {
      const res = await fetch(`/api/patient/appointments/${id}/ics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Could not download calendar file.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appointment_${id}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading ICS: ' + err.message);
    }
  }

  async function handleViewSummary(id) {
    setSummaryLoading(true);
    setIsSummaryOpen(true);
    setSelectedSummary(null);
    try {
      const res = await fetch(`/api/patient/appointments/${id}/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedSummary(data);
      } else {
        throw new Error(data.detail || 'Summary request failed.');
      }
    } catch (err) {
      alert(err.message);
      setIsSummaryOpen(false);
    } finally {
      setSummaryLoading(false);
    }
  }

  function isDoctorOnDuty(doc) {
    if (!doc.working_start || !doc.working_end) return false;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    return currentTimeStr >= doc.working_start && currentTimeStr <= doc.working_end;
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Patient Care Portal</h1>
          <p className="page-subtitle">Link your health credentials, check symptoms, and book teleconsultations.</p>
        </div>
      </div>

      <div className="grid-2">
        {/* Left Side: Symptom Triage */}
        <div className="card" id="triageSection">
          <h3 className="card-title">
            <Activity style={{ color: 'var(--color-primary)' }} />
            AI Symptom Triage & Analysis
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Powered by Google Gemini clinical model fallback rule-engine.
          </p>

          <div className="input-group">
            <label className="input-label">Describe Your Symptoms</label>
            <textarea
              className="form-control"
              placeholder="Explain how you feel in English or Hindi. E.g., High fever 102°F since 2 days, dry cough, body aches..."
              rows={4}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Age (Years)</label>
              <input
                type="number"
                className="form-control"
                placeholder="E.g., 28"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Gender</label>
              <select
                className="form-control"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => runTriage()} disabled={triageLoading}>
            {triageLoading ? 'Running AI Diagnostics...' : '🔍 Execute AI Clinical Triage'}
          </button>

          {triageResult && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1.25rem',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-main)',
                animation: 'slideUp 0.3s ease-out'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Urgency Level Assessment:</span>
                <span className={`badge badge-${triageResult.urgency?.toLowerCase() || 'low'}`}>
                  {(triageResult.urgency || 'LOW').toUpperCase()} URGENCY
                </span>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Recommended Specialist:</div>
                <div style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>{triageResult.inferred_specialty}</div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>AI Diagnosis Summary:</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.2rem' }}>{triageResult.ai_analysis}</p>
              </div>

              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Clinical Guidance:</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.2rem', fontWeight: 600 }}>{triageResult.guidance}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Doctor Directory */}
        <div className="card">
          <h3 className="card-title">
            <User style={{ color: 'var(--color-secondary)' }} />
            Indian Medical Specialist Directory
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Filter and book appointments with certified consulting specialists.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-light)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search name or clinic specialty..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadDoctors()}
                style={{ paddingLeft: '32px' }}
              />
            </div>
            <select
              className="form-control"
              style={{ width: '160px' }}
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            >
              <option value="All">All Specialties</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Neurology">Neurology</option>
              <option value="General Medicine">General Medicine</option>
              <option value="Ayush & Ayurvedic Care">Ayush & Ayurveda</option>
            </select>
            <button className="btn btn-outline" onClick={loadDoctors}>
              <Filter size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {doctorsLoading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading specialists...</p>
            ) : doctors.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No specialists found matching criteria.</p>
            ) : (
              doctors.map((doc) => (
                <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: '#fff', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontWeight: 700 }}>{doc.full_name}</h4>
                    <span className="badge badge-low" style={{ fontSize: '0.65rem', marginTop: '0.25rem', padding: '0.1rem 0.5rem' }}>
                      {doc.specialty}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      {doc.qualification} &bull; {doc.experience_years} Yrs Exp.
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isDoctorOnDuty(doc) ? '#059669' : '#a8a29e',
                        display: 'inline-block',
                        boxShadow: isDoctorOnDuty(doc) ? '0 0 8px #059669' : 'none'
                      }}></span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isDoctorOnDuty(doc) ? '#059669' : '#78716c' }}>
                        {isDoctorOnDuty(doc) ? 'OPD Active (Consulting Now)' : `OPD Closed (OPD Hours: ${doc.working_start}-${doc.working_end})`}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: '1.05rem', marginBottom: '0.5rem' }}>
                      ₹{doc.consultation_fee}
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => handleOpenBooking(doc)}>
                      Book Slot
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Appointment History Table */}
      <section className="card" style={{ marginTop: '2rem' }}>
        <h3 className="card-title">
          <Calendar style={{ color: 'var(--color-primary)' }} />
          Your Consultations & Medical History
        </h3>

        {!token ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
            <p>Please sign in to view your upcoming consultations, prescription records, and AI summaries.</p>
            <button className="btn btn-primary" onClick={() => onOpenAuth('login')} style={{ marginTop: '1rem' }}>
              Sign In Now
            </button>
          </div>
        ) : apptsLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading consultations...</p>
        ) : appointments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No consultations scheduled yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Specialty</th>
                  <th>Date & Time</th>
                  <th>Triage Urgency</th>
                  <th>Status</th>
                  <th>Rx & Clinical Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.doctor_name}</strong></td>
                    <td>{a.specialty}</td>
                    <td>
                      <strong>{a.appointment_date}</strong>
                      <br />
                      <small style={{ color: 'var(--text-muted)' }}>{a.start_time} - {a.end_time} IST</small>
                    </td>
                    <td>
                      <span className={`badge badge-${a.triage_urgency?.toLowerCase() || 'low'}`}>
                        {a.triage_urgency?.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${a.status}`}>
                        {a.status?.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        {a.doctor_notes && (
                          <div><strong>Notes:</strong> {a.doctor_notes}</div>
                        )}
                        {a.prescription ? (
                          <div><strong style={{ color: 'var(--color-secondary)' }}>Rx:</strong> {a.prescription}</div>
                        ) : (
                          <span style={{ color: 'var(--text-light)' }}>Pending consultation</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => handleDownloadICS(a.id)}>
                          <Download size={12} /> iCal
                        </button>
                        {a.status === 'completed' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleViewSummary(a.id)}>
                            <Sparkles size={12} /> AI Summary
                          </button>
                        )}
                        {a.status === 'scheduled' && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleCancelAppointment(a.id)}>
                            <Trash2 size={12} /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Booking Modal */}
      {isBookingOpen && selectedDoctor && (
        <div className="modal-overlay active" onClick={() => setIsBookingOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsBookingOpen(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '0.5rem', fontWeight: 800 }}>
              Book Slot with {selectedDoctor.full_name}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {selectedDoctor.specialty} &bull; Consultation Fee: ₹{selectedDoctor.consultation_fee}
            </p>

            <div className="input-group">
              <label className="input-label">Select Consultation Date</label>
              <input
                type="date"
                className="form-control"
                value={bookingDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setBookingDate(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Chief Symptom Complaint</label>
              <input
                type="text"
                className="form-control"
                placeholder="Explain main symptoms briefly..."
                value={bookingSymptoms}
                onChange={(e) => setBookingSymptoms(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Select Available OPD Time Slot (IST)</label>
              {slotsLoading ? (
                <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>Checking OPD calendar...</p>
              ) : slots.length === 0 ? (
                <p style={{ color: 'var(--color-emergency)', fontSize: '0.85rem', fontWeight: 600 }}>
                  No available slot on this date. Doctor may be fully booked or on leave.
                </p>
              ) : (
                <div className="slots-grid">
                  {slots.map((slot, index) => {
                    const isSelected = selectedSlot && selectedSlot.start_time === slot.start_time;
                    return (
                      <div
                        key={index}
                        className={`slot-pill ${slot.is_available ? '' : 'disabled'} ${isSelected ? 'selected' : ''}`}
                        onClick={() => slot.is_available && setSelectedSlot(slot)}
                      >
                        {slot.start_time} - {slot.end_time}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {bookingError && (
              <div className="app-alert app-alert-danger" style={{ marginBottom: '1rem' }}>
                {bookingError}
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%', padding: '0.7rem' }} onClick={handleConfirmBooking} disabled={slotsLoading}>
              Confirm Consultation Booking
            </button>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {isSummaryOpen && (
        <div className="modal-overlay active" onClick={() => setIsSummaryOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsSummaryOpen(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles style={{ color: 'var(--color-primary)' }} />
              AI Patient Visit Summary
            </h2>

            {summaryLoading ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Generative AI summarizing clinical notes...</p>
            ) : selectedSummary ? (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--color-primary)' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clinical Evaluation / Diagnosis</h4>
                  <p style={{ fontWeight: 700, marginTop: '0.25rem' }}>
                    {selectedSummary.summary?.split('\n')[0] || 'Consultation record processed'}
                  </p>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Prescribed Medication Schedule</h4>
                  <ul style={{ paddingLeft: '1.25rem', marginTop: '0.4rem', fontSize: '0.9rem' }}>
                    {selectedSummary.summary?.split('\n').slice(1).filter(l => l.trim().length > 0).map((med, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>{med}</li>
                    )) || <li>No medications prescribed. Refer to doctor instructions.</li>}
                  </ul>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Diet & Lifestyle Guidance</h4>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    Follow doctor instructions, take medications on time, rest, and keep hydrated.
                  </p>
                </div>

                <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-emergency-bg)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--color-emergency)', fontSize: '0.8rem' }}>
                  <strong>Safety Alert:</strong> If symptoms severely worsen or you experience breathing distress or chest pain, seek immediate in-person emergency care (Dial 108/112).
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--color-emergency)' }}>Failed to generate visit summary.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
