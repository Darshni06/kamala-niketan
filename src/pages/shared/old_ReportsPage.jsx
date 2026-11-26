import { useState, useEffect, useMemo } from 'react'
import { getProgressByClass, getAllStudents, getStudentsByClass, getAllProgress } from '../../supabase/services'
import { supabase } from '../../supabase/client'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Spinner } from '../../components/UI'
import { LEVEL_COLORS, LEVEL_FULL, CLASSES, GRADES, TEAL } from '../../utils/theme'
import { exportObservationsToExcel } from '../../utils/exportUtils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer,
} from 'recharts'

const NOT_LOGGED_COLOR = '#CBD5E0'

function ChartLegend() {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
      {['M','A','R','P'].map(l => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: LEVEL_COLORS[l] }} />
          <span style={{ color: '#718096' }}>{l} — {LEVEL_FULL[l]}</span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: NOT_LOGGED_COLOR }} />
        <span style={{ color: '#718096' }}>Not logged</span>
      </div>
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

// ─── Heatmap counting helpers ────────────────────────────────────────────────
// The heatmap counts STUDENTS, never raw progress records. A student has many
// records (one per activity per term), so counting records made every row add
// up to far more than the class size. Rules used instead:
//   1. Per student + activity, the most recent term's level is the current stage.
//   2. Per student within a row (subject / category / activity), the stage is the
//      most frequent level across that row's activities (ties go to the lower
//      stage, i.e. the more cautious reading).
//   3. Every student of the filtered class/grade appears in exactly one cell of
//      each row: M, A, R, P, or "Not logged" — so each row always sums to the
//      total number of students.
const LEVEL_ORDER = ['M', 'A', 'R', 'P']
const TERM_ORDER  = { T1: 1, T2: 2, T3: 3 }

const getStudId   = r => r.student_id    || r.studentId
const getSubjName = r => r.subject_name  || r.subjectName  || ''
const getCatName  = r => r.category_name || r.categoryName || ''
const getActName  = r => r.activity_name || r.activityName || ''

function resolveStudentLevels(recs) {
  const perActivity = {}
  recs.forEach(r => {
    const sid = getStudId(r)
    if (!sid || !LEVEL_ORDER.includes(r.level)) return
    const actKey = r.activity_id || r.activityId || getActName(r)
    const key = sid + '||' + actKey
    const t = TERM_ORDER[r.term] || 0
    if (!perActivity[key] || t >= perActivity[key].t) perActivity[key] = { sid, t, level: r.level }
  })

  const tallies = {}
  Object.values(perActivity).forEach(({ sid, level }) => {
    if (!tallies[sid]) tallies[sid] = { M: 0, A: 0, R: 0, P: 0 }
    tallies[sid][level]++
  })

  const result = {}
  Object.entries(tallies).forEach(([sid, c]) => {
    let best = null
    LEVEL_ORDER.forEach(l => { if (best === null || c[l] > c[best]) best = l }) // strict ">" keeps the lower stage on a tie
    result[sid] = best
  })
  return result
}

function buildHeatRow(recs, studentIds) {
  const levels = resolveStudentLevels(recs.filter(r => studentIds.has(getStudId(r))))
  const ids = { M: [], A: [], R: [], P: [], N: [] }
  Object.entries(levels).forEach(([sid, l]) => ids[l].push(sid))
  studentIds.forEach(sid => { if (!levels[sid]) ids.N.push(sid) })
  return { M: ids.M.length, A: ids.A.length, R: ids.R.length, P: ids.P.length, N: ids.N.length, ids }
}

export default function ReportsPage({ role }) {
  const { profile } = useAuth()

  const GRAPH_TYPES = [
    { id: 'stacked',   icon: '▦', label: 'Stacked Bar'     },
    { id: 'line',      icon: '↗', label: 'Progress Line'    },
    { id: 'donut',     icon: '◎', label: 'Donut / Pie'      },
    { id: 'heatmap',   icon: '⊞', label: 'Heatmap'          },
    { id: 'classcomp', icon: '⧖', label: 'Class Comparison' },
  ]

  const [graphType,    setGraphType]    = useState('stacked')
  const [classFilter,  setClassFilter]  = useState(role === 'teacher' ? profile?.classId : 'All')
  const [gradeFilter,  setGradeFilter]  = useState('All')
  const [termFilter,   setTermFilter]   = useState('All')
  const [allRecords,   setAllRecords]   = useState([])
  const [allStudents,  setAllStudents]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [exportingObs, setExportingObs] = useState(false)
  const [drillSubject, setDrillSubject] = useState(null)
  const [drillCategory, setDrillCategory] = useState(null)
  const [drillActivity, setDrillActivity] = useState(null)

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
    return gradeFilter === 'All' ? allStudents : allStudents.filter(s => s.grade === gradeFilter)
  }, [allStudents, gradeFilter])

  // ── Chart data ────────────────────────────────────────────────────────────

  // Every chart below counts STUDENTS (each student once, at their current
  // stage) — never raw progress records. See buildHeatRow() above.
  const studentIds    = new Set(students.map(s => s.id))
  const totalStudents = studentIds.size

  const subjectNames = [...new Set(records.map(getSubjName))].filter(Boolean)
  const heatData = subjectNames.map(subject => ({
    subject: subject.length > 18 ? subject.slice(0, 17) + '…' : subject,
    fullName: subject,
    ...buildHeatRow(records.filter(r => getSubjName(r) === subject), studentIds),
  }))

  // Stacked bar — per subject, how many students sit at each stage
  const stackedData = heatData

  // Line — per term, how many students sit at each stage (grade filter applies,
  // the term filter does not, since the chart itself is the term comparison)
  const termTrend = ['T1', 'T2', 'T3'].map(t => {
    const tRecs = allRecords.filter(r =>
      r.term === t && (gradeFilter === 'All' || r.grade === gradeFilter)
    )
    const row = buildHeatRow(tRecs, studentIds)
    return { term: t === 'T1' ? 'Term 1' : t === 'T2' ? 'Term 2' : 'Term 3',
             M: row.M, A: row.A, R: row.R, P: row.P, N: row.N }
  })

  // Donut — overall, how many students sit at each stage
  const overall = buildHeatRow(records, studentIds)
  const donutData = [
    ...['M','A','R','P'].map(l => ({ name: LEVEL_FULL[l], value: overall[l], color: LEVEL_COLORS[l] })),
    { name: 'Not logged', value: overall.N, color: NOT_LOGGED_COLOR },
  ].filter(d => d.value > 0)

  // Class comparison — average stage across a class's students (M=1 … P=4)
  const classCompData = useMemo(() => {
    const weight = { M: 1, A: 2, R: 3, P: 4 }
    const classIds = [...new Set(students.map(s => s.class_id || s.classId).filter(Boolean))].sort()
    return classIds.map(cls => {
      const ids    = new Set(students.filter(s => (s.class_id || s.classId) === cls).map(s => s.id))
      const levels = resolveStudentLevels(records.filter(r => ids.has(getStudId(r))))
      const stages = Object.values(levels)
      const avg    = stages.length ? stages.reduce((sum, l) => sum + weight[l], 0) / stages.length : 0
      return { class: cls, avgScore: parseFloat(avg.toFixed(2)), students: ids.size, logged: stages.length }
    }).filter(c => c.logged > 0)
  }, [students, records])

  // ── Render chart ──────────────────────────────────────────────────────────

  const renderChart = () => {
    if (loading) return <Spinner center />

    if (graphType === 'stacked') {
      if (stackedData.length === 0) return <EmptyChart />
      return (
        <div>
          <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Students at Each Level, by Subject</div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>
            Number of students at each level · each bar adds up to {totalStudents} student{totalStudents === 1 ? '' : 's'}
            {gradeFilter !== 'All' ? ` · ${gradeFilter}` : ''} {termFilter !== 'All' ? ` · ${termFilter}` : ''}
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={stackedData} margin={{ top: 0, right: 10, left: -20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
              <XAxis dataKey="subject" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[0, Math.max(totalStudents, 1)]} />
              <Tooltip />
              <Bar dataKey="M" stackId="a" fill={LEVEL_COLORS.M} name={LEVEL_FULL.M} />
              <Bar dataKey="A" stackId="a" fill={LEVEL_COLORS.A} name={LEVEL_FULL.A} />
              <Bar dataKey="R" stackId="a" fill={LEVEL_COLORS.R} name={LEVEL_FULL.R} />
              <Bar dataKey="P" stackId="a" fill={LEVEL_COLORS.P} name={LEVEL_FULL.P} />
              <Bar dataKey="N" stackId="a" fill={NOT_LOGGED_COLOR} name="Not logged" radius={[4,4,0,0]} />
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
            Number of students at each level in Term 1, 2, 3 · out of {totalStudents} {gradeFilter !== 'All' ? `· ${gradeFilter}` : ''}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={termTrend} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
              <XAxis dataKey="term" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[0, Math.max(totalStudents, 1)]} />
              <Tooltip />
              {['M','A','R','P'].map(l => (
                <Line key={l} type="monotone" dataKey={l} stroke={LEVEL_COLORS[l]}
                  strokeWidth={2.5} dot={{ r: 5, fill: LEVEL_COLORS[l] }} name={LEVEL_FULL[l]} />
              ))}
              <Line type="monotone" dataKey="N" stroke={NOT_LOGGED_COLOR} strokeDasharray="5 4"
                strokeWidth={2} dot={{ r: 4, fill: NOT_LOGGED_COLOR }} name="Not logged" />
            </LineChart>
          </ResponsiveContainer>
          <ChartLegend />
        </div>
      )
    }

    if (graphType === 'donut') {
      if (donutData.length === 0) return <EmptyChart />
      const total = donutData.reduce((s,d) => s + d.value, 0)
      return (
        <div>
          <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Level Distribution</div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>
            Share of students at each level {gradeFilter !== 'All' ? `· ${gradeFilter}` : ''} {termFilter !== 'All' ? `· ${termFilter}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  dataKey="value" paddingAngle={2}>
                  {donutData.map((e,i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v,n) => [v + (v === 1 ? ' student' : ' students'), n]} />
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
                Total: {total} student{total === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (graphType === 'heatmap') {
      if (heatData.length === 0) return <EmptyChart message="No data yet. Log some progress first." />

      const getStudentName = (id) => {
        const s = students.find(x => x.id === id) || allStudents.find(x => x.id === id)
        return s ? s.name : 'Unknown student'
      }

      const drillLevel = drillActivity ? 3 : drillCategory ? 2 : drillSubject ? 1 : 0

      const inSubject  = r => getSubjName(r) === drillSubject
      const inCategory = r => inSubject(r) && getCatName(r) === drillCategory
      const inActivity = r => inCategory(r) && getActName(r) === drillActivity

      let tableRows = []
      let studentCols = null // only populated at drillLevel 3

      if (drillLevel === 0) {
        tableRows = heatData.map(d => ({ ...d, label: d.subject }))
      } else if (drillLevel === 1) {
        const catNames = [...new Set(records.filter(inSubject).map(getCatName))].filter(Boolean)
        tableRows = catNames.map(cat => ({
          label: cat, fullName: cat,
          ...buildHeatRow(records.filter(r => inSubject(r) && getCatName(r) === cat), studentIds),
        }))
      } else if (drillLevel === 2) {
        const actNames = [...new Set(records.filter(inCategory).map(getActName))].filter(Boolean)
        tableRows = actNames.map(act => ({
          label: act, fullName: act,
          ...buildHeatRow(records.filter(r => inCategory(r) && getActName(r) === act), studentIds),
        }))
      } else {
        const row = buildHeatRow(records.filter(inActivity), studentIds)
        studentCols = [...LEVEL_ORDER, 'N'].map(l => ({
          level: l,
          names: row.ids[l].map(getStudentName).sort(),
        }))
      }

      const colColor = l => (l === 'N' ? '#A0AEC0' : LEVEL_COLORS[l])
      const colTitle = l => (l === 'N' ? 'Not logged' : LEVEL_FULL[l])

      const goBack = () => {
        if (drillActivity)      setDrillActivity(null)
        else if (drillCategory) setDrillCategory(null)
        else if (drillSubject)  setDrillSubject(null)
      }

      const headerLabel =
        drillLevel === 3 ? `${drillActivity} — Students by Stage` :
        drillLevel === 2 ? `${drillCategory} — Activity Breakdown` :
        drillLevel === 1 ? `${drillSubject} — Category Breakdown` :
        'Subject Heatmap'

      const subLabel =
        drillLevel === 3 ? 'Click Back to return to activities' :
        drillLevel === 2 ? 'Click an activity row to see students at each stage' :
        drillLevel === 1 ? 'Click a category row to drill into its activities' :
        'Click a subject row to drill into its categories'

      const colHeaderLabel =
        drillLevel === 2 ? 'Activity (click to drill)' :
        drillLevel === 1 ? 'Category (click to drill)' :
        'Subject (click to drill)'

      const handleRowClick = (row) => {
        const val = row.fullName || row.label
        if (drillLevel === 0) setDrillSubject(val)
        else if (drillLevel === 1) setDrillCategory(val)
        else if (drillLevel === 2) setDrillActivity(val)
      }

      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            {drillLevel > 0 && (
              <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }} onClick={goBack}>
                ← Back
              </button>
            )}
            <div style={{ fontWeight: 600, color: '#2D3748' }}>{headerLabel}</div>
          </div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 6 }}>
            {subLabel}
            {gradeFilter !== 'All' ? ` · ${gradeFilter}` : ''}{termFilter !== 'All' ? ` · ${termFilter}` : ''}
            {` · ${totalStudents} student${totalStudents === 1 ? '' : 's'}`}
          </div>
          <div style={{ fontSize: 11, color: '#A0AEC0', marginBottom: 20 }}>
            Numbers are students, not records: each student is counted once per row, at their most common stage across that row's activities. Every row adds up to {totalStudents}.
          </div>

          {drillLevel === 3 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {studentCols.map(({ level: l, names }) => (
                <div key={l} style={{
                  border: `1.5px solid ${colColor(l)}44`, borderRadius: 12, padding: 12,
                  background: `${colColor(l)}0d`,
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 800, color: colColor(l), marginBottom: 8,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span>{l === 'N' ? 'Not logged' : `${l} — ${colTitle(l)}`}</span>
                    <span style={{
                      fontSize: 11, background: colColor(l), color: 'white',
                      borderRadius: 10, padding: '1px 8px',
                    }}>{names.length}</span>
                  </div>
                  {names.length === 0 ? (
                    <div style={{ fontSize: 11, color: '#CBD5E0' }}>No students</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {names.map(n => (
                        <div key={n} style={{ fontSize: 12, color: '#4A5568' }}>{n}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: 11, color: '#718096', paddingBottom: 10, fontWeight: 700, paddingRight: 16 }}>
                      {colHeaderLabel}
                    </th>
                    {[...LEVEL_ORDER, 'N'].map(l => (
                      <th key={l} style={{ textAlign: 'center', fontSize: 12, color: colColor(l), paddingBottom: 10, fontWeight: 800, width: 80 }}>
                        {l === 'N' ? '—' : l}<br/><span style={{ fontWeight: 400, fontSize: 10, color: '#A0AEC0' }}>{colTitle(l)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F7FAFC', cursor: 'pointer' }}
                      onClick={() => handleRowClick(row)}>
                      <td style={{ fontSize: 12, color: TEAL, padding: '8px 16px 8px 0', fontWeight: 500, textDecoration: 'underline dotted' }}>
                        {row.label}
                      </td>
                      {[...LEVEL_ORDER, 'N'].map(l => {
                        const v  = row[l] || 0
                        const op = v === 0 ? 1 : Math.min(0.95, 0.25 + (v / Math.max(totalStudents, 1)) * 0.7)
                        return (
                          <td key={l} style={{ textAlign: 'center', padding: 4 }}>
                            <div style={{
                              borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700,
                              color:      v === 0 ? '#CBD5E0' : 'white',
                              background: v === 0 ? '#F7FAFC' : colColor(l),
                              opacity:    op,
                              border:     v === 0 ? '1px solid #EDF2F7' : 'none',
                            }}>{v}</div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <ChartLegend />
        </div>
      )
    }

    if (graphType === 'classcomp') {
      if (classCompData.length === 0) return <EmptyChart message="No class data yet for the selected filters." />
      return (
        <div>
          <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Class Comparison — Average Student Level</div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>
            Each class's average level across its students, one stage per student (M=1 → P=4)
            {gradeFilter !== 'All' ? ` · ${gradeFilter}` : ''} {termFilter !== 'All' ? ` · ${termFilter}` : ''}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={classCompData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
              <XAxis dataKey="class" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 4]} ticks={[1,2,3,4]}
                tickFormatter={v => (['','M','A','R','P'][v] || '')}
                tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n, item) => [
                `${v} (${['','M','A','R','P'][Math.round(v)] || ''}) · ${item.payload.logged} of ${item.payload.students} students logged`,
                'Avg Level',
              ]} />
              <Bar dataKey="avgScore" fill={TEAL} radius={[6,6,0,0]}
                label={{ position: 'top', fontSize: 10, formatter: v => ['','M','A','R','P'][Math.round(v)] || '' }} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginTop: 12 }}>
            Y-axis: 1=M · 2=A · 3=R · 4=P
          </div>
          <div style={{ fontSize: 12, color: '#718096', marginTop: 8 }}>
            Students logged: {classCompData.map(c => `${c.class} ${c.logged}/${c.students}`).join(' · ')}
          </div>
        </div>
      )
    }

    return <EmptyChart />
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
              value={classFilter} onChange={e => { setClassFilter(e.target.value); setDrillSubject(null); setDrillCategory(null); setDrillActivity(null) }}>
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
            <button key={g.id}
              className={`graph-type-btn ${graphType === g.id ? 'active' : ''}`}
              onClick={() => { setGraphType(g.id); setDrillSubject(null); setDrillCategory(null); setDrillActivity(null) }}>
              <span style={{ fontSize: 22 }}>{g.icon}</span>
              <span>{g.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
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
            {[...new Set(records.map(getStudId).filter(id => studentIds.has(id)))].length} of {students.length} students have logs
          </div>
          {role === 'admin' && (
            <button
              className="btn-ghost"
              style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              disabled={exportingObs}
              onClick={async () => {
                setExportingObs(true)
                try {
                  let q = supabase.from('teacher_notes').select('*').order('month')
                  if (gradeFilter !== 'All') {
                    const gradStudents = allStudents
                      .filter(s => s.grade === gradeFilter)
                      .map(s => s.id)
                    if (gradStudents.length > 0) {
                      q = q.in('student_id', gradStudents)
                    }
                  }
                  const { data: notes } = await q
                  const studentsById = {}
                  allStudents.forEach(s => { studentsById[s.id] = { name: s.name, grade: s.grade } })
                  exportObservationsToExcel(notes || [], 'All_Students', studentsById)
                } catch (e) { console.error(e) }
                finally { setExportingObs(false) }
              }}>
              {exportingObs ? '…' : '📥 Export All Observations'}
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="glass" style={{ borderRadius: 16, padding: 28 }}>
        {renderChart()}
      </div>
    </div>
  )
}