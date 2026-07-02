import { useState, useEffect, useMemo } from 'react'
import { getProgressByClass, getAllStudents, getStudentsByClass, getAllProgress } from '../../firebase/services'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Spinner } from '../../components/UI'
import { LEVEL_COLORS, LEVEL_FULL, CLASSES, GRADES, TEAL } from '../../utils/theme'
import { exportObservationsToExcel } from '../../utils/exportUtils'
import { getAllStudents, getProgressByClass } from '../../supabase/services'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer,
} from 'recharts'

function ChartLegend() {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
      {['M','A','R','P'].map(l => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: LEVEL_COLORS[l] }} />
          <span style={{ color: '#718096' }}>{l} — {LEVEL_FULL[l]}</span>
        </div>
      ))}
    </div>
  )
}

function EmptyChart({ message = 'No data yet for the selected filters.' }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#A0AEC0' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 14 }}>{message}</div>
    </div>
  )
}

export default function ReportsPage({ role }) {
  const { profile } = useAuth()

  const GRAPH_TYPES = [
    { id: 'stacked',   icon: '▦', label: 'Stacked Bar'      },
    { id: 'line',      icon: '↗', label: 'Progress Line'     },
    { id: 'donut',     icon: '◎', label: 'Donut / Pie'       },
    { id: 'heatmap',   icon: '⊞', label: 'Heatmap'           },
    { id: 'classcomp', icon: '⧖', label: 'Class Comparison'  },
  ]
  const [graphType,   setGraphType]   = useState('stacked')
  const [drillSubject, setDrillSubject] = useState(null) // null = show subjects, string = show categories of that subject
  const [classFilter, setClassFilter] = useState(role === 'teacher' ? profile?.classId : 'All')
  const [gradeFilter, setGradeFilter] = useState('All')
  const [termFilter,  setTermFilter]  = useState('All')
  const [allRecords,    setAllRecords]    = useState([])
  const [allStudents,   setAllStudents]   = useState([])
  const [loading,       setLoading]       = useState(true)
  const [classCompData, setClassCompData] = useState([])
  const [allNotes,      setAllNotes]      = useState([])
  const [exportingObs,  setExportingObs]  = useState(false)

  // Fetch data when class filter changes
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const classId = role === 'teacher'
          ? profile?.classId
          : (classFilter !== 'All' ? classFilter : null)

        const [recs, studs] = await Promise.all([
          classId ? getProgressByClass(classId) : getAllProgress(),
          classId ? getStudentsByClass(classId) : getAllStudents(),
        ])
        setAllRecords(recs)
        setAllStudents(studs)

        // FIX 3: Build class comparison data — for admin only
        if (role === 'admin') {
          // Get all progress grouped by class
          const allProg = recs.length ? recs : []
          const classIds = [...new Set(allProg.map(r => r.class_id).filter(Boolean))].sort()
          const compData = classIds.map(cls => {
            const clsRecs = allProg.filter(r => r.class_id === cls)
            const total   = clsRecs.length || 1
            // Average level score per class: M=1,A=2,R=3,P=4
            const weight  = { M:1, A:2, R:3, P:4 }
            const avg     = clsRecs.reduce((s,r) => s + (weight[r.level]||0), 0) / total
            return { class: cls, avgScore: parseFloat(avg.toFixed(2)), total: clsRecs.length }
          })
          setClassCompData(compData)

          // FIX 2: fetch all teacher notes for admin export
          const { data: notes } = await import('../../supabase/client')
            .then(({ supabase }) => supabase.from('teacher_notes').select('*').order('month'))
          setAllNotes(notes || [])
        }
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [classFilter, role])

  // Apply grade + term filters client-side
  const records = useMemo(() => {
    return allRecords.filter(r => {
      const gradeOk = gradeFilter === 'All' || r.grade === gradeFilter
      const termOk  = termFilter  === 'All' || r.term  === termFilter
      return gradeOk && termOk
    })
  }, [allRecords, gradeFilter, termFilter])

  const students = useMemo(() => {
    return gradeFilter === 'All'
      ? allStudents
      : allStudents.filter(s => s.grade === gradeFilter)
  }, [allStudents, gradeFilter])

  // ── Chart data — all derived from filtered records ────────────────────────

  // Stacked bar — per student
  const studentData = students.slice(0, 10).map(s => {
    const sRecs = records.filter(r => r.studentId === s.id)
    const counts = { name: s.name.split(' ')[0], M: 0, A: 0, R: 0, P: 0 }
    sRecs.forEach(r => { if (counts[r.level] !== undefined) counts[r.level]++ })
    return counts
  }).filter(d => d.M + d.A + d.R + d.P > 0)

  // Line — term trend
  const termTrend = ['T1', 'T2', 'T3'].map(t => {
    const tRecs = allRecords.filter(r =>
      r.term === t &&
      (gradeFilter === 'All' || r.grade === gradeFilter)
    )
    const out = { term: t === 'T1' ? 'Term 1' : t === 'T2' ? 'Term 2' : 'Term 3', M: 0, A: 0, R: 0, P: 0 }
    tRecs.forEach(r => { if (out[r.level] !== undefined) out[r.level]++ })
    return out
  })

  // Donut
  const donutData = ['M', 'A', 'R', 'P'].map(l => ({
    name: LEVEL_FULL[l],
    value: records.filter(r => r.level === l).length,
    color: LEVEL_COLORS[l],
  })).filter(d => d.value > 0)

  // Heatmap — subject × level counts (uses subjectName from 4-layer structure)
  const subjectNames = [...new Set(records.map(r => r.subjectName))].filter(Boolean)
  const heatData = subjectNames.map(subject => {
    const sRecs = records.filter(r => r.subjectName === subject)
    const row = { subject: subject.length > 18 ? subject.slice(0, 17) + '…' : subject }
    ;['M','A','R','P'].forEach(l => { row[l] = sRecs.filter(r => r.level === l).length })
    return row
  })

  // ── Render ────────────────────────────────────────────────────────────────
  const renderChart = () => {
    if (loading) return <Spinner center />

    if (graphType === 'stacked') {
      if (studentData.length === 0) return <EmptyChart />
      return (
        <div>
          <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Student Level Distribution</div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>
            Records at each level per student {gradeFilter !== 'All' ? `· ${gradeFilter}` : ''} {termFilter !== 'All' ? `· ${termFilter}` : ''}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={studentData} margin={{ top: 0, right: 10, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="M" stackId="a" fill={LEVEL_COLORS.M} name={LEVEL_FULL.M} />
              <Bar dataKey="A" stackId="a" fill={LEVEL_COLORS.A} name={LEVEL_FULL.A} />
              <Bar dataKey="R" stackId="a" fill={LEVEL_COLORS.R} name={LEVEL_FULL.R} />
              <Bar dataKey="P" stackId="a" fill={LEVEL_COLORS.P} name={LEVEL_FULL.P} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <ChartLegend />
        </div>
      )
    }

    if (graphType === 'line') {
      const hasData = termTrend.some(t => t.M + t.A + t.R + t.P > 0)
      if (!hasData) return <EmptyChart />
      return (
        <div>
          <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Progress Over Terms</div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>
            Level counts across Term 1, 2, 3 {gradeFilter !== 'All' ? `· ${gradeFilter}` : ''}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={termTrend} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
              <XAxis dataKey="term" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              {['M','A','R','P'].map(l => (
                <Line key={l} type="monotone" dataKey={l} stroke={LEVEL_COLORS[l]}
                  strokeWidth={2.5} dot={{ r: 5, fill: LEVEL_COLORS[l] }} name={LEVEL_FULL[l]} />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <ChartLegend />
        </div>
      )
    }

    if (graphType === 'donut') {
      if (donutData.length === 0) return <EmptyChart />
      const total = donutData.reduce((s, d) => s + d.value, 0)
      return (
        <div>
          <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Level Distribution</div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>
            Share of records at each level {gradeFilter !== 'All' ? `· ${gradeFilter}` : ''} {termFilter !== 'All' ? `· ${termFilter}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  dataKey="value" paddingAngle={2}>
                  {donutData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v + ' records', n]} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {donutData.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color }} />
                  <span style={{ fontSize: 13, color: '#4A5568' }}>{d.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: d.color }}>{d.value}</span>
                  <span style={{ fontSize: 11, color: '#A0AEC0' }}>({Math.round(d.value/total*100)}%)</span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: '#718096', marginTop: 4, borderTop: '1px solid #EDF2F7', paddingTop: 8 }}>
                Total: {total} records
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (graphType === 'heatmap') {
      if (heatData.length === 0) return <EmptyChart message="No data yet. Log some progress first." />

      // Drilldown: if a subject is selected, show its categories
      const isDrilling = !!drillSubject
      const tableRows = isDrilling
        ? (() => {
            // Category breakdown for drilled subject
            // FIX 4: use both snake_case and camelCase field names for category
            const getCatName = r => r.category_name || r.categoryName || ''
            const catNames = [...new Set(
              records
                .filter(r => (r.subject_name || r.subjectName) === drillSubject && (gradeFilter === 'All' || r.grade === gradeFilter) && (termFilter === 'All' || r.term === termFilter))
                .map(getCatName)
            )].filter(Boolean)
            return catNames.map(cat => {
              const cRecs = records.filter(r =>
                (r.subject_name || r.subjectName) === drillSubject &&
                getCatName(r) === cat &&
                (gradeFilter === 'All' || r.grade === gradeFilter) &&
                (termFilter === 'All' || r.term === termFilter)
              )
              const row = { label: cat }
              ;['M','A','R','P'].forEach(l => { row[l] = cRecs.filter(r => r.level === l).length })
              return row
            })
          })()
        : heatData.map(d => ({ ...d, label: d.subject }))

      const maxVal = Math.max(...tableRows.flatMap(r => ['M','A','R','P'].map(l => r[l])), 1)

      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            {isDrilling && (
              <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}
                onClick={() => setDrillSubject(null)}>
                ← Back to Subjects
              </button>
            )}
            <div style={{ fontWeight: 600, color: '#2D3748' }}>
              {isDrilling ? `${drillSubject} — Category Breakdown` : 'Subject Heatmap'}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: isDrilling ? 8 : 20 }}>
            {isDrilling
              ? 'Click Back to return to subject view'
              : 'Click a subject row to drill into its categories'}
            {gradeFilter !== 'All' ? ` · ${gradeFilter}` : ''} {termFilter !== 'All' ? ` · ${termFilter}` : ''}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 11, color: '#718096', paddingBottom: 10, fontWeight: 700, paddingRight: 16 }}>
                    {isDrilling ? 'Category' : 'Subject (click to drill)'}
                  </th>
                  {['M','A','R','P'].map(l => (
                    <th key={l} style={{ textAlign: 'center', fontSize: 12, color: LEVEL_COLORS[l], paddingBottom: 10, fontWeight: 800, width: 80 }}>
                      {l}<br/><span style={{ fontWeight: 400, fontSize: 10, color: '#A0AEC0' }}>{LEVEL_FULL[l]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F7FAFC', cursor: isDrilling ? 'default' : 'pointer' }}
                    onClick={() => !isDrilling && setDrillSubject(row.label)}>
                    <td style={{ fontSize: 12, color: isDrilling ? '#4A5568' : TEAL, padding: '8px 16px 8px 0', fontWeight: 500,
                      textDecoration: isDrilling ? 'none' : 'underline dotted' }}>
                      {row.label}
                    </td>
                    {['M','A','R','P'].map(l => {
                      const v  = row[l] || 0
                      const op = v === 0 ? 1 : Math.min(0.95, 0.25 + (v / maxVal) * 0.7)
                      return (
                        <td key={l} style={{ textAlign: 'center', padding: 4 }}>
                          <div style={{
                            borderRadius: 8, padding: '8px 0',
                            fontSize: 13, fontWeight: 700,
                            color:      v === 0 ? '#CBD5E0' : 'white',
                            background: v === 0 ? '#F7FAFC' : LEVEL_COLORS[l],
                            opacity:    op,
                            border:     v === 0 ? '1px solid #EDF2F7' : 'none',
                          }}>
                            {v}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ChartLegend />
        </div>
      )
    }
  }  // end renderChart

    if (graphType === 'classcomp') {
      if (classCompData.length === 0) return <EmptyChart message="No class data yet. Logs must exist across multiple classes." />
      const levelMap = { 1:'M', 2:'A', 3:'R', 4:'P' }
      return (
        <div>
          <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Class Comparison — Average Progress Level</div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>
            Each class's average level score across all logged activities (M=1 → P=4)
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={classCompData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
              <XAxis dataKey="class" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 4]} ticks={[1,2,3,4]}
                tickFormatter={v => ['','M','A','R','P'][v] || v}
                tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [
                `${v} (${['','M','A','R','P'][Math.round(v)] || ''})`,
                'Avg Level'
              ]} />
              <Bar dataKey="avgScore" fill={TEAL} radius={[6,6,0,0]}
                label={{ position: 'top', fontSize: 10, formatter: v => ['','M','A','R','P'][Math.round(v)] || '' }} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginTop: 12 }}>
            Y-axis: 1=M (Making effort) · 2=A (Advancing) · 3=R (Reaching milestone) · 4=P (Proficient)
          </div>
        </div>
      )
    }
  }

  return (
    <div>
      <PageHeader
        role={role}
        title="Reports & Insights"
        subtitle="Visual analysis of student progress"
        action={
          role === 'admin' && (
            <select className="form-select" style={{ width: 'auto', minWidth: 150 }}
              value={classFilter} onChange={e => setClassFilter(e.target.value)}>
              <option value="All">All Classes</option>
              {CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
          )
        }
      />

      {/* Graph type picker */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>
          Select Graph Type
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {GRAPH_TYPES.map(g => (
            <button key={g.id} className={`graph-type-btn ${graphType === g.id ? 'active' : ''}`}
              onClick={() => setGraphType(g.id)}>
              <span style={{ fontSize: 22 }}>{g.icon}</span>
              <span>{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters — live, no Apply button needed */}
      <div className="glass" style={{ borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label">Grade</label>
            <select className="form-select" style={{ width: 'auto', minWidth: 120 }}
              value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
              <option value="All">All Grades</option>
              {GRADES.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Term</label>
            <select className="form-select" style={{ width: 'auto', minWidth: 120 }}
              value={termFilter} onChange={e => setTermFilter(e.target.value)}>
              {['All','T1','T2','T3'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 12, color: '#A0AEC0', alignSelf: 'flex-end', paddingBottom: 10 }}>
            {records.length} records · {students.length} students
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="glass" style={{ borderRadius: 16, padding: 28 }}>
        {renderChart()}
      </div>
    </div>
  )
}