// src/components/ProgressModal.jsx — Supabase version
import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from '../contexts/AuthContext'
import { LEVELS, LEVEL_COLORS, TEAL, PEACH } from '../utils/theme'
import { GradeBadge, Spinner } from './UI'
import {
  saveProgressRecord,
  saveTeacherNote,
  getProgressByStudent,
  getSubjectsByGrade,
  getCategoriesBySubject,
  getSkillsByCategory,
  getActivitiesBySkill,
  getObservationsByStudent,
} from '../supabase/services'
import { exportObservationsToExcel } from '../utils/exportUtils'

export default function ProgressModal({ student, onClose, onSaved }) {
  const { profile } = useAuth()

  const [subjects,    setSubjects]    = useState([])
  // Choosing a Subject loads its whole tree in one go and shows it open:
  //   Category (section)  →  Skill (sub-topic)  →  Activities (rows)
  // so there is no Category or Skill dropdown to step through.
  const [categoryGroups, setCategoryGroups] = useState([]) // [{ category, skills: [{ skill, activities }] }]
  const [collapsed,   setCollapsed]   = useState(new Set()) // category ids the teacher folded away

  const [selSubject,  setSelSubject]  = useState('')
  const [term,        setTerm]        = useState('T1')
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0])

  // Per-activity state
  const [levels,      setLevels]      = useState({})  // activityId → level
  const [counts,      setCounts]      = useState({})  // activityId → new count to add
  const [existing,    setExisting]    = useState({})  // activityId → { level, totalCount, dates }

  const [note,        setNote]        = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [pastNotes,   setPastNotes]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [savedBanner, setSavedBanner] = useState(false)
  const [saveError,   setSaveError]   = useState('')
  const [downloadingObs, setDownloadingObs] = useState(false)

  const allActivities = categoryGroups.flatMap(c => c.skills.flatMap(s => s.activities))

  // Load subjects
  useEffect(() => {
    setLoading(true)
    getSubjectsByGrade(student.grade)
      .then(setSubjects)
      .finally(() => setLoading(false))
  }, [student.grade])

  // Load the whole Category → Skill → Activity tree when the subject changes
  useEffect(() => {
    setLevels({}); setCounts({}); setCollapsed(new Set())
    if (!selSubject) { setCategoryGroups([]); return }
    let cancelled = false
    setGroupsLoading(true)
    const load = async () => {
      try {
        const cats = await getCategoriesBySubject(selSubject)
        const groups = await Promise.all(cats.map(async cat => {
          const skillList = await getSkillsByCategory(cat.id)
          const skills = await Promise.all(skillList.map(async sk => {
            const acts = await getActivitiesBySkill(sk.id)
            return {
              skill: sk,
              activities: acts.map(a => ({
                ...a,
                skillId: sk.id,       skillName: sk.name,
                categoryId: cat.id,   categoryName: cat.name,
              })),
            }
          }))
          return { category: cat, skills }
        }))
        if (!cancelled) setCategoryGroups(groups)
      } catch (e) {
        console.error('Failed to load curriculum tree:', e)
        if (!cancelled) setCategoryGroups([])
      } finally {
        if (!cancelled) setGroupsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selSubject])

  // Load existing progress + pre-fill levels whenever the activity set or term changes
  useEffect(() => {
    if (allActivities.length === 0) { setExisting({}); return }
    let cancelled = false
    getProgressByStudent(student.id).then(progressRecs => {
      if (cancelled) return
      const actIds = new Set(allActivities.map(a => a.id))
      const existingMap = {}
      progressRecs.forEach(r => {
        if (r.term === term && r.activityId && actIds.has(r.activityId)) {
          existingMap[r.activityId] = {
            level:      r.level,
            totalCount: r.practiceCount || r.total_practice_count || 0,
            dates:      r.dates || [],
          }
        }
      })
      setExisting(existingMap)
      const preFillLevels = {}
      Object.entries(existingMap).forEach(([actId, rec]) => { preFillLevels[actId] = rec.level })
      setLevels(preFillLevels)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryGroups, term, student.id])

  // Past teacher notes for this subject (notes are scoped by subject + month)
  useEffect(() => {
    if (!selSubject) { setPastNotes([]); return }
    supabase
      .from('teacher_notes')
      .select('*')
      .eq('student_id', student.id)
      .eq('subject_id', selSubject)
      .order('month', { ascending: false })
      .then(({ data }) => setPastNotes(data || []))
  }, [selSubject, student.id])

  const setActivityLevel = (actId, lvl) => {
    setLevels(prev => ({ ...prev, [actId]: prev[actId] === lvl ? null : lvl }))
  }

  const toggleCategory = (catId) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(catId) ? next.delete(catId) : next.add(catId)
      return next
    })
  }

  // "Save" keeps the window open; "Save & Close" (or the ×) closes it.
  const handleSave = async (closeAfter = false) => {
    const toSave = allActivities.filter(a => levels[a.id])
    if (toSave.length === 0 && !note.trim()) {
      setSaveError('Please select at least one level before saving.')
      return
    }
    setSaving(true); setSaveError('')

    const subject = subjects.find(s => s.id === selSubject)

    try {
      for (const act of toSave) {
        await saveProgressRecord({
          studentId:     student.id,
          studentName:   student.name,
          classId:       student.classId || student.class_id,
          grade:         student.grade,
          term,
          subjectId:     selSubject,
          subjectName:   subject?.name || '',
          categoryId:    act.categoryId,
          categoryName:  act.categoryName || '',
          skillId:       act.skillId,
          skillName:     act.skillName,
          activityId:          act.id,
          activityName:        act.name,
          level:               levels[act.id],
          practiceCount:       counts[act.id] ? Number(counts[act.id]) : 0,
          dateOfPresentation:  date,
          loggedBy:            profile?.uid  || profile?.id || '',
          loggedByName:        profile?.name || '',
        })
      }

      if (note.trim()) {
        await saveTeacherNote({
          studentId:        student.id,
          classId:          student.classId || student.class_id,
          subjectId:        selSubject,
          subjectName:      subject?.name || '',
          term,
          month:            selectedMonth,
          observationDate:  new Date().toISOString().split('T')[0],
          note:             note.trim(),
          loggedBy:         profile?.uid || profile?.id || '',
        })
      }

      onSaved?.()

      const progressRecs = await getProgressByStudent(student.id)
      const actIds = new Set(allActivities.map(a => a.id))
      const existingMap = {}
      progressRecs.forEach(r => {
        if (r.term === term && r.activityId && actIds.has(r.activityId)) {
          existingMap[r.activityId] = {
            level:      r.level,
            totalCount: r.practiceCount || r.total_practice_count || 0,
            dates:      r.dates || [],
          }
        }
      })
      setExisting(existingMap)
      setCounts({})
      setNote('')

      setSavedBanner(true)
      setTimeout(() => setSavedBanner(false), 2200)

      if (closeAfter) onClose()
    } catch (err) {
      console.error('Save failed:', err)
      setSaveError('Save failed: ' + (err?.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadObservations = async () => {
    setDownloadingObs(true)
    try {
      const obs = await getObservationsByStudent(student.id)
      exportObservationsToExcel(obs, student.name, {
        [student.id]: { name: student.name, grade: student.grade },
      })
    } catch (err) {
      console.error('Failed to download observations:', err)
    } finally {
      setDownloadingObs(false)
    }
  }

  const totalActivities = allActivities.length
  const markedActivities = allActivities.filter(a => levels[a.id]).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        {/* Header — stays pinned at the top */}
        <div className="log-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display', fontSize: 20, fontWeight: 700, color: '#2D3748' }}>
              Log Progress
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
              <span style={{ fontSize: 14, color: '#4A5568', fontWeight: 500 }}>{student.name}</span>
              <GradeBadge grade={student.grade} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleDownloadObservations}
              disabled={downloadingObs}
              className="btn-ghost"
              style={{ fontSize: 11, padding: '6px 12px', whiteSpace: 'nowrap' }}>
              {downloadingObs ? '…' : '📥 Observations'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#A0AEC0' }}>×</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="log-body">
          {savedBanner && (
            <div className="success-box" style={{ marginBottom: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              ✅ Progress saved for {student.name}. Keep going, or close whenever you're done.
            </div>
          )}

          {loading ? <Spinner center /> : (
            <>
              {/* Selections in one row: Subject · Date · Term */}
              <div className="log-controls">
                <div>
                  <label className="form-label">Subject</label>
                  <select className="form-select" value={selSubject}
                    onChange={e => setSelSubject(e.target.value)}>
                    <option value="">Select subject...</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                {selSubject && (
                  <div>
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input" value={date}
                      onChange={e => setDate(e.target.value)} />
                  </div>
                )}
                {selSubject && (
                  <div>
                    <label className="form-label">Recording for</label>
                    <div className="log-term-group">
                      {['T1', 'T2', 'T3'].map(t => (
                        <div key={t} className={`term-tab ${term === t ? 'active' : ''}`} onClick={() => setTerm(t)}>
                          {t === 'T1' ? 'Term 1' : t === 'T2' ? 'Term 2' : 'Term 3'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!selSubject ? (
                <div className="log-hint">
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                  Choose a subject to see all its categories and activities for {student.name.split(' ')[0]}.
                </div>
              ) : (
                <div className="log-split">
                  {/* Left: Category → Skill → Activities, all open */}
                  <div style={{ minWidth: 0 }}>
                    {/* toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: '#718096' }}>
                        {categoryGroups.length} categor{categoryGroups.length === 1 ? 'y' : 'ies'} · {totalActivities} activities
                        {markedActivities > 0 && <span style={{ color: TEAL, fontWeight: 700 }}> · {markedActivities} marked</span>}
                      </div>
                      {categoryGroups.length > 1 && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={() => setCollapsed(new Set())}>Expand all</button>
                          <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={() => setCollapsed(new Set(categoryGroups.map(c => c.category.id)))}>Collapse all</button>
                        </div>
                      )}
                    </div>

                    {/* column header — stays visible while scrolling */}
                    <div className="log-act-head log-colhead">
                      <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: .8 }}>
                        Activity
                      </div>
                      <div style={{ width: 80, textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: .8 }}>
                        Count
                      </div>
                      {LEVELS.map(l => (
                        <div key={l} style={{ width: 38, textAlign: 'center', fontSize: 11, fontWeight: 800, color: LEVEL_COLORS[l] }}>{l}</div>
                      ))}
                    </div>

                    {groupsLoading ? (
                      <div className="glass" style={{ borderRadius: 12, padding: '24px 0' }}><Spinner center /></div>
                    ) : categoryGroups.length === 0 ? (
                      <div className="glass" style={{ borderRadius: 12, padding: '24px 16px', fontSize: 13, color: '#A0AEC0', textAlign: 'center' }}>
                        No categories under this subject. Add them in Curriculum.
                      </div>
                    ) : categoryGroups.map(({ category, skills }) => {
                      const catActs   = skills.flatMap(s => s.activities)
                      const catMarked = catActs.filter(a => levels[a.id]).length
                      const isOpen    = !collapsed.has(category.id)

                      return (
                        <div key={category.id} className="glass log-cat">
                          {/* LEVEL 1 — Category: bold banner */}
                          <div className="log-cat-head" onClick={() => toggleCategory(category.id)}>
                            <span className="log-cat-chevron" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
                            <span style={{ flex: 1, minWidth: 0 }}>{category.name}</span>
                            <span className="log-cat-count">{catMarked}/{catActs.length}</span>
                          </div>

                          {isOpen && (
                            <div style={{ padding: '4px 14px 8px' }}>
                              {skills.length === 0 ? (
                                <div style={{ padding: '10px 0', fontSize: 12, color: '#A0AEC0' }}>
                                  No skills under this category. Add them in Curriculum.
                                </div>
                              ) : skills.map(({ skill, activities }) => (
                                <div key={skill.id}>
                                  {/* LEVEL 2 — Skill: small coloured sub-topic */}
                                  <div className="log-skill-head" style={{ borderLeftColor: PEACH }}>
                                    {skill.name}
                                  </div>

                                  {activities.length === 0 ? (
                                    <div style={{ padding: '8px 0 8px 12px', fontSize: 12, color: '#A0AEC0' }}>
                                      No activities under this skill.
                                    </div>
                                  ) : activities.map(act => {
                                    const curr        = levels[act.id]
                                    const existingRec = existing[act.id]
                                    const totalSoFar  = existingRec?.totalCount || 0
                                    const pastDates   = existingRec?.dates || []

                                    // LEVEL 3 — Activity: plain indented row
                                    return (
                                      <div key={act.id} className="log-act" style={{ borderBottom: '1px solid #F7FAFC' }}>
                                        <div className="log-act-row">
                                          <div className="log-act-name" style={{ fontSize: 13, color: '#4A5568', lineHeight: 1.4 }}>
                                            {act.name}
                                          </div>
                                          <div style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                            <input
                                              type="number" min="0" placeholder="Add"
                                              value={counts[act.id] || ''}
                                              onChange={e => setCounts(prev => ({ ...prev, [act.id]: e.target.value }))}
                                              style={{
                                                width: 54, border: '1.5px solid #E2E8F0', borderRadius: 8,
                                                padding: '4px 6px', fontSize: 12, textAlign: 'center',
                                                outline: 'none', color: '#4A5568', background: '#FAFAFA',
                                              }}
                                            />
                                            {totalSoFar > 0 && (
                                              <span style={{ fontSize: 10, color: '#A0AEC0' }}>total: {totalSoFar}</span>
                                            )}
                                          </div>
                                          {LEVELS.map(l => {
                                            const isSelected = curr === l
                                            return (
                                              <div key={l}
                                                onClick={() => setActivityLevel(act.id, l)}
                                                style={{
                                                  width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                  fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all .15s',
                                                  background: isSelected ? LEVEL_COLORS[l] : `${LEVEL_COLORS[l]}22`,
                                                  color:      isSelected ? 'white' : LEVEL_COLORS[l],
                                                  border:     `2px solid ${isSelected ? LEVEL_COLORS[l] : 'transparent'}`,
                                                  transform:  isSelected ? 'scale(1.1)' : 'scale(1)',
                                                  boxShadow:  isSelected ? `0 2px 8px ${LEVEL_COLORS[l]}55` : 'none',
                                                  userSelect: 'none',
                                                }}>
                                                {l}
                                              </div>
                                            )
                                          })}
                                        </div>
                                        {pastDates.length > 0 && (
                                          <div style={{ fontSize: 10, color: '#A0AEC0', marginTop: 4 }}>
                                            📅 Previously logged: {pastDates.slice(-3).join(', ')}{pastDates.length > 3 ? ` +${pastDates.length - 3} more` : ''}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Right: monthly observation */}
                  <aside className="log-side glass" style={{ borderRadius: 12, padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#2D3748', marginBottom: 12 }}>Monthly Observation</div>
                    <div style={{ marginBottom: 12 }}>
                      <label className="form-label">Observation Month</label>
                      <input type="month" className="form-input"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)} />
                    </div>

                    {pastNotes.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <label className="form-label">Previous Observations</label>
                        <select className="form-select"
                          onChange={e => {
                            const selected = pastNotes.find(n => n.id === e.target.value)
                            if (selected) setNote(selected.note)
                          }}
                          defaultValue="">
                          <option value="">Select a past month to view...</option>
                          {pastNotes.map(n => (
                            <option key={n.id} value={n.id}>
                              {n.month || 'No month'} — {(n.note || '').slice(0, 40)}...
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <label className="form-label">
                      Observation for {selectedMonth}
                      <span style={{ color: '#A0AEC0', textTransform: 'none', fontWeight: 400, marginLeft: 4, fontSize: 11 }}>(optional)</span>
                    </label>
                    <textarea className="form-textarea" rows={6}
                      placeholder="Add your observations for this month..."
                      value={note} onChange={e => setNote(e.target.value)}
                      style={{ resize: 'vertical' }} />
                    <div className="ai-note-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <span style={{ fontSize: 14 }}>🤖</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#2a7a74', textTransform: 'uppercase', letterSpacing: .8 }}>AI Report Note</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#4A5568', lineHeight: 1.5 }}>
                        Your note will be used by AI to generate the narrative paragraph in the report card.
                      </div>
                    </div>
                  </aside>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — Save buttons stay visible without scrolling */}
        {!loading && selSubject && (
          <div className="log-foot">
            {saveError && (
              <div className="error-box" style={{ marginBottom: 10, fontSize: 13 }}>⚠️ {saveError}</div>
            )}
            <div className="log-foot-actions">
              <button className="btn-ghost" onClick={onClose}>Close</button>
              <button className="btn-primary" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button className="btn-peach" onClick={() => handleSave(true)} disabled={saving}>
                {saving ? 'Saving…' : 'Save & Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}