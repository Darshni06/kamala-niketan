// src/components/WeeklyPlanTable.jsx
// A broad table: rows = dates, columns = students. Each cell shows the
// activity name(s) assigned to that student on that date, plus a live
// PL / PR / P-n status chip. Grade + Subject choose what's shown; a Week /
// Month / Custom range picker (with Prev/Next) controls which dates appear.
// Fully reusable — the teacher's own class and the admin's picked class both
// render through this same component so the two views can never drift apart.
import { useState, useEffect, useMemo } from 'react'
import { getStudentsByClass, getWeeklyPlansByClass, getSubjectsByGrade } from '../supabase/services'
import { exportWeeklyPlanToExcel } from '../utils/exportUtils'
import { Spinner, EmptyState } from './UI'
import { GRADES } from '../utils/theme'
import {
  planStatusLabel, planStatusColor, planStatusBg,
  dateRange, addDays, startOfWeek, startOfMonth, endOfMonth,
  todayStr, formatDateLabel, formatDateRangeLabel,
} from '../utils/planUtils'

export default function WeeklyPlanTable({ classId }) {
  const [students, setStudents] = useState([])
  const [plans,    setPlans]    = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading,  setLoading]  = useState(true)

  const [gradeFilter,   setGradeFilter]   = useState('')
  const [subjectFilter, setSubjectFilter] = useState('ALL')
  const [viewMode,      setViewMode]      = useState('week') // week | month | custom
  const [anchor,        setAnchor]        = useState(todayStr())
  const [customFrom,    setCustomFrom]    = useState(todayStr())
  const [customTo,      setCustomTo]      = useState(addDays(todayStr(), 5))

  const load = async () => {
    setLoading(true)
    try {
      const [studs, pls] = await Promise.all([
        getStudentsByClass(classId),
        getWeeklyPlansByClass(classId),
      ])
      setStudents(studs)
      setPlans(pls)
      if (!gradeFilter) {
        const firstGrade = GRADES.find(g => studs.some(s => s.grade === g)) || GRADES[0]
        setGradeFilter(firstGrade)
      }
    } catch (e) {
      console.error('Failed to load weekly plan data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (classId) load() }, [classId])

  useEffect(() => {
    if (!gradeFilter) return
    setSubjectFilter('ALL')
    getSubjectsByGrade(gradeFilter).then(setSubjects)
  }, [gradeFilter])

  const { rangeFrom, rangeTo } = useMemo(() => {
    if (viewMode === 'week')  return { rangeFrom: startOfWeek(anchor), rangeTo: addDays(startOfWeek(anchor), 5) }
    if (viewMode === 'month') return { rangeFrom: startOfMonth(anchor), rangeTo: endOfMonth(anchor) }
    return { rangeFrom: customFrom, rangeTo: customTo }
  }, [viewMode, anchor, customFrom, customTo])

  const dates = useMemo(() => dateRange(rangeFrom, rangeTo), [rangeFrom, rangeTo])

  const shiftAnchor = (dir) => {
    if (viewMode === 'week')  { setAnchor(addDays(anchor, dir * 7)); return }
    if (viewMode === 'month') {
      const d = new Date(anchor + 'T00:00:00')
      d.setMonth(d.getMonth() + dir)
      setAnchor(d.toISOString().split('T')[0])
      return
    }
  }

  const gradeStudents = useMemo(
    () => students.filter(s => s.grade === gradeFilter),
    [students, gradeFilter]
  )

  const relevantPlans = useMemo(
    () => plans.filter(p => p.grade === gradeFilter && (subjectFilter === 'ALL' || p.subjectId === subjectFilter)),
    [plans, subjectFilter, gradeFilter]
  )

  const cellPlans = (studentId, date) =>
    relevantPlans.filter(p => p.studentId === studentId && date >= p.fromDate && date <= p.toDate)

  const handleExport = () => {
    const visible = relevantPlans.filter(p => p.fromDate <= rangeTo && p.toDate >= rangeFrom)
    const subjName = subjectFilter === 'ALL' ? 'All_Subjects' : (subjects.find(s => s.id === subjectFilter)?.name || 'Subject')
    exportWeeklyPlanToExcel(visible, `${classId}_${gradeFilter}_${subjName}_weekly_plan`)
  }

  if (loading) return <Spinner center />

  return (
    <div>
      {/* Filters */}
      <div className="glass" style={{ borderRadius: 12, padding: 16, marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
        <div style={{ minWidth: 140 }}>
          <label className="form-label">Grade</label>
          <select className="form-select" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
            {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 180 }}>
          <label className="form-label">Subject</label>
          <select className="form-select" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
            <option value="ALL">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,.6)', padding: 4, borderRadius: 10 }}>
          {['week', 'month', 'custom'].map(m => (
            <div key={m} className={`view-mode-tab ${viewMode === m ? 'active' : ''}`} onClick={() => setViewMode(m)}>
              {m === 'week' ? 'Week' : m === 'month' ? 'Month' : 'Custom Range'}
            </div>
          ))}
        </div>

        {viewMode !== 'custom' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => shiftAnchor(-1)}>←</button>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2D3748', minWidth: 150, textAlign: 'center' }}>
              {formatDateRangeLabel(rangeFrom, rangeTo)}
            </div>
            <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => shiftAnchor(1)}>→</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <div>
              <label className="form-label">From</label>
              <input type="date" className="form-input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <label className="form-label">To</label>
              <input type="date" className="form-input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ flex: 1 }} />
        <button className="btn-ghost" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={handleExport} disabled={relevantPlans.length === 0}>
          📥 Export to Excel
        </button>
      </div>

      {gradeStudents.length === 0 ? (
        <EmptyState icon="🎓" message={`No students found for ${gradeFilter}.`} />
      ) : (
        <div className="wp-table-scroll" style={{ maxHeight: 560 }}>
          <table className="wp-table">
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 3, background: '#F7FAFC' }}>Date</th>
                {gradeStudents.map(s => <th key={s.id}>{s.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {dates.map(date => (
                <tr key={date}>
                  <th>{formatDateLabel(date)}</th>
                  {gradeStudents.map(s => {
                    const cp = cellPlans(s.id, date)
                    return (
                      <td key={s.id}>
                        {cp.length === 0 ? (
                          <span style={{ fontSize: 11, color: '#CBD5E0' }}>—</span>
                        ) : cp.map(p => (
                          <div key={p.id} className="plan-chip" style={{ background: planStatusBg(p.presentationCount), color: '#2D3748' }}>
                            {subjectFilter === 'ALL' && (
                              <div style={{ fontSize: 9, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 1 }}>
                                {p.subjectName}
                              </div>
                            )}
                            {p.activityName}
                            <div>
                              <span className="plan-chip-status" style={{ background: planStatusColor(p.presentationCount), color: 'white' }}>
                                {planStatusLabel(p.presentationCount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {subjectFilter && (
        <div style={{ display: 'flex', gap: 18, marginTop: 14, fontSize: 12, color: '#718096', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: planStatusColor(0), display: 'inline-block' }} /> PL — Planned
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: planStatusColor(1), display: 'inline-block' }} /> PR — Presented
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: planStatusColor(2), display: 'inline-block' }} /> P-n — Practiced again (n times)
          </div>
        </div>
      )}
    </div>
  )
}