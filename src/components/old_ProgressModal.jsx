// src/components/ProgressModal.jsx — Supabase version
import { useState, useEffect } from 'react'
import { supabase } from '../supabase/client'
import { useAuth } from '../contexts/AuthContext'
import { LEVELS, LEVEL_COLORS } from '../utils/theme'
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
  const [categories,  setCategories]  = useState([])
  // FIX 2: skills are no longer a separate selection step. Instead, once a
  // category is chosen we load every skill under it plus that skill's
  // activities, and render each skill as a subheading above its activities.
  const [skillGroups, setSkillGroups] = useState([]) // [{ skill, activities: [...] }]

  const [selSubject,  setSelSubject]  = useState('')
  const [selCategory, setSelCategory] = useState('')
  const [term,        setTerm]        = useState('T1')
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0])

  // Per-activity state
  const [levels,      setLevels]      = useState({})  // activityId → level
  const [counts,      setCounts]      = useState({})  // activityId → new count to add
  const [existing,    setExisting]    = useState({})  // activityId → { level, total_practice_count, dates }

  const [note,        setNote]        = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [pastNotes,   setPastNotes]   = useState([]) // previous observations for this subject
  const [loading,     setLoading]     = useState(true)
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [savedBanner, setSavedBanner] = useState(false) // FIX 3: transient banner, not a full-screen takeover
  const [saveError,   setSaveError]   = useState('')
  const [downloadingObs, setDownloadingObs] = useState(false)

  const allActivities = skillGroups.flatMap(g => g.activities)

  // Load subjects
  useEffect(() => {
    setLoading(true)
    getSubjectsByGrade(student.grade)
      .then(setSubjects)
      .finally(() => setLoading(false))
  }, [student.grade])

  // Load categories when subject changes
  useEffect(() => {
    if (!selSubject) return
    setSelCategory(''); setSkillGroups([]); setLevels({}); setCounts({})
    getCategoriesBySubject(selSubject).then(setCategories)
  }, [selSubject])

  // FIX 2: load every skill under the chosen category, and every activity
  // under each of those skills, in one go — no more skill dropdown.
  useEffect(() => {
    if (!selCategory) { setSkillGroups([]); return }
    setLevels({}); setCounts({})
    setGroupsLoading(true)
    const load = async () => {
      const skillsList = await getSkillsByCategory(selCategory)
      const groups = await Promise.all(skillsList.map(async sk => {
        const acts = await getActivitiesBySkill(sk.id)
        return { skill: sk, activities: acts.map(a => ({ ...a, skillId: sk.id, skillName: sk.name })) }
      }))
      setSkillGroups(groups)
      setGroupsLoading(false)
    }
    load()
  }, [selCategory])

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
  }, [skillGroups, term, student.id])

  // Past teacher notes for this subject (notes are scoped by subject + month, not skill)
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

  // FIX 3: saving no longer force-closes the modal. `closeAfter` lets the
  // teacher explicitly choose to save-and-close; the default Save keeps the
  // modal open so they can keep navigating between subjects/categories for
  // the same student without having to re-open and re-pick the student.
  const handleSave = async (closeAfter = false) => {
    const toSave = allActivities.filter(a => levels[a.id])
    if (toSave.length === 0 && !note.trim()) {
      setSaveError('Please select at least one level before saving.')
      return
    }
    setSaving(true); setSaveError('')

    const subject  = subjects.find(s => s.id === selSubject)
    const category = categories.find(c => c.id === selCategory)

    try {
      for (const act of toSave) {
        await saveProgressRecord({
          studentId:     student.id,
          studentName:   student.name,
          classId:       student.classId || student.class_id,
          grade:         student.grade,
          term,
          subjectId:     selSubject,
          subjectName:   subject?.name    || '',
          categoryId:    selCategory,
          categoryName:  category?.name   || '',
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

      // Refresh "existing" progress so saved levels/counts/dates show as logged,
      // and clear the new-count inputs + note so the teacher can log the next
      // thing without stale values lingering.
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

      if (closeAfter) {
        onClose()
      }
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
      exportObservationsToExcel(obs, student.name)
    } catch (err) {
      console.error('Failed to download observations:', err)
    } finally {
      setDownloadingObs(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
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
            {/* FIX 3: the cross mark always closes, regardless of unsaved/saved state */}
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#A0AEC0' }}>×</button>
          </div>
        </div>
        <div className="divider" />

        {/* FIX 3: transient success banner instead of replacing the whole modal */}
        {savedBanner && (
          <div className="success-box" style={{ marginBottom: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            ✅ Progress saved for {student.name}. Keep going, or close whenever you're done.
          </div>
        )}

        {loading ? <Spinner center /> : (
          <>
            {/* Subject + Category */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label className="form-label">Subject</label>
                <select className="form-select" value={selSubject}
                  onChange={e => { setSelSubject(e.target.value); setSelCategory('') }}>
                  <option value="">Select subject...</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Category</label>
                <select className="form-select" value={selCategory}
                  onChange={e => setSelCategory(e.target.value)}
                  disabled={!selSubject}>
                  <option value="">Select category...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Date */}
            {selCategory && (
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Date of Presentation</label>
                <input type="date" className="form-input" value={date}
                  onChange={e => setDate(e.target.value)} style={{ maxWidth: 220 }} />
              </div>
            )}

            {/* Term tabs */}
            {selCategory && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: .8, flexShrink: 0 }}>
                  Recording for:
                </span>
                {['T1', 'T2', 'T3'].map(t => (
                  <div key={t} className={`term-tab ${term === t ? 'active' : ''}`} onClick={() => setTerm(t)}>
                    {t === 'T1' ? 'Term 1' : t === 'T2' ? 'Term 2' : 'Term 3'}
                  </div>
                ))}
              </div>
            )}

            {/* Activities table — grouped under skill subheadings (FIX 2) */}
            {selCategory && (
              <div className="glass" style={{ borderRadius: 12, padding: '4px 14px', marginBottom: 14 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0 8px', borderBottom: '1px solid #EDF2F7' }}>
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
                  <div style={{ padding: '20px 0' }}><Spinner center /></div>
                ) : skillGroups.length === 0 ? (
                  <div style={{ padding: '16px 0', fontSize: 13, color: '#A0AEC0', textAlign: 'center' }}>
                    No skills under this category. Add them in Curriculum.
                  </div>
                ) : skillGroups.map(group => (
                  <div key={group.skill.id}>
                    {/* Skill subheading — replaces the old skill dropdown */}
                    <div style={{
                      fontSize: 11, fontWeight: 800, color: '#2a7a74', textTransform: 'uppercase',
                      letterSpacing: .8, padding: '12px 0 6px',
                    }}>
                      {group.skill.name}
                    </div>

                    {group.activities.length === 0 ? (
                      <div style={{ padding: '10px 0', fontSize: 12, color: '#A0AEC0' }}>
                        No activities under this skill. Add them in Curriculum.
                      </div>
                    ) : group.activities.map(act => {
                      const curr        = levels[act.id]
                      const existingRec = existing[act.id]
                      const totalSoFar  = existingRec?.totalCount || 0
                      const pastDates   = existingRec?.dates || []

                      return (
                        <div key={act.id} style={{ padding: '10px 0', borderBottom: '1px solid #F7FAFC' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, fontSize: 12, color: '#4A5568', lineHeight: 1.4 }}>
                              {act.name}
                            </div>
                            {/* Count input */}
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
                            {/* Level pills */}
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
                          {/* Show past dates if any */}
                          {pastDates.length > 0 && (
                            <div style={{ fontSize: 10, color: '#A0AEC0', marginTop: 4, paddingLeft: 4 }}>
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

            {/* Teacher note */}
            {selCategory && (
              <div>
                {/* Month picker for observation */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label">Observation Month</label>
                    <input type="month" className="form-input"
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                      style={{ maxWidth: 180 }} />
                  </div>
                </div>

                {/* Past observations dropdown */}
                {pastNotes.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
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
                <textarea className="form-textarea" rows={3}
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
              </div>
            )}

            {/* Save — FIX 3: saving no longer closes the modal by default.
                "Save" keeps it open so the teacher can pick another subject/category
                for the same student. "Save & Close" or the × does the closing. */}
            {selCategory && (
              <div style={{ marginTop: 16 }}>
                {saveError && (
                  <div className="error-box" style={{ marginBottom: 10, fontSize: 13 }}>⚠️ {saveError}</div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>Close</button>
                  <button className="btn-primary" style={{ flex: 2 }} onClick={() => handleSave(false)} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn-peach" style={{ flex: 2 }} onClick={() => handleSave(true)} disabled={saving}>
                    {saving ? 'Saving…' : 'Save & Close'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
