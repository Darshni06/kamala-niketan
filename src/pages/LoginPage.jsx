// src/pages/LoginPage.jsx — Supabase version
import { useState } from 'react'
import { loginUser } from '../supabase/services'
import { useAuth } from '../contexts/AuthContext'
import { TEAL } from '../utils/theme'

export default function LoginPage() {
  const [role,    setRole]    = useState('teacher')
  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !pass) { setError('Please enter your email and password.'); return }
    setLoading(true); setError('')
    try {
      await loginUser(email.trim(), pass)
      // AuthContext picks up session automatically via onAuthStateChange
    } catch (err) {
      const msg = err.message?.includes('Invalid login')
        ? 'Incorrect email or password.'
        : err.message || 'Login failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #e8f7f6 0%, #fef5f0 100%)',
      backgroundImage: 'radial-gradient(circle at 70% 20%, rgba(59,191,178,.15) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(232,135,106,.12) 0%, transparent 50%)',
      padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.jpeg" alt="Kamala Niketan"
            style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', marginBottom: 12 }}
            onError={e => { e.target.style.display='none' }} />
          <div style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: '#2D3748' }}>
            Kamala Niketan
          </div>
          <div style={{ fontSize: 14, color: '#718096', marginTop: 4 }}>Student Progress Tracker</div>
        </div>

        <div className="glass" style={{ borderRadius: 20, padding: 36 }}>
          <div style={{ fontFamily: 'Playfair Display', fontSize: 20, fontWeight: 600, color: '#2D3748', marginBottom: 20 }}>
            Sign in
          </div>

          {/* Role picker */}
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">I am a</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['teacher','admin'].map(r => (
                <div key={r} onClick={() => setRole(r)}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: `2px solid ${role === r ? TEAL : '#E2E8F0'}`,
                    background: role === r ? 'rgba(59,191,178,.08)' : 'white',
                    color: role === r ? TEAL : '#718096',
                    fontWeight: 600, fontSize: 14, transition: 'all .18s',
                  }}>
                  {r === 'teacher' ? '👤 Teacher' : '🔑 Admin'}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={pass} onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            {error && <div className="error-box">{error}</div>}
            <button className="btn-primary"
              style={{ width: '100%', padding: 13, marginTop: 4, fontSize: 15 }}
              onClick={handleLogin} disabled={loading}>
              {loading ? 'Signing in…' : `Sign In as ${role === 'teacher' ? 'Teacher' : 'Admin'}`}
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#A0AEC0' }}>
            Forgot password? Contact your administrator.
          </div>
        </div>
      </div>
    </div>
  )
}
