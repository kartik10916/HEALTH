import React, { useState, useEffect } from 'react';
import { ShieldAlert, Users, TrendingUp, Calendar, Search, Plus, X, ListTodo, ShieldCheck, Mail, Shield } from 'lucide-react';

export default function AdminView({ token, role, onOpenAuth }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Doctor Onboarding Modal
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);
  const [docName, setDocName] = useState('');
  const [docEmail, setDocEmail] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('General Medicine');
  const [docQualification, setDocQualification] = useState('MBBS');
  const [docExp, setDocExp] = useState(5);
  const [docFee, setDocFee] = useState(500);
  const [docRoom, setDocRoom] = useState('OPD-1');
  const [onboardError, setOnboardError] = useState('');

  useEffect(() => {
    if (token && role === 'admin') {
      loadStats();
      loadUsers();
      loadLogs();
    }
  }, [token, role, roleFilter]);

  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      let url = '/api/admin/users';
      if (roleFilter) url += `?role=${roleFilter}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/admin/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleToggleStatus(userId) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Action failed');
      }
      loadUsers();
      loadStats();
    } catch (err) {
      alert('Error toggling user status: ' + err.message);
    }
  }

  async function handleOnboardDoctor(e) {
    e.preventDefault();
    setOnboardError('');

    if (!docName || !docEmail || !docPassword) {
      setOnboardError('Name, email, and password are required fields.');
      return;
    }

    try {
      const res = await fetch('/api/admin/doctors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          full_name: docName,
          email: docEmail,
          password: docPassword,
          phone: docPhone,
          specialty: docSpecialty,
          qualification: docQualification,
          experience_years: parseInt(docExp),
          consultation_fee: parseFloat(docFee),
          room_number: docRoom,
          working_start: "09:00",
          working_end: "17:00"
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to onboard doctor.');

      alert(`🎉 Doctor ${docName} onboarded and registered successfully!`);
      setIsOnboardOpen(false);
      resetOnboardForm();
      loadStats();
      loadUsers();
    } catch (err) {
      setOnboardError(err.message);
    }
  }

  function resetOnboardForm() {
    setDocName('');
    setDocEmail('');
    setDocPassword('');
    setDocPhone('');
    setDocSpecialty('General Medicine');
    setDocQualification('MBBS');
    setDocExp(5);
    setDocFee(500);
    setDocRoom('OPD-1');
    setOnboardError('');
  }

  // Auth Guard Page
  if (!token || role !== 'admin') {
    return (
      <div className="card" style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center' }}>
        <ShieldAlert size={48} style={{ color: 'var(--color-emergency)', marginBottom: '1rem' }} />
        <h2 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Restricted Access</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Administrator authority is required to access the SwasthyaCare Admin Command.
        </p>
        <button className="btn btn-primary" onClick={() => onOpenAuth('login')}>
          Log In as Admin
        </button>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Command Center</h1>
          <p className="page-subtitle">Monitor platform telemetry, manage accounts, and audit dispatch logs.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsOnboardOpen(true)}>
          <Plus size={16} /> Onboard Specialist
        </button>
      </div>

      {/* Grid of Statistics Summary */}
      {stats && (
        <section className="grid-3" style={{ marginBottom: '2rem' }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: 'var(--radius-md)' }}>
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Patients</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.total_patients}</div>
            </div>
          </div>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-secondary-light)', color: 'var(--color-secondary)', borderRadius: 'var(--radius-md)' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Specialists</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.total_doctors}</div>
            </div>
          </div>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', borderRadius: 'var(--radius-md)' }}>
              <Calendar size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Today's Bookings</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.today_appointments}</div>
            </div>
          </div>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-gold-bg)', color: 'var(--color-gold)', borderRadius: 'var(--radius-md)' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Revenue Estimate</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>₹{stats.revenue_estimate?.toFixed(0)}</div>
            </div>
          </div>
        </section>
      )}

      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        {/* Triage Urgency Tracker */}
        {stats && (() => {
          const urgencyCounts = stats.urgency_distribution || {};
          const totalUrgency = (urgencyCounts.emergency || 0) + (urgencyCounts.high || 0) + (urgencyCounts.medium || 0) + (urgencyCounts.low || 0);
          const getPct = (val) => totalUrgency ? Math.round((val / totalUrgency) * 100) : 0;

          return (
            <div className="card">
              <h3 className="card-title">
                <ShieldAlert style={{ color: 'var(--color-emergency)' }} />
                Urgency Classification Tracker
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                Counts and percentages from live symptom checks matching clinical risk weights.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-emergency-bg)', border: '1px solid rgba(220,38,38,0.1)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <span className="badge badge-emergency">EMERGENCY</span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--color-emergency)' }}>
                    {urgencyCounts.emergency || 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{getPct(urgencyCounts.emergency || 0)}% of total</div>
                  <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '0.4rem', overflow: 'hidden' }}>
                    <div style={{ width: `${getPct(urgencyCounts.emergency || 0)}%`, height: '100%', backgroundColor: 'var(--color-emergency)' }}></div>
                  </div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-high-bg)', border: '1px solid rgba(234,88,12,0.1)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <span className="badge badge-high">HIGH</span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--color-high)' }}>
                    {urgencyCounts.high || 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{getPct(urgencyCounts.high || 0)}% of total</div>
                  <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '0.4rem', overflow: 'hidden' }}>
                    <div style={{ width: `${getPct(urgencyCounts.high || 0)}%`, height: '100%', backgroundColor: 'var(--color-high)' }}></div>
                  </div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-medium-bg)', border: '1px solid rgba(217,119,6,0.1)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <span className="badge badge-medium">MEDIUM</span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--color-medium)' }}>
                    {urgencyCounts.medium || 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{getPct(urgencyCounts.medium || 0)}% of total</div>
                  <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '0.4rem', overflow: 'hidden' }}>
                    <div style={{ width: `${getPct(urgencyCounts.medium || 0)}%`, height: '100%', backgroundColor: 'var(--color-medium)' }}></div>
                  </div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-low-bg)', border: '1px solid rgba(5,150,105,0.1)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <span className="badge badge-low">LOW</span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--color-low)' }}>
                    {urgencyCounts.low || 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{getPct(urgencyCounts.low || 0)}% of total</div>
                  <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', marginTop: '0.4rem', overflow: 'hidden' }}>
                    <div style={{ width: `${getPct(urgencyCounts.low || 0)}%`, height: '100%', backgroundColor: 'var(--color-low)' }}></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}


        {/* User Account Registry */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <Users style={{ color: 'var(--color-secondary)' }} />
              User Account Directory
            </h3>
            <select
              className="form-control"
              style={{ width: '150px' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="patient">Patients</option>
              <option value="doctor">Doctors</option>
              <option value="admin">Administrators</option>
            </select>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '250px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
            {usersLoading ? (
              <p style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading registry...</p>
            ) : (
              <table className="app-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>#{u.id}</td>
                      <td><strong>{u.full_name}</strong></td>
                      <td>{u.email}</td>
                      <td><span className="role-pill" style={{ fontSize: '0.6rem' }}>{u.role}</span></td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-completed' : 'badge-cancelled'}`} style={{ fontSize: '0.65rem' }}>
                          {u.is_active ? 'ACTIVE' : 'BLOCKED'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }} onClick={() => handleToggleStatus(u.id)}>
                          {u.is_active ? 'Block' : 'Unblock'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Audit Dispatch Logs */}
      <section className="card">
        <h3 className="card-title">
          <ListTodo style={{ color: 'var(--color-primary)' }} />
          Notification System Logs (Audit Trail)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          Record of automated email dispatches and reminders with delivery statuses.
        </p>

        {logsLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading system audit trail...</p>
        ) : logs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No audit logs recorded yet.</p>
        ) : (
          <div className="table-responsive" style={{ maxHeight: '260px', overflowY: 'auto' }}>
            <table className="app-table">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>User ID</th>
                  <th>Channel</th>
                  <th>Title / Event</th>
                  <th>Dispatched Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>#{l.id}</td>
                    <td>User #{l.user_id}</td>
                    <td><span className="badge badge-scheduled" style={{ fontSize: '0.65rem' }}>{l.channel?.toUpperCase()}</span></td>
                    <td><strong>{l.title}</strong></td>
                    <td>{new Date(l.sent_at).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${l.status === 'sent' || l.status === 'success' ? 'badge-completed' : 'badge-cancelled'}`} style={{ fontSize: '0.65rem' }}>
                        {l.status?.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Doctor Onboarding Modal */}
      {isOnboardOpen && (
        <div className="modal-overlay active" onClick={() => setIsOnboardOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsOnboardOpen(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.25rem', fontWeight: 800 }}>Onboard Medical Specialist</h2>

            <form onSubmit={handleOnboardDoctor}>
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Dr. Animesh Sen"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="input-group">
                  <label className="input-label">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="dr.sen@swasthya.in"
                    value={docEmail}
                    onChange={(e) => setDocEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={docPassword}
                    onChange={(e) => setDocPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Phone Number (+91)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="+91 94567 12345"
                  value={docPhone}
                  onChange={(e) => setDocPhone(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="input-group">
                  <label className="input-label">Specialty</label>
                  <select
                    className="form-control"
                    value={docSpecialty}
                    onChange={(e) => setDocSpecialty(e.target.value)}
                  >
                    <option value="General Medicine">General Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Ayush & Ayurvedic Care">Ayush & Ayurveda</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Qualification</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="MBBS, MD"
                    value={docQualification}
                    onChange={(e) => setDocQualification(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="input-group">
                  <label className="input-label">Experience (Years)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={docExp}
                    onChange={(e) => setDocExp(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Consultation Fee (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={docFee}
                    onChange={(e) => setDocFee(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">OPD Consultation Room</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="OPD-3"
                  value={docRoom}
                  onChange={(e) => setDocRoom(e.target.value)}
                />
              </div>

              {onboardError && (
                <div className="app-alert app-alert-danger" style={{ marginBottom: '1rem' }}>
                  {onboardError}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Register & Onboard Specialist
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
