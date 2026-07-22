// src/pages/teacher/WeeklyPlanPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  getStudentsByClass, getSubjectsByGrade, getActivitiesBySubject,
  getGroupsByClass, createGroup, addWeeklyPlan, getWeeklyPlansByClass, deleteWeeklyPlanBatch,
} from '../../supabase/services'
import { exportWeeklyPlanToExcel } from '../../utils/exportUtils'
import { PageHeader, Spinner, EmptyState, ConfirmDialog, GradeBadge } from '../../components/UI'
import WeeklyPlanTable from '../../components/WeeklyPlanTable'
import { GRADES, TEAL } from '../../utils/theme'
import { todayStr, addDays, formatDateRangeLabel } from '../../utils/planUtils'

export default function WeeklyPlanPage() {
  const { profile } = useAuth()
  const classId = profile?.classId || profile?.class_id

  const [innerTab, setInnerTab] = useState('create') // create | overview

  const [loading,  setLoading]  = useState(true)
  const [students, setStudents] = useState([])
  const [plans,    setPlans]    = useState([])
  const [groups,   setGroups]   = useState([])

  const [gradeFilter, setGradeFilter] = useState('')
  const [subjects,    setSubjects]    = useState([])
  const [selSubject,  setSelSubject]  = useState('')
  const [activities,  setActivities]  = useState([])
  const [selActivity, setSelActivity] = useState('')

  const [assignMode,         setAssignMode]         = useState('individual') // individual | group
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set())
  const [selectedGroupId,    setSelectedGroupId]    = useState('')
  const [showNewGroupForm,   setShowNewGroupForm]   = useState(false)
  const [newGroupName,       setNewGroupName]       = useState('')
  const [newGroupStudentIds, setNewGroupStudentIds] = useState(new Set())

  const [fromDate, setFromDate] = useState(todayStr())
  const [toDate,   setToDate]   = useState(addDays(todayStr(), 5))

  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [confirmBatch, setConfirmBatch] = useState(null)

  const [listSubjectFilter, setListSubjectFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [studs, pls, grps] = await Promise.all([
        getStudentsByClass(classId),
        getWeeklyPlansByClass(classId),
        getGroupsByClass(classId),
      ])
      setStudents(studs)
      setPlans(pls)
      setGroups(grps)
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
    setSelSubject(''); setActivities([]); setSelActivity('')
    getSubjectsByGrade(gradeFilter).then(setSubjects)
  }, [gradeFilter])

  useEffect(() => {
    if (!selSubject) { setActivities([]); setSelActivity(''); return }
    getActivitiesBySubject(selSubject).then(setActivities)
  }, [selSubject])

  const gradeStudents = useMemo(
    () => students.filter(s => s.grade === gradeFilter),
    [students, gradeFilter]
  )

  const toggleStudent = (id) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleNewGroupStudent = (id) => {
    setNewGroupStudentIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || newGroupStudentIds.size === 0) {
      setSaveError('Give the group a name and pick at least one student.')
      return
    }
    try {
      const g = await createGroup(classId, newGroupName.trim(), [...newGroupStudentIds], profile?.uid || profile?.id)
      setGroups(prev => [...prev, g])
      setSelectedGroupId(g.id)
      setShowNewGroupForm(false)
      setNewGroupName(''); setNewGroupStudentIds(new Set())
      setSaveError('')
    } catch (e) {
      setSaveError('Failed to create group: ' + (e?.message || 'Unknown error'))
    }
  }

  const handleAddPlan = async () => {
    setSaveError(''); setSaveSuccess('')
    if (!selSubject || !selActivity) { setSaveError('Choose a subject and an activity.'); return }
    if (!fromDate || !toDate || fromDate > toDate) { setSaveError('Please check the From/To dates.'); return }

    let assignees = []
    let groupId = null, groupName = ''

    if (assignMode === 'group') {
      const g = groups.find(x => x.id === selectedGroupId)
      if (!g) { setSaveError('Choose a group, or switch to Individual Students.'); return }
      assignees = students.filter(s => g.studentIds.includes(s.id)).map(s => ({ id: s.id, name: s.name }))
      groupId = g.id; groupName = g.name
    } else {
      assignees = gradeStudents.filter(s => selectedStudentIds.has(s.id)).map(s => ({ id: s.id, name: s.name }))
    }

    if (assignees.length === 0) { setSaveError('Select at least one student.'); return }

    const activity = activities.find(a => a.id === selActivity)
    const subject  = subjects.find(s => s.id === selSubject)

    setSaving(true)
    try {
      await addWeeklyPlan({
        teacherId:    profile?.uid || profile?.id,
        classId, grade: gradeFilter,
        subjectId:    selSubject, subjectName: subject?.name || '',
        categoryId:   activity?.categoryId, categoryName: activity?.categoryName,
        skillId:      activity?.skillId,    skillName:    activity?.skillName,
        activityId:   selActivity, activityName: activity?.name || '',
        assignees, groupId, groupName,
        fromDate, toDate,
      })
      setSaveSuccess(`Assigned "${activity?.name}" to ${assignees.length} student${assignees.length > 1 ? 's' : ''}.`)
      setTimeout(() => setSaveSuccess(''), 2500)
      setSelectedStudentIds(new Set())
      const pls = await getWeeklyPlansByClass(classId)
      setPlans(pls)
    } catch (e) {
      setSaveError('Failed to save: ' + (e?.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveBatch = async () => {
    if (!confirmBatch) return
    try {
      await deleteWeeklyPlanBatch(confirmBatch)
      const pls = await getWeeklyPlansByClass(classId)
      setPlans(pls)
    } catch (e) {
      console.error('Failed to remove plan:', e)
    } finally {
      setConfirmBatch(null)
    }
  }

  // Group plan rows by batch for the "Currently Planned" list
  const batches = useMemo(() => {
    const map = {}
    plans.forEach(p => {
      if (!map[p.batchId]) map[p.batchId] = { ...p, students: [] }
      map[p.batchId].students.push(p.studentName)
    })
    return Object.values(map).sort((a, b) => (a.fromDate || '').localeCompare(b.fromDate || ''))
  }, [plans])

  const visibleBatches = batches.filter(b =>
    b.grade === gradeFilter && (!listSubjectFilter || b.subjectId === listSubjectFilter)
  )

  const handleExportList = () => {
    const rows = plans.filter(p =>
      p.grade === gradeFilter && (!listSubjectFilter || p.subjectId === listSubjectFilter)
    )
    const subjName = subjects.find(s => s.id === listSubjectFilter)?.name || 'All_Subjects'
    exportWeeklyPlanToExcel(rows, `${classId}_${gradeFilter}_${subjName}_plan_list`)
  }

  if (loading) return <Spinner center />

  return (
    <div>
      <PageHeader role="teacher" title="Weekly Plan"
        subtitle="Plan the week's activities per student or group, then track them in the Overview." />

      {/* Inner tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'rgba(255,255,255,.5)', padding: 4, borderRadius: 12, width: 'fit-content' }}>
        <div className={`tab ${innerTab === 'create' ? 'active' : ''}`} onClick={() => setInnerTab('create')}>Create Plan</div>
        <div className={`tab ${innerTab === 'overview' ? 'active' : ''}`} onClick={() => setInnerTab('overview')}>Weekly Overview</div>
      </div>

      {innerTab === 'overview' ? (
        <WeeklyPlanTable classId={classId} />
      ) : (
        <>
          {/* ── Create assignment ─────────────────────────────────────── */}
          <div className="glass" style={{ borderRadius: 14, padding: 20, marginBottom: 22 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#2D3748', marginBottom: 14 }}>Assign an activity</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
              <div>
                <label className="form-label">Grade</label>
                <select className="form-select" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Subject</label>
                <select className="form-select" value={selSubject} onChange={e => setSelSubject(e.target.value)}>
                  <option value="">Select subject...</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Activity</label>
                <select className="form-select" value={selActivity} onChange={e => setSelActivity(e.target.value)} disabled={!selSubject}>
                  <option value="">Select activity...</option>
                  {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, maxWidth: 360 }}>
              <div>
                <label className="form-label">From Date</label>
                <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">To Date</label>
                <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>

            {/* Assign to: individual students or a group */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div className={`tab ${assignMode === 'individual' ? 'active' : ''}`} onClick={() => setAssignMode('individual')}>Individual Students</div>
              <div className={`tab ${assignMode === 'group' ? 'active' : ''}`} onClick={() => setAssignMode('group')}>Student Group</div>
            </div>

            {assignMode === 'individual' ? (
              gradeStudents.length === 0 ? (
                <EmptyState icon="🎓" message={`No students in ${gradeFilter} yet.`} />
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => setSelectedStudentIds(new Set(gradeStudents.map(s => s.id)))}>Select all</button>
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => setSelectedStudentIds(new Set())}>Clear</button>
                    <div style={{ fontSize: 12, color: '#A0AEC0', alignSelf: 'center' }}>{selectedStudentIds.size} selected</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 2, maxHeight: 220, overflowY: 'auto', border: '1px solid #EDF2F7', borderRadius: 10, padding: 8 }}>
                    {gradeStudents.map(s => (
                      <label key={s.id} className="checkbox-row">
                        <input type="checkbox" checked={selectedStudentIds.has(s.id)} onChange={() => toggleStudent(s.id)} />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Group</label>
                    <select className="form-select" value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
                      <option value="">Select group...</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.studentIds.length})</option>)}
                    </select>
                  </div>
                  <button className="btn-ghost" style={{ fontSize: 13, whiteSpace: 'nowrap' }}
                    onClick={() => setShowNewGroupForm(v => !v)}>
                    {showNewGroupForm ? 'Cancel' : '+ New Group'}
                  </button>
                </div>

                {showNewGroupForm && (
                  <div style={{ border: '1.5px dashed #CBD5E0', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                    <label className="form-label">Group Name</label>
                    <input className="form-input" style={{ marginBottom: 10 }} value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Reading Circle A" />
                    <label className="form-label">Students in this group</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 2, maxHeight: 180, overflowY: 'auto', border: '1px solid #EDF2F7', borderRadius: 10, padding: 8, marginBottom: 10 }}>
                      {gradeStudents.map(s => (
                        <label key={s.id} className="checkbox-row">
                          <input type="checkbox" checked={newGroupStudentIds.has(s.id)} onChange={() => toggleNewGroupStudent(s.id)} />
                          {s.name}
                        </label>
                      ))}
                    </div>
                    <button className="btn-primary" style={{ fontSize: 13, padding: '7px 16px' }} onClick={handleCreateGroup}>
                      Save Group
                    </button>
                  </div>
                )}
              </div>
            )}

            {saveError && <div className="error-box" style={{ marginTop: 14 }}>⚠️ {saveError}</div>}
            {saveSuccess && <div className="success-box" style={{ marginTop: 14 }}>✅ {saveSuccess}</div>}

            <button className="btn-primary" style={{ marginTop: 16 }} onClick={handleAddPlan} disabled={saving}>
              {saving ? 'Saving…' : '+ Add to Weekly Plan'}
            </button>
          </div>

          {/* ── Currently planned list ────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#2D3748' }}>Currently Planned — {gradeFilter}</div>
            <select className="form-select" style={{ width: 200 }} value={listSubjectFilter} onChange={e => setListSubjectFilter(e.target.value)}>
              <option value="">All subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div style={{ flex: 1 }} />
            <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={handleExportList} disabled={visibleBatches.length === 0}>
              📥 Export list
            </button>
          </div>

          {visibleBatches.length === 0 ? (
            <EmptyState icon="🗓️" message="No activities planned yet for this grade/subject." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visibleBatches.map(b => (
                <div key={b.batchId} className="glass" style={{ borderRadius: 12, padding: 14, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#2D3748' }}>{b.activityName}</span>
                      <GradeBadge grade={b.grade} />
                      {b.groupName && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: TEAL, background: 'rgba(59,191,178,.1)', padding: '2px 8px', borderRadius: 10 }}>
                          👥 {b.groupName}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>
                      {b.subjectName} · {formatDateRangeLabel(b.fromDate, b.toDate)}
                    </div>
                    <div style={{ fontSize: 12, color: '#4A5568' }}>
                      {b.students.join(', ')}
                    </div>
                  </div>
                  <button className="btn-danger" onClick={() => setConfirmBatch(b.batchId)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {confirmBatch && (
        <ConfirmDialog
          message="Remove this planned activity for all assigned students? This can't be undone."
          onConfirm={handleRemoveBatch}
          onCancel={() => setConfirmBatch(null)}
        />
      )}
    </div>
  )
}
