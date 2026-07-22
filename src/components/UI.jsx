import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { logoutUser } from '../supabase/services'
import { LEVEL_COLORS, LEVEL_FULL, LEVELS } from '../utils/theme'

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const ADMIN_NAV = [
  { id: 'dashboard',   icon: '⊞',  label: 'Dashboard'    },
  { id: 'curriculum',  icon: '📚', label: 'Curriculum'   },
  { id: 'students',    icon: '🎓', label: 'Students'     },
  { id: 'teachers',    icon: '👤', label: 'Teachers'     },
  { id: 'weeklyplan',  icon: '🗓️', label: 'Class Plans'  },
  { id: 'reports',     icon: '📊', label: 'Reports'      },
  { id: 'reportcard',  icon: '📄', label: 'Report Cards' },
]
const TEACHER_NAV = [
  { id: 'myclass',    icon: '⊞',  label: 'My Class'     },
  { id: 'weeklyplan', icon: '🗓️', label: 'Weekly Plan'  },
  { id: 'reports',    icon: '📊', label: 'Reports'      },
  { id: 'reportcard', icon: '📄', label: 'Report Cards' },
]

export function Sidebar({ active, onNav }) {
  const { profile } = useAuth()
  const role = profile?.role || 'teacher'
  const nav  = role === 'admin' ? ADMIN_NAV : TEACHER_NAV

  const handleLogout = async () => {
    await logoutUser()
  }

  return (
    <div className="sidebar">
      {/* Brand */}
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpeg" alt="Kamala Niketan" style={{width: 38, height: 38, borderRadius: 10, objectFit: 'cover'}} />
          <div>
            <div style={{ fontFamily: 'Playfair Display', fontSize: 13, fontWeight: 700, color: 'white', lineHeight: 1.2 }} className="brand-text">Kamala</div>
            <div style={{ fontFamily: 'Playfair Display', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.8)', lineHeight: 1.2 }} className="brand-text">Niketan</div>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase' }} className="nav-label">
          {role === 'admin' ? 'Administrator' : 'Teacher'}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 0' }}>
        {nav.map(item => (
          <div key={item.id}
            className={`nav-item ${active === item.id ? 'active' : ''}`}
            onClick={() => onNav(item.id)}>
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </div>
        ))}
      </nav>

      {/* User + logout */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'white', fontWeight: 700 }}>
            {(profile?.name || 'U')[0].toUpperCase()}
          </div>
          <div className="user-info">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'white', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.name || 'User'}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{profile?.className || (role === 'admin' ? 'Admin' : '')}</div>
          </div>
        </div>
        <button onClick={handleLogout}
          style={{ width: '100%', background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 8, padding: '7px', fontSize: 12, color: 'rgba(255,255,255,.8)', cursor: 'pointer', transition: 'all .18s' }}
          onMouseOver={e => e.target.style.background = 'rgba(255,255,255,.22)'}
          onMouseOut={e  => e.target.style.background = 'rgba(255,255,255,.12)'}>
          Sign out
        </button>
      </div>
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 36, center = false }) {
  const el = <div className="spinner" style={{ width: size, height: size }} />
  if (center) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>{el}</div>
  return el
}

// ─── Grade Badge ──────────────────────────────────────────────────────────────
export function GradeBadge({ grade }) {
  return <span className={`badge badge-${grade}`}>{grade}</span>
}

// ─── Level Pill (selectable) ──────────────────────────────────────────────────
export function LevelPill({ level, selected, onClick }) {
  return (
    <div
      className={`level-pill level-${level} ${selected ? 'level-sel' : ''}`}
      onClick={() => onClick(level)}
      title={LEVEL_FULL[level]}>
      {selected ? level : ''}
    </div>
  )
}

// ─── Level Pills Row header ───────────────────────────────────────────────────
export function LevelHeader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0 8px', borderBottom: '1px solid #EDF2F7', marginBottom: 4 }}>
      <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: .8 }}>Skill / Activity</div>
      {LEVELS.map(l => (
        <div key={l} style={{ width: 34, textAlign: 'center', fontSize: 11, fontWeight: 800, color: LEVEL_COLORS[l] }}>{l}</div>
      ))}
    </div>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 360, boxShadow: '0 20px 60px rgba(45,55,72,.2)', animation: 'slideUp .2s ease' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, color: '#2D3748', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button className="btn-danger" style={{ flex: 1, background: '#E53E3E', color: 'white', border: 'none', borderRadius: 10, padding: '10px', fontWeight: 600, cursor: 'pointer' }} onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page Header ──────────────────────────────────────────────────────────────
export function PageHeader({ role, title, subtitle, action }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="screen-label">{role === 'admin' ? 'Admin View' : 'Teacher View'}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'Playfair Display', fontSize: 26, fontWeight: 700, color: '#2D3748' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 14, color: '#718096', marginTop: 4 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
export function EmptyState({ icon = '📭', message, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 0', color: '#A0AEC0' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, marginBottom: action ? 20 : 0 }}>{message}</div>
      {action}
    </div>
  )
}

// ─── Search input ─────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A0AEC0', fontSize: 14 }}>🔍</span>
      <input
        className="form-input"
        style={{ paddingLeft: 36 }}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}
