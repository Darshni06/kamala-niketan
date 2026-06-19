// src/pages/teacher/MyClassPage.jsx — Supabase version
import { useState, useEffect } from 'react'
import { getStudentsByClass, getProgressByClass } from '../../supabase/services'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Spinner, GradeBadge, EmptyState } from '../../components/UI'
import ProgressModal from '../../components/ProgressModal'
import { exportLogsToExcel } from '../../utils/exportUtils'
import { GRADES, TEAL, PEACH } from '../../utils/theme'

export default function MyClassPage() {
  const { profile } = useAuth()
  const [students, setStudents] = useState([])
  const [records,  setRecords]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)
  const [section,  setSection]  = useState('All')
  const [error,    setError]    = useState('')

  const classId = profile?.classId || profile?.class_id

  const load = async () => {
    setLoading(true)
    try {
      const [studs, recs] = await Promise.all([
        getStudentsByClass(classId),
        getProgressByClass(classId),
      ])
      setStudents(studs)
      setRecords(recs)
    } catch (e) { setError('Failed to load class data: ' + e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (classId) load() }, [classId])

  const handleExport = () => exportLogsToExcel(records, students, classId)

  const byGrade = {
    PreKG: students.filter(s => s.grade === 'PreKG'),
    LKG:   students.filter(s => s.grade === 'LKG'),
    UKG:   students.filter(s => s.grade === 'UKG'),
  }

  const today    = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const todayStr = new Date().toISOString().split('T')[0]

  // Check if logged today — Supabase updated_at is ISO string
  // Safety: only count students that actually exist in the current class list
  const validStudentIds = new Set(students.map(s => s.id))
  const loggedTodayIds = new Set(
    records
      .filter(r => {
        const d  = r.updated_at ? new Date(r.updated_at) : null
        const sid = r.student_id || r.studentId
        return d && d.toISOString().split('T')[0] === todayStr && validStudentIds.has(sid)
      })
      .map(r => r.student_id || r.studentId)
  )

  const formatLastLogged = (studentId) => {
    if (loggedTodayIds.has(studentId)) return 'today'
    const recs = records.filter(r => (r.student_id || r.studentId) === studentId)
    if (!recs.length) return null
    const latest = recs.sort((a, b) =>
      new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
    )[0]
    const d = latest?.updated_at ? new Date(latest.updated_at) : null
    if (!d) return null
    const days = Math.floor((new Date() - d) / 86400000)
    if (days === 1) return 'yesterday'
    if (days < 7)  return `${days} days ago`
    return d.toLocaleDateString('en-IN')
  }

  if (loading) return <Spinner center />

  const gradesToShow = section === 'All' ? GRADES : [section]

  return (
    <div>
      <PageHeader
        role="teacher"
        title={`${classId} Class`}
        subtitle={`${today} · ${students.length} students`}
        action={
          <button className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={handleExport}>
            📥 Export Logs to Excel
          </button>
        }
      />

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Today summary */}
      <div className="glass" style={{ borderRadius: 12, padding: '12px 20px', marginBottom: 24, display: 'flex', gap: 24, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: TEAL }}>{loggedTodayIds.size}</div>
          <div style={{ fontSize: 12, color: '#718096' }}>Logged today</div>
        </div>
        <div style={{ width: 1, height: 36, background: '#EDF2F7' }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2D3748' }}>{Math.max(0, students.length - loggedTodayIds.size)}</div>
          <div style={{ fontSize: 12, color: '#718096' }}>Remaining</div>
        </div>
        <div style={{ width: 1, height: 36, background: '#EDF2F7' }} />
        <div style={{ flex: 1 }}>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{
              width: `${students.length ? Math.min(100, (loggedTodayIds.size / students.length) * 100) : 0}%`
            }} />
          </div>
          <div style={{ fontSize: 11, color: '#A0AEC0', marginTop: 4 }}>
            {students.length ? Math.min(100, Math.round((loggedTodayIds.size / students.length) * 100)) : 0}% of class logged today
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'rgba(255,255,255,.5)', padding: 4, borderRadius: 12, width: 'fit-content' }}>
        {['All', ...GRADES].map(s => (
          <div key={s} className={`tab ${section === s ? 'active' : ''}`} onClick={() => setSection(s)}>{s}</div>
        ))}
      </div>

      {students.length === 0 ? (
        <EmptyState icon="🎓" message="No students in this class yet. Ask your admin to add students." />
      ) : (
        gradesToShow.map(grade => {
          const list = byGrade[grade] || []
          if (list.length === 0) return null
          return (
            <div key={grade} style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <GradeBadge grade={grade} />
                <div style={{ flex: 1, height: 1, background: '#EDF2F7' }} />
                <span style={{ fontSize: 12, color: '#A0AEC0' }}>{list.length} students</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {list.map(s => {
                  const isToday    = loggedTodayIds.has(s.id)
                  const lastLogged = formatLastLogged(s.id)
                  return (
                    <div key={s.id} className="glass student-card" onClick={() => setModal(s)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: `linear-gradient(135deg, ${TEAL}22, ${PEACH}22)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 16, color: '#2D3748',
                        }}>{s.name[0]}</div>
                        {isToday && (
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#48BB78', background: 'rgba(72,187,120,.1)', padding: '3px 8px', borderRadius: 20 }}>
                            ✓ Done
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#2D3748', marginBottom: 3 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: '#A0AEC0', marginBottom: 12 }}>
                        {lastLogged
                          ? isToday
                            ? <span style={{ color: '#48BB78', fontWeight: 600 }}>Logged today</span>
                            : `Last: ${lastLogged}`
                          : <span style={{ color: '#E8876A' }}>Not yet logged</span>
                        }
                      </div>
                      <button className="btn-primary" style={{ width: '100%', padding: '7px', fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); setModal(s) }}>
                        Log Progress
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {modal && (
        <ProgressModal
          student={modal}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
