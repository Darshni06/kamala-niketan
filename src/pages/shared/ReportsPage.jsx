import { useState, useEffect, useMemo } from 'react'
import { getProgressByClass, getAllStudents, getStudentsByClass, getAllProgress } from '../../firebase/services'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Spinner } from '../../components/UI'
import { GRAPH_TYPES, LEVEL_COLORS, LEVEL_FULL, LEVELS, CLASSES, GRADES, TEAL } from '../../utils/theme'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, ResponsiveContainer, ScatterChart, Scatter, ZAxis,
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

  const [graphType,   setGraphType]   = useState('stacked')
  const [classFilter, setClassFilter] = useState(role === 'teacher' ? profile?.classId : 'All')
  const [gradeFilter, setGradeFilter] = useState('All')
  const [termFilter,  setTermFilter]  = useState('All')
  const [allRecords,  setAllRecords]  = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [loading,     setLoading]     = useState(true)

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

  // Radar — area proficiency %
  const areaNames = [...new Set(records.map(r => r.areaName))].filter(Boolean)
  const radarData = areaNames.map(area => {
    const aRecs = records.filter(r => r.areaName === area)
    const total  = aRecs.length || 1
    const good   = aRecs.filter(r => r.level === 'P' || r.level === 'R').length
    return {
      area: area.length > 12 ? area.slice(0, 11) + '…' : area,
      score: Math.round((good / total) * 100),
    }
  })

  // Heatmap — area × level counts
  const heatData = areaNames.map(area => {
    const aRecs = records.filter(r => r.areaName === area)
    const row = { area: area.length > 16 ? area.slice(0, 15) + '…' : area }
    ;['M','A','R','P'].forEach(l => { row[l] = aRecs.filter(r => r.level === l).length })
    return row
  })

  // Bubble — area × term density
  const bubbleData = areaNames.slice(0, 6).flatMap((area, ai) =>
    ['T1', 'T2', 'T3'].map((t, ti) => ({
      x: ai, y: ti, z: Math.max(
        records.filter(r => r.areaName === area && r.term === t).length,
        0
      ),
      area: area.split(' ').slice(-1)[0],
      term: t,
    }))
  ).filter(d => d.z > 0)

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

    if (graphType === 'radar') {
      if (radarData.length === 0) return <EmptyChart />
      return (
        <div>
          <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Area Proficiency Radar</div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>
            % of records at R or P per area {gradeFilter !== 'All' ? `· ${gradeFilter}` : ''} {termFilter !== 'All' ? `· ${termFilter}` : ''}
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#EDF2F7" />
              <PolarAngleAxis dataKey="area" tick={{ fontSize: 10, fill: '#718096' }} />
              <Radar name="Proficiency %" dataKey="score" stroke={TEAL} fill={TEAL} fillOpacity={0.25} />
              <Tooltip formatter={v => [v + '%', 'Proficiency']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )
    }

    if (graphType === 'heatmap') {
      if (heatData.length === 0) return <EmptyChart />
      // Find max value for opacity scaling
      const maxVal = Math.max(...heatData.flatMap(r => ['M','A','R','P'].map(l => r[l])), 1)
      return (
        <div>
          <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Activity Heatmap</div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>
            Number of records per level per area {gradeFilter !== 'All' ? `· ${gradeFilter}` : ''} {termFilter !== 'All' ? `· ${termFilter}` : ''}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 11, color: '#718096', paddingBottom: 10, fontWeight: 700, paddingRight: 16 }}>Area</th>
                  {['M','A','R','P'].map(l => (
                    <th key={l} style={{ textAlign: 'center', fontSize: 12, color: LEVEL_COLORS[l], paddingBottom: 10, fontWeight: 800, width: 80 }}>
                      {l}<br/><span style={{ fontWeight: 400, fontSize: 10, color: '#A0AEC0' }}>{LEVEL_FULL[l]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F7FAFC' }}>
                    <td style={{ fontSize: 12, color: '#4A5568', padding: '8px 16px 8px 0', fontWeight: 500 }}>{row.area}</td>
                    {['M','A','R','P'].map(l => {
                      const v   = row[l] || 0
                      const op  = v === 0 ? 0.08 : 0.2 + (v / maxVal) * 0.75
                      return (
                        <td key={l} style={{ textAlign: 'center', padding: 4 }}>
                          <div style={{
                            borderRadius: 8, padding: '8px 0',
                            fontSize: 13, fontWeight: 700,
                            color: v === 0 ? '#CBD5E0' : 'white',
                            background: v === 0 ? '#F7FAFC' : LEVEL_COLORS[l],
                            opacity: v === 0 ? 1 : op,
                            border: v === 0 ? '1px solid #EDF2F7' : 'none',
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

    if (graphType === 'bubble') {
      if (bubbleData.length === 0) return <EmptyChart />
      return (
        <div>
          <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Activity Density by Term</div>
          <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>Bubble size = number of records per area per term</div>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
              <XAxis dataKey="x" type="number" name="Area" tick={false}
                label={{ value: 'Curriculum Area →', position: 'insideBottom', offset: -10, fontSize: 11, fill: '#A0AEC0' }}
                domain={[-0.5, Math.max(areaNames.length - 0.5, 0.5)]} />
              <YAxis dataKey="y" type="number" name="Term" ticks={[0,1,2]}
                tickFormatter={v => ['T1','T2','T3'][v] || ''} tick={{ fontSize: 11 }} />
              <ZAxis dataKey="z" range={[60, 600]} name="Records" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                if (!payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div style={{ background: 'white', border: '1px solid #EDF2F7', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                    <div style={{ fontWeight: 600 }}>{d?.area} · {d?.term}</div>
                    <div style={{ color: '#718096' }}>{d?.z} records</div>
                  </div>
                )
              }} />
              <Scatter data={bubbleData} fill={TEAL} fillOpacity={0.65} />
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {areaNames.slice(0, 6).map((a, i) => (
              <div key={a} style={{ fontSize: 10, color: '#A0AEC0', background: '#F7FAFC', padding: '2px 8px', borderRadius: 6 }}>
                {i} = {a.length > 14 ? a.slice(0,13)+'…' : a}
              </div>
            ))}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
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