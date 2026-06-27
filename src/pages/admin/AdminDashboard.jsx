// src/pages/admin/AdminDashboard.jsx — Supabase version
import { useState, useEffect } from 'react'
import { getAllStudents, getAllTeachers, getAllProgress } from '../../supabase/services'
import { PageHeader, Spinner } from '../../components/UI'
import { TEAL, PEACH } from '../../utils/theme'
import { format } from 'date-fns'

export default function AdminDashboard() {
  const [loading,   setLoading]   = useState(true)
  const [students,  setStudents]  = useState([])
  const [teachers,  setTeachers]  = useState([])
  const [progress,  setProgress]  = useState([])
  const [classMap,  setClassMap]  = useState({}) // classId → { students, grades, loggedToday }
  const [error,     setError]     = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [studs, tchs, progs] = await Promise.all([
          getAllStudents(),
          getAllTeachers(),
          getAllProgress(),
        ])
        setStudents(studs)
        setTeachers(tchs)
        setProgress(progs)

        // Build class map from actual student data
        const todayStr = new Date().toISOString().split('T')[0]
        const map = {}
        studs.forEach(s => {
          const cid = s.class_id || s.classId
          if (!cid) return
          if (!map[cid]) map[cid] = { classId: cid, students: [], loggedTodayIds: new Set() }
          map[cid].students.push(s)
        })
        // Mark who was logged today
        progs.forEach(r => {
          const cid = r.class_id
          const sid = r.student_id
          if (!cid || !map[cid]) return
          const d = r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : null
          if (d === todayStr) map[cid].loggedTodayIds.add(sid)
        })
        setClassMap(map)
      } catch (e) { setError('Failed to load: ' + e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const todayStr  = new Date().toISOString().split('T')[0]
  const todayLogs = progress.filter(r => {
    const d = r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : null
    return d === todayStr
  })
  const uniqueLoggedToday = new Set(todayLogs.map(r => r.student_id)).size

  const classes = Object.values(classMap).sort((a, b) => a.classId.localeCompare(b.classId))

  if (loading) return <Spinner center />

  return (
    <div>
      <div className="screen-label">Admin View</div>
      <div style={{ fontFamily: 'Playfair Display', fontSize: 26, fontWeight: 700, color: '#2D3748', marginBottom: 4 }}>
        School Dashboard
      </div>
      <div style={{ fontSize: 14, color: '#718096', marginBottom: 28 }}>
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 36 }}>
        {[
          { label: 'Total Students', value: students.length,  icon: '🎓', color: TEAL     },
          { label: 'Classes',        value: classes.length,   icon: '🏫', color: '#7C6BDB' },
          { label: 'Teachers',       value: teachers.length,  icon: '👤', color: PEACH     },
          { label: 'Records Today',  value: todayLogs.length, icon: '✏️', color: '#48BB78' },
        ].map(s => (
          <div key={s.label} className="glass" style={{ borderRadius: 16, padding: '22px 24px' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#718096', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Class grid — only classes that have students */}
      <div style={{ fontFamily: 'Playfair Display', fontSize: 18, fontWeight: 600, color: '#2D3748', marginBottom: 16 }}>
        Active Classes
      </div>

      {classes.length === 0 ? (
        <div className="glass" style={{ borderRadius: 14, padding: 32, textAlign: 'center', color: '#A0AEC0' }}>
          No students added yet. Go to Students → Add Student or Import Excel.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {classes.map(cls => {
            const total     = cls.students.length
            const logged    = cls.loggedTodayIds.size
            const pct       = total > 0 ? Math.round((logged / total) * 100) : 0
            const prekg     = cls.students.filter(s => s.grade === 'PreKG').length
            const lkg       = cls.students.filter(s => s.grade === 'LKG').length
            const ukg       = cls.students.filter(s => s.grade === 'UKG').length
            return (
              <div key={cls.classId} className="glass" style={{ borderRadius: 14, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ fontFamily: 'Playfair Display', fontSize: 20, fontWeight: 700, color: '#2D3748' }}>
                    {cls.classId}
                  </div>
                  {logged > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#48BB78', background: 'rgba(72,187,120,.1)', padding: '3px 8px', borderRadius: 20 }}>
                      {logged} logged
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                  {prekg > 0 && <span className="badge badge-PreKG">PreKG {prekg}</span>}
                  {lkg   > 0 && <span className="badge badge-LKG">LKG {lkg}</span>}
                  {ukg   > 0 && <span className="badge badge-UKG">UKG {ukg}</span>}
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div style={{ fontSize: 11, color: '#A0AEC0', marginTop: 5 }}>
                  {logged}/{total} logged today
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
