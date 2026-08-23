import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Phone, Shield, FileText } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, initialMode = 'login', onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [abhaId, setAbhaId] = useState('');
  const [role, setRole] = useState('patient');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [errorMsg, setErrorMsg] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');

  // Sync mode state with initialMode prop
  useEffect(() => {
    setMode(initialMode);
    setErrorMsg('');
  }, [initialMode, isOpen]);

  // Fetch Google Client ID and initialize library if available
  useEffect(() => {
    if (!isOpen) return;

    async function initGoogleAuth() {
      try {
        const res = await fetch('/api/auth/google/config');
        const data = await res.json();
        if (data.client_id) {
          setGoogleClientId(data.client_id);
          if (window.google && window.google.accounts) {
            window.google.accounts.id.initialize({
              client_id: data.client_id,
              callback: handleGoogleCallback,
              auto_select: false,
              cancel_on_tap_outside: true
            });

            // Render Google official button in container if present
            setTimeout(() => {
              const btnContainer = document.getElementById('googleSignInBtnDiv');
              if (btnContainer && window.google?.accounts?.id) {
                btnContainer.innerHTML = '';
                window.google.accounts.id.renderButton(btnContainer, {
                  type: 'standard',
                  theme: 'outline',
                  size: 'large',
                  text: mode === 'register' ? 'signup_with' : 'signin_with',
                  shape: 'rectangular',
                  logo_alignment: 'left',
                  width: '320'
                });
              }
            }, 100);
          }
        }
      } catch (err) {
        console.warn('Google auth configuration error:', err);
      }
    }
    initGoogleAuth();
  }, [isOpen, mode, role]);

  async function handleGoogleCallback(response) {
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
          role: role
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Google sign-in verification failed.');

      onSuccess(data);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  async function loginWithGoogle() {
    if (googleClientId && window.google && window.google.accounts) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          demoGoogleSignIn();
        }
      });
    } else {
      demoGoogleSignIn();
    }
  }

  async function demoGoogleSignIn() {
    const promptEmail = prompt("Enter Google Account Email:", "rahul.verma.google@gmail.com");
    if (!promptEmail) return;
    const promptName = prompt("Enter Full Name:", "Rahul Verma (Google)");
    if (!promptName) return;

    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: promptEmail,
          full_name: promptName,
          google_id: "google_id_" + Date.now(),
          role: role
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Mock Google login failed.');

      onSuccess(data);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const bodyData = mode === 'login'
      ? { email, password }
      : {
          email,
          password,
          full_name: fullName,
          phone,
          abha_id: abhaId || null,
          role,
          date_of_birth: dob || null,
          gender: role === 'patient' ? gender : null,
          blood_group: role === 'patient' ? bloodGroup : null
        };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      if (!res.ok) {
        let errorDetail = `Authentication failed (${res.status})`;
        try {
          const errData = await res.json();
          errorDetail = errData.detail || errorDetail;
        } catch (_) {}
        throw new Error(errorDetail);
      }

      const data = await res.json();
      onSuccess(data);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <h2 style={{ marginBottom: '1.5rem', fontWeight: 800 }}>
          {mode === 'login' ? 'Sign In to SwasthyaCare' : 'Create SwasthyaCare Account'}
        </h2>

        {/* Google Sign In Option */}
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div id="googleSignInBtnDiv" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>
          {(!googleClientId || !window.google) && (
            <button type="button" className="btn-google" onClick={loginWithGoogle}>
              <svg className="google-icon" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{mode === 'register' ? 'Sign up with Google' : 'Continue with Google'}</span>
            </button>
          )}
        </div>

        <div className="divider-with-text">or continue with credentials</div>

        <form onSubmit={handleAuthSubmit}>
          {mode === 'register' && (
            <>
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-light)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Rahul Verma or Dr. Rajesh Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{ paddingLeft: '32px' }}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Phone Number (+91)</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-light)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ paddingLeft: '32px' }}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Account Role</label>
                <div style={{ position: 'relative' }}>
                  <Shield size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-light)' }} />
                  <select
                    className="form-control"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ paddingLeft: '32px' }}
                  >
                    <option value="patient">Patient</option>
                    <option value="doctor">Doctor</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              {role === 'patient' && (
                <>
                  <div className="input-group">
                    <label className="input-label">ABHA Health ID (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <FileText size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-light)' }} />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="14-8765-4321-9012"
                        value={abhaId}
                        onChange={(e) => setAbhaId(e.target.value)}
                        style={{ paddingLeft: '32px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div className="input-group">
                      <label className="input-label">Date of Birth</label>
                      <input
                        type="date"
                        className="form-control"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                      />
                    </div>
                    <div className="input-group">
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

                  <div className="input-group">
                    <label className="input-label">Blood Group</label>
                    <select
                      className="form-control"
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                    >
                      <option value="O+">O+</option>
                      <option value="A+">A+</option>
                      <option value="B+">B+</option>
                      <option value="AB+">AB+</option>
                      <option value="O-">O-</option>
                      <option value="A-">A-</option>
                      <option value="B-">B-</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </>
              )}
            </>
          )}

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-light)' }} />
              <input
                type="email"
                className="form-control"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '32px' }}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-light)' }} />
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '32px' }}
                required
              />
            </div>
          </div>

          {errorMsg && (
            <div className="app-alert app-alert-danger" style={{ marginBottom: '1rem' }}>
              {errorMsg}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.7rem' }}>
            {mode === 'login' ? 'Sign In' : 'Register Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.85rem', marginTop: '1.25rem', color: 'var(--text-muted)' }}>
          <span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setMode(mode === 'login' ? 'register' : 'login');
              setErrorMsg('');
            }}
            style={{ fontWeight: 700 }}
          >
            {mode === 'login' ? 'Create Account' : 'Sign In'}
          </a>
        </p>
      </div>
    </div>
  );
}
