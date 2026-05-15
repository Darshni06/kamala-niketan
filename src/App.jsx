import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Sidebar, Spinner } from './components/UI'
import { useState } from 'react'

// Pages
import LoginPage      from './pages/LoginPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import CurriculumPage from './pages/admin/CurriculumPage'
import StudentsPage   from './pages/admin/StudentsPage'
import TeachersPage   from './pages/admin/TeachersPage'
import ReportsPage    from './pages/shared/ReportsPage'
import ReportCardPage from './pages/shared/ReportCardPage'
import MyClassPage    from './pages/teacher/MyClassPage'

// ── Protected layout wrapper ──────────────────────────────────────────────────
function AppLayout({ children, screen, onNav }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={screen} onNav={onNav} />
      <div className="main">{children}</div>
    </div>
  )
}

// ── Admin routes ──────────────────────────────────────────────────────────────
function AdminApp() {
  const [screen, setScreen] = useState('dashboard')
  const screenMap = {
    dashboard:  <AdminDashboard />,
    curriculum: <CurriculumPage />,
    students:   <StudentsPage />,
    teachers:   <TeachersPage />,
    reports:    <ReportsPage role="admin" />,
    reportcard: <ReportCardPage role="admin" />,
  }
  return (
    <AppLayout screen={screen} onNav={setScreen}>
      {screenMap[screen] || <AdminDashboard />}
    </AppLayout>
  )
}

// ── Teacher routes ────────────────────────────────────────────────────────────
function TeacherApp() {
  const [screen, setScreen] = useState('myclass')
  const screenMap = {
    myclass:    <MyClassPage />,
    reports:    <ReportsPage role="teacher" />,
    reportcard: <ReportCardPage role="teacher" />,
  }
  return (
    <AppLayout screen={screen} onNav={setScreen}>
      {screenMap[screen] || <MyClassPage />}
    </AppLayout>
  )
}

// ── Root guard ────────────────────────────────────────────────────────────────
function Root() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🪷</div>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      </div>
    )
  }

  if (!user || !profile) return <LoginPage />

  if (profile.role === 'admin')   return <AdminApp />
  if (profile.role === 'teacher') return <TeacherApp />

  // Unknown role — show login
  return <LoginPage />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<Root />} />
      </Routes>
    </BrowserRouter>
  )
}
