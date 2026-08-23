import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, Briefcase, FileText, CheckCircle, X, Settings, Sparkles, UserCheck } from 'lucide-react';

export default function DoctorView({ token, role, onOpenAuth }) {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Filters for Appointments
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [apptsLoading, setApptsLoading] = useState(false);

  // Consultation Modal
  const [isConsultOpen, setIsConsultOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState('');
  const [status, setStatus] = useState('completed');

  // AI Briefing Modal
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [briefingData, setBriefingData] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Schedule Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingFee, setSettingFee] = useState(0);
  const [settingRoom, setSettingRoom] = useState('');
  const [settingStart, setSettingStart] = useState('09:00');
  const [settingEnd, setSettingEnd] = useState('17:00');
  const [settingDuration, setSettingDuration] = useState(30);

  // Leave Modal
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('');

  // Initial load
  useEffect(() => {
    if (token && (role === 'doctor' || role === 'admin')) {
      loadDoctorProfile();
      loadDoctorAppointments();
    }
  }, [token, role, filterDate, filterStatus]);

  async function loadDoctorProfile() {
    setProfileLoading(true);
    try {
      const res = await fetch('/api/doctor/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setSettingFee(data.consultation_fee);
        setSettingRoom(data.room_number);
        setSettingStart(data.working_start);
        setSettingEnd(data.working_end);
        setSettingDuration(data.slot_duration_minutes);
      }
    } catch (err) {
      console.error('Error fetching doctor profile:', err);
    } finally {
      setProfileLoading(false);
    }
  }

  async function loadDoctorAppointments() {
    setApptsLoading(true);
    try {
      let url = '/api/doctor/appointments?';
      if (filterDate) url += `date=${filterDate}&`;
      if (filterStatus) url += `status=${filterStatus}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch (err) {
      console.error('Error loading appointments:', err);
    } finally {
      setApptsLoading(false);
    }
  }

  function handleOpenConsult(appt) {
    setSelectedAppt(appt);
    setNotes(appt.doctor_notes || '');
    setPrescription(appt.prescription || '');
    setStatus(appt.status || 'completed');
    setIsConsultOpen(true);
  }

  async function handleSaveConsult() {
    try {
      const res = await fetch(`/api/doctor/appointments/${selectedAppt.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          doctor_notes: notes,
          prescription
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update consultation record.');
      }

      alert('✅ Consultation notes and digital Rx saved!');
      setIsConsultOpen(false);
      loadDoctorAppointments();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleOpenBriefing(appt) {
    setIsBriefingOpen(true);
    setBriefingLoading(true);
    setBriefingData(null);
    try {
      const res = await fetch(`/api/doctor/appointments/${appt.id}/pre-visit-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setBriefingData(data);
      } else {
        throw new Error(data.detail || 'Failed to generate clinical briefing.');
      }
    } catch (err) {
      alert(err.message);
      setIsBriefingOpen(false);
    } finally {
      setBriefingLoading(false);
    }
  }

  async function handleSaveSettings() {
    try {
      const res = await fetch('/api/doctor/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          consultation_fee: parseFloat(settingFee),
          room_number: settingRoom,
          working_start: settingStart,
          working_end: settingEnd,
          slot_duration_minutes: parseInt(settingDuration)
        })
      });

      if (!res.ok) throw new Error('Failed to update schedule settings.');

      alert('✅ OPD Schedule and fee settings updated!');
      setIsSettingsOpen(false);
      loadDoctorProfile();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleRequestLeave() {
    if (!leaveDate) {
      alert('Please select a leave date.');
      return;
    }
    try {
      const res = await fetch('/api/doctor/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          leave_date: leaveDate,
          reason: leaveReason || 'Personal / Emergency Leave'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to submit leave.');

      alert(`🏖️ Leave recorded for ${leaveDate}. ${data.affected_appointments_cancelled} scheduled consultations were cancelled, and patients have been notified.`);
      setIsLeaveOpen(false);
      loadDoctorAppointments();
    } catch (err) {
      alert(err.message);
    }
  }

  // Auth Guard Page
  if (!token || (role !== 'doctor' && role !== 'admin')) {
    return (
      <div className="card" style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center' }}>
        <AlertTriangle size={48} style={{ color: 'var(--color-emergency)', marginBottom: '1rem' }} />
        <h2 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Restricted Access</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Doctor / Specialist authorization is required to access the SwasthyaCare Doctor Portal.
        </p>
        <button className="btn btn-primary" onClick={() => onOpenAuth('login')}>
          Log In as Doctor
        </button>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header Profile Summary */}
      {profile && (() => {
        const todayDateStr = new Date().toISOString().split('T')[0];
        const todayAppts = appointments.filter(a => a.appointment_date === todayDateStr);
        const totalToday = todayAppts.length;
        const completedToday = todayAppts.filter(a => a.status === 'completed').length;
        const completionRate = totalToday ? Math.round((completedToday / totalToday) * 100) : 0;

        return (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Dr. {profile.full_name} Workplace</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {profile.specialty} &bull; {profile.qualification} &bull; Room: {profile.room_number}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setIsSettingsOpen(true)}>
                  <Settings size={14} /> OPD Settings
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setIsLeaveOpen(true)}>
                  🏖️ Mark Leave
                </button>
              </div>
            </div>

            {/* Today's Stats Card */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-low-bg)', color: 'var(--color-low)', borderRadius: 'var(--radius-md)' }}>
                <UserCheck size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Today's OPD Completion</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.15rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{completionRate}%</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>({completedToday}/{totalToday} consultations)</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', marginTop: '0.4rem', overflow: 'hidden' }}>
                  <div style={{ width: `${completionRate}%`, height: '100%', backgroundColor: 'var(--color-low)' }}></div>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* OPD Schedule Panel */}
      <section className="card">
        <div className="page-header" style={{ marginBottom: '1.25rem' }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>
              <Calendar style={{ color: 'var(--color-secondary)' }} />
              Scheduled OPD Consultations
            </h3>
            <p className="page-subtitle" style={{ fontSize: '0.8rem' }}>Check patient summaries and log digital notes and prescriptions.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="form-control"
              style={{ width: '150px' }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            <select
              className="form-control"
              style={{ width: '150px' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {apptsLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading consultation schedule...</p>
        ) : appointments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No consultations found matching current filter.</p>
        ) : (
          <div className="table-responsive">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date & Time</th>
                  <th>AI Triage Urgency</th>
                  <th>Chief Symptoms</th>
                  <th>Status</th>
                  <th>Clinical Notes & Rx</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.patient_name}</strong></td>
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
                      <div style={{ maxWidth: '200px', fontSize: '0.85rem' }}>{a.symptom_summary || 'Routine checkup'}</div>
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
                          <span style={{ color: 'var(--text-light)' }}>No prescription issued</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleOpenConsult(a)}>
                          📋 Consult & Rx
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenBriefing(a)}>
                          ⚡ AI Briefing
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Profile Schedule Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay active" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsSettingsOpen(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.25rem', fontWeight: 800 }}>OPD Schedule Settings</h2>

            <div className="input-group">
              <label className="input-label">Consultation Fee (₹ INR)</label>
              <input
                type="number"
                className="form-control"
                value={settingFee}
                onChange={(e) => setSettingFee(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">OPD Consultation Room</label>
              <input
                type="text"
                className="form-control"
                value={settingRoom}
                onChange={(e) => setSettingRoom(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Working Hours Start</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="09:00"
                  value={settingStart}
                  onChange={(e) => setSettingStart(e.target.value)}
                />
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Working Hours End</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="17:00"
                  value={settingEnd}
                  onChange={(e) => setSettingEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">OPD Slot Duration (Minutes)</label>
              <input
                type="number"
                className="form-control"
                value={settingDuration}
                onChange={(e) => setSettingDuration(e.target.value)}
              />
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSaveSettings}>
              Update OPD Settings
            </button>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {isLeaveOpen && (
        <div className="modal-overlay active" onClick={() => setIsLeaveOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsLeaveOpen(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '0.5rem', fontWeight: 800 }}>Schedule Leaves & Absence</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              WARNING: Affected consultations on this date will be auto-cancelled and patients will be notified.
            </p>

            <div className="input-group">
              <label className="input-label">Leave Date</label>
              <input
                type="date"
                className="form-control"
                value={leaveDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setLeaveDate(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Absence Reason</label>
              <input
                type="text"
                className="form-control"
                placeholder="E.g., Medical Emergency, Training Seminar..."
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
              />
            </div>

            <button className="btn btn-danger" style={{ width: '100%' }} onClick={handleRequestLeave}>
              Confirm Absence & Cancel Schedule
            </button>
          </div>
        </div>
      )}

      {/* Consult & Rx Modifying Modal */}
      {isConsultOpen && selectedAppt && (
        <div className="modal-overlay active" onClick={() => setIsConsultOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsConsultOpen(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '0.25rem', fontWeight: 800 }}>Consultation Portal</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Patient: <strong>{selectedAppt.patient_name}</strong> &bull; Schedule: {selectedAppt.appointment_date}
            </p>

            <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Patient Stated Symptoms:</div>
              <div>{selectedAppt.symptom_summary || 'No pre-visit symptom brief logged.'}</div>
            </div>

            <div className="input-group">
              <label className="input-label">Clinical Evaluation & Diagnosis Notes</label>
              <textarea
                className="form-control"
                placeholder="Log patient symptoms, physical exam findings, and diagnosis..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Digital Rx Prescription Form</label>
              <textarea
                className="form-control"
                placeholder="E.g. Paracetamol 650mg (1-0-1) x 3 days, Cetirizine 10mg (0-0-1) x 5 days..."
                rows={3}
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Consultation Status</label>
              <select
                className="form-control"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="scheduled">Scheduled (Pending)</option>
                <option value="completed">Completed (Close Case)</option>
                <option value="cancelled">Cancelled (Absence / Refund)</option>
              </select>
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSaveConsult}>
              Save Records & Dispatch Rx
            </button>
          </div>
        </div>
      )}

      {/* Clinical AI Briefing Modal */}
      {isBriefingOpen && (
        <div className="modal-overlay active" onClick={() => setIsBriefingOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsBriefingOpen(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles style={{ color: 'var(--color-primary)' }} />
              Clinical AI Consultation Briefing
            </h2>

            {briefingLoading ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Generative AI analyzing triage context...</p>
            ) : briefingData ? (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-main)', borderLeft: '4px solid var(--color-secondary)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Chief Concern</div>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', marginTop: '0.15rem' }}>
                    {briefingData.summary?.split('\n')[0] || 'Patient Consultation Triage'}
                  </p>
                </div>

                {/* Red Flag Alert */}
                {(briefingData.summary?.toLowerCase().includes('high') || briefingData.summary?.toLowerCase().includes('emergency') || briefingData.summary?.toLowerCase().includes('critical')) && (
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-emergency-bg)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 'var(--radius-sm)', color: 'var(--color-emergency)', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <AlertTriangle size={16} />
                    <strong>Elevated Clinical Risk:</strong> Triage results recommend evaluation for potential emergency conditions.
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>AI Highlight Analysis</h4>
                  <ul style={{ paddingLeft: '1.25rem', marginTop: '0.4rem', fontSize: '0.85rem' }}>
                    {briefingData.summary?.split('\n').slice(1).filter(l => l.trim().length > 0).map((hl, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>{hl}</li>
                    )) || <li>Review general system review checklist.</li>}
                  </ul>
                </div>

                <div>
                  <h4 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Focus Recommendation</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.2rem', fontWeight: 600 }}>
                    {briefingData.recommended_focus || 'Assess vital statistics, review history, and evaluate symptom trends.'}
                  </p>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--color-emergency)' }}>Failed to load pre-visit briefing.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
