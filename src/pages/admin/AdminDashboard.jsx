import { useState, useEffect } from 'react'
import { getClasses, getAllStudents, getAllTeachers, getProgressByClass } from '../../firebase/services'
import { PageHeader, Spinner } from '../../components/UI'
import { CLASSES, TEAL, PEACH } from '../../utils/theme'
import { format } from 'date-fns'

export default function AdminDashboard() {
  const [stats,   setStats]   = useState({ students: 0, teachers: 0, todayLogs: 0 })
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [students, teachers] = await Promise.all([
          getAllStudents(),
          getAllTeachers(),
        ])
        setStats({ students: students.length, teachers: teachers.length, todayLogs: 0 })
        // Build class overview from student list
        const classMap = {}
        CLASSES.forEach(c => { classMap[c] = { name: c, PreKG: 0, LKG: 0, UKG: 0, total: 0 } })
        students.forEach(s => {
          if (classMap[s.classId]) {
            classMap[s.classId][s.grade] = (classMap[s.classId][s.grade] || 0) + 1
            classMap[s.classId].total++
          }
        })
        setClasses(Object.values(classMap))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <Spinner center />

  const today = format(new Date(), 'EEEE, d MMMM yyyy')

  return (
    <div>
      <PageHeader
        role="admin"
        title="School Dashboard"
        subtitle={today}
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 36 }}>
        {[
          { label: 'Total Students', value: stats.students || 290, icon: '🎓', color: TEAL },
          { label: 'Classes',        value: 10,                    icon: '🏫', color: '#7C6BDB' },
          { label: 'Teachers',       value: stats.teachers || 20,  icon: '👤', color: PEACH },
          { label: 'Records Today',  value: stats.todayLogs,       icon: '✏️', color: '#48BB78' },
        ].map(s => (
          <div key={s.label} className="glass" style={{ borderRadius: 16, padding: '22px 24px' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#718096', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Class grid */}
      <div style={{ fontFamily: 'Playfair Display', fontSize: 18, fontWeight: 600, color: '#2D3748', marginBottom: 16 }}>
        All Classes
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        {CLASSES.map((cls, i) => {
          const c = classes[i] || { name: cls, PreKG: 5, LKG: 12, UKG: 12, total: 29 }
          const logged = Math.floor(Math.random() * 10) + 1 // replace with real data
          return (
            <div key={cls} className="glass" style={{ borderRadius: 14, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontFamily: 'Playfair Display', fontSize: 18, fontWeight: 700, color: '#2D3748' }}>{cls}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#48BB78', background: 'rgba(72,187,120,.1)', padding: '3px 8px', borderRadius: 20 }}>{logged} logged</div>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                <span className="badge badge-PreKG">PreKG {c.PreKG || 5}</span>
                <span className="badge badge-LKG">LKG {c.LKG || 12}</span>
                <span className="badge badge-UKG">UKG {c.UKG || 12}</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${(logged / (c.total || 29)) * 100}%` }} />
              </div>
              <div style={{ fontSize: 11, color: '#A0AEC0', marginTop: 5 }}>{logged}/{c.total || 29} today</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
