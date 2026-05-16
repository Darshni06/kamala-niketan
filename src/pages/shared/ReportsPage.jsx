import { useState, useEffect } from 'react'
import { getProgressByClass, getProgressByStudent, getAllStudents, getStudentsByClass, getAllProgress } from '../../firebase/services'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Spinner, GradeBadge } from '../../components/UI'
import { GRAPH_TYPES, LEVEL_COLORS, LEVEL_FULL, LEVELS, CLASSES, GRADES, TEAL, PEACH } from '../../utils/theme'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend as RLegend,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, ResponsiveContainer, ScatterChart, Scatter, ZAxis,
} from 'recharts'

function ChartLegend() {
  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 18, flexWrap: 'wrap' }}>
      {Object.entries(LEVEL_COLORS).filter(([l]) => l !== 'NA').map(([l, c]) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
          <span style={{ color: '#718096' }}>{l} — {LEVEL_FULL[l]}</span>
        </div>
      ))}
    </div>
  )
}

export default function ReportsPage({ role }) {
  const { profile } = useAuth()
  const [graphType,  setGraphType]  = useState('stacked')
  const [classFilter,setClassFilter]= useState(role === 'teacher' ? profile?.classId : 'All')
  const [gradeFilter,setGradeFilter]= useState('All')
  const [termFilter, setTermFilter] = useState('All')
  const [records,    setRecords]    = useState([])
  const [students,   setStudents]   = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const classId = role === 'teacher' ? profile?.classId : (classFilter !== 'All' ? classFilter : null)
        const [recs, studs] = await Promise.all([
          classId ? getProgressByClass(classId) : getAllProgress(),
          classId ? getStudentsByClass(classId) : getAllStudents(),
        ])
        setRecords(recs)
        setStudents(studs)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [classFilter, role])

  // ── Derived chart data ────────────────────────────────────────────────────

  // Per-student level counts
  const studentData = students.slice(0, 8).map(s => {
    const sRecs = records.filter(r => r.studentId === s.id && (termFilter === 'All' || r.term === termFilter))
    const counts = { name: s.name.split(' ')[0], M: 0, A: 0, R: 0, P: 0 }
    sRecs.forEach(r => { if (counts[r.level] !== undefined) counts[r.level]++ })
    return counts
  })

  // Term-over-term trend
  const termTrend = ['T1', 'T2', 'T3'].map(t => {
    const tRecs = records.filter(r => r.term === t)
    const out = { term: t === 'T1' ? 'Term 1' : t === 'T2' ? 'Term 2' : 'Term 3', M: 0, A: 0, R: 0, P: 0 }
    tRecs.forEach(r => { if (out[r.level] !== undefined) out[r.level]++ })
    return out
  })

  // Donut data
  const donutData = ['M', 'A', 'R', 'P'].map(l => ({
    name: LEVEL_FULL[l], value: records.filter(r => r.level === l && (termFilter === 'All' || r.term === termFilter)).length,
    color: LEVEL_COLORS[l],
  }))

  // Radar — area proficiency
  const areaNames = [...new Set(records.map(r => r.areaName))].filter(Boolean).slice(0, 6)
  const radarData = areaNames.map(area => {
    const aRecs = records.filter(r => r.areaName === area && (termFilter === 'All' || r.term === termFilter))
    const total = aRecs.length || 1
    const pCount = aRecs.filter(r => r.level === 'P' || r.level === 'R').length
    return { area: area.split(' ').slice(-1)[0], score: Math.round((pCount / total) * 100) }
  })

  // Heatmap — areas × levels
  const heatAreas = areaNames.length > 0 ? areaNames : ['Practical Life', 'Sensorial', 'Arithmetic', 'Language', 'SocioEmotional', 'Art']
  const heatData = heatAreas.map(area => {
    const aRecs = records.filter(r => r.areaName === area && (termFilter === 'All' || r.term === termFilter))
    const row = { area: area.length > 14 ? area.slice(0, 13) + '…' : area }
    LEVELS.filter(l => l !== 'NA').forEach(l => { row[l] = aRecs.filter(r => r.level === l).length })
    return row
  })

  // Bubble — area × term × count
  const bubbleData = heatAreas.flatMap((area, ai) =>
    ['T1', 'T2', 'T3'].map((t, ti) => {
      const n = records.filter(r => r.areaName === area && r.term === t).length
      return { x: ai, y: ti, z: n, area: area.split(' ').slice(-1)[0], term: t }
    })
  )

  const renderChart = () => {
    if (loading) return <Spinner center />

    if (graphType === 'stacked') return (
      <div>
        <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Student Level Distribution</div>
        <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>Number of records at each level per student</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={studentData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="M" stackId="a" fill={LEVEL_COLORS.M} name="Making an effort" />
            <Bar dataKey="A" stackId="a" fill={LEVEL_COLORS.A} name="Advancing" />
            <Bar dataKey="R" stackId="a" fill={LEVEL_COLORS.R} name="Reaching milestone" />
            <Bar dataKey="P" stackId="a" fill={LEVEL_COLORS.P} name="Proficient" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <ChartLegend />
      </div>
    )

    if (graphType === 'line') return (
      <div>
        <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Progress Over Terms</div>
        <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>How level counts shift across Term 1, 2 and 3</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={termTrend} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
            <XAxis dataKey="term" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            {['M', 'A', 'R', 'P'].map(l => (
              <Line key={l} type="monotone" dataKey={l} stroke={LEVEL_COLORS[l]} strokeWidth={2.5} dot={{ r: 5, fill: LEVEL_COLORS[l] }} name={LEVEL_FULL[l]} />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <ChartLegend />
      </div>
    )

    if (graphType === 'donut') return (
      <div>
        <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Level Distribution — Donut</div>
        <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>Share of records at each level</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          <ResponsiveContainer width={220} height={220}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value" paddingAngle={2}>
                {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
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
              </div>
            ))}
          </div>
        </div>
      </div>
    )

    if (graphType === 'radar') return (
      <div>
        <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Area Proficiency Radar</div>
        <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>% of records at R or P level per curriculum area</div>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData.length > 0 ? radarData : []}>
            <PolarGrid stroke="#EDF2F7" />
            <PolarAngleAxis dataKey="area" tick={{ fontSize: 11, fill: '#718096' }} />
            <Radar name="Proficiency %" dataKey="score" stroke={TEAL} fill={TEAL} fillOpacity={0.25} />
            <Tooltip formatter={v => [v + '%', 'Proficiency']} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    )

    if (graphType === 'heatmap') return (
      <div>
        <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Activity Heatmap</div>
        <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>Number of students at each level per curriculum area</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 11, color: '#A0AEC0', paddingBottom: 10, fontWeight: 600 }}>Area</th>
              {['M', 'A', 'R', 'P'].map(l => (
                <th key={l} style={{ textAlign: 'center', fontSize: 11, color: LEVEL_COLORS[l], paddingBottom: 10, fontWeight: 700, width: 70 }}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatData.map(row => (
              <tr key={row.area}>
                <td style={{ fontSize: 12, color: '#4A5568', padding: '6px 0', fontWeight: 500 }}>{row.area}</td>
                {['M', 'A', 'R', 'P'].map(l => {
                  const v = row[l]; const maxV = 40
                  const op = Math.min(0.15 + (v / maxV) * 0.8, 0.95)
                  return (
                    <td key={l} style={{ textAlign: 'center', padding: 4 }}>
                      <div style={{ borderRadius: 6, padding: '7px 0', fontSize: 12, fontWeight: 700, color: 'white', background: LEVEL_COLORS[l], opacity: op }}>{v}</div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ChartLegend />
      </div>
    )

    if (graphType === 'bubble') return (
      <div>
        <div style={{ fontWeight: 600, color: '#2D3748', marginBottom: 4 }}>Bubble Chart — Activity Density by Term</div>
        <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 20 }}>Bubble size = number of records logged; each area × term</div>
        <ResponsiveContainer width="100%" height={260}>
          <ScatterChart margin={{ top: 0, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" />
            <XAxis dataKey="x" type="number" name="Area" tick={false} label={{ value: 'Curriculum Area', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#A0AEC0' }} domain={[-0.5, heatAreas.length - 0.5]} />
            <YAxis dataKey="y" type="number" name="Term" ticks={[0, 1, 2]} tickFormatter={v => ['T1', 'T2', 'T3'][v] || ''} tick={{ fontSize: 11 }} />
            <ZAxis dataKey="z" range={[40, 400]} name="Records" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
              if (!payload?.length) return null
              const d = payload[0]?.payload
              return <div style={{ background: 'white', border: '1px solid #EDF2F7', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{d?.area} — {d?.term}</div>
                <div style={{ color: '#718096' }}>{d?.z} records</div>
              </div>
            }} />
            <Scatter data={bubbleData} fill={TEAL} fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          {heatAreas.map((a, i) => (
            <div key={a} style={{ fontSize: 11, color: '#A0AEC0' }}>{i} = {a.split(' ').slice(-1)[0]}</div>
          ))}
        </div>
      </div>
    )
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

      {/* Filters */}
      <div className="glass" style={{ borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {[
            { l: 'Grade',     opts: ['All', ...GRADES],              state: gradeFilter,  set: setGradeFilter },
            { l: 'Term',      opts: ['All', 'T1', 'T2', 'T3'],       state: termFilter,   set: setTermFilter  },
          ].map(f => (
            <div key={f.l}>
              <label className="form-label">{f.l}</label>
              <select className="form-select" style={{ width: 'auto', minWidth: 120 }}
                value={f.state} onChange={e => f.set(e.target.value)}>
                {f.opts.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <button className="btn-primary">Apply Filters</button>
        </div>
      </div>

      {/* Chart */}
      <div className="glass" style={{ borderRadius: 16, padding: 28 }}>
        {renderChart()}
      </div>
    </div>
  )
}