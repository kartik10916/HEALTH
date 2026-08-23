import React, { useState, useEffect } from 'react';
import HomeView from './components/HomeView';
import PatientView from './components/PatientView';
import DoctorView from './components/DoctorView';
import AdminView from './components/AdminView';
import AuthModal from './components/AuthModal';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [role, setRole] = useState(localStorage.getItem('role') || '');
  const [fullName, setFullName] = useState(localStorage.getItem('full_name') || '');
  const [userId, setUserId] = useState(localStorage.getItem('user_id') || '');
  
  const [currentView, setCurrentView] = useState('home');
  const [heroSymptoms, setHeroSymptoms] = useState('');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  // Synchronize authentication state
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedRole = localStorage.getItem('role');
    const storedName = localStorage.getItem('full_name');
    const storedId = localStorage.getItem('user_id');

    if (storedToken) {
      setToken(storedToken);
      setRole(storedRole || '');
      setFullName(storedName || '');
      setUserId(storedId || '');
    }
  }, []);

  function handleOpenAuth(mode = 'login') {
    setAuthMode(mode);
    setIsAuthOpen(true);
  }

  function handleAuthSuccess(data) {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('full_name', data.full_name);
    localStorage.setItem('user_id', data.user_id);

    setToken(data.access_token);
    setRole(data.role);
    setFullName(data.full_name);
    setUserId(data.user_id);

    // Auto navigate depending on role
    if (data.role === 'admin') setCurrentView('admin');
    else if (data.role === 'doctor') setCurrentView('doctor');
    else setCurrentView('patient');
  }

  async function handleQuickLogin(email, password, redirectView) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        handleAuthSuccess(data);
        setCurrentView(redirectView);
      } else {
        alert('Quick login failed: ' + (data.detail || 'Error'));
      }
    } catch (err) {
      alert('Quick login error: ' + err.message);
    }
  }

  function handleSymptomTriage(symptomsText) {
    setHeroSymptoms(symptomsText);
    setCurrentView('patient');
  }

  function handleLogout() {
    localStorage.clear();
    setToken('');
    setRole('');
    setFullName('');
    setUserId('');
    setCurrentView('home');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header Navigation */}
      <header className="app-header">
        <div className="brand-logo" onClick={() => setCurrentView('home')}>
          <div className="brand-icon">🏥</div>
          <span>SwasthyaCare AI <span className="india-badge">🇮🇳</span></span>
        </div>
        
        <ul className="nav-links">
          <li>
            <button 
              className={currentView === 'home' ? 'active' : ''} 
              onClick={() => setCurrentView('home')}
            >
              Home
            </button>
          </li>
          <li>
            <button 
              className={currentView === 'patient' ? 'active' : ''} 
              onClick={() => setCurrentView('patient')}
            >
              Patient Portal
            </button>
          </li>
          <li>
            <button 
              className={currentView === 'doctor' ? 'active' : ''} 
              onClick={() => setCurrentView('doctor')}
            >
              Doctor Portal
            </button>
          </li>
          <li>
            <button 
              className={currentView === 'admin' ? 'active' : ''} 
              onClick={() => setCurrentView('admin')}
            >
              Admin Command
            </button>
          </li>
        </ul>

        {token && fullName ? (
          <div className="user-profile-badge">
            <div className="user-avatar">{fullName.charAt(0).toUpperCase()}</div>
            <span className="user-name">{fullName}</span>
            <span className="role-pill">{role}</span>
            <button 
              className="btn btn-sm btn-outline" 
              style={{ color: '#fff', padding: '0.15rem 0.5rem', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent' }} 
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-outline" 
              style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.3)' }} 
              onClick={() => handleOpenAuth('login')}
            >
              Sign In
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => handleOpenAuth('register')}
            >
              Register ABHA
            </button>
          </div>
        )}
      </header>

      {/* Emergency Helpline Banner */}
      <div style={{ background: '#fff7ed', borderBottom: '1px solid #fed7aa', textAlign: 'center', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#c2410c' }}>
        🚑 Emergency Helpline: Dial <strong>108</strong> (Ambulance) or <strong>112</strong> (National Emergency Services) for immediate medical assistance.
      </div>

      {/* Main Container */}
      <main className="main-container">
        {currentView === 'home' && (
          <HomeView 
            onNavigate={setCurrentView} 
            onQuickLogin={handleQuickLogin}
            onSymptomTriage={handleSymptomTriage}
            isAuthenticated={!!token}
          />
        )}
        {currentView === 'patient' && (
          <PatientView 
            token={token} 
            onOpenAuth={handleOpenAuth}
            heroSymptoms={heroSymptoms}
            clearHeroSymptoms={() => setHeroSymptoms('')}
          />
        )}
        {currentView === 'doctor' && (
          <DoctorView 
            token={token} 
            role={role} 
            onOpenAuth={handleOpenAuth} 
          />
        )}
        {currentView === 'admin' && (
          <AdminView 
            token={token} 
            role={role} 
            onOpenAuth={handleOpenAuth} 
          />
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>&copy; 2026 SwasthyaCare AI Telemedicine Network &bull; Digital Health Mission India 🇮🇳</p>
      </footer>

      {/* Auth Modal overlay */}
      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        initialMode={authMode} 
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
