import { useState, useEffect } from 'react'
import { collection, doc, getDocs, setDoc, addDoc, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { LEVELS, LEVEL_COLORS, LEVEL_FULL } from '../../utils/theme'
import { GradeBadge, Spinner } from './UI'

// ─── Firestore helpers for 4-layer curriculum ─────────────────────────────────

const getSubjects = async (grade) => {
  const q    = query(collection(db, 'subjects'), where('grade', '==', grade))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

const getCategories = async (subjectId) => {
  const snap = await getDocs(collection(db, 'subjects', subjectId, 'categories'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

const getSkills = async (subjectId, categoryId) => {
  const snap = await getDocs(collection(db, 'subjects', subjectId, 'categories', categoryId, 'skills'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

const getActivities = async (subjectId, categoryId, skillId) => {
  const snap = await getDocs(collection(db, 'subjects', subjectId, 'categories', categoryId, 'skills', skillId, 'activities'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgressModal({ student, onClose, onSaved }) {
  const { profile } = useAuth()

  // Step state: subject → category → skill → activities table
  const [subjects,    setSubjects]    = useState([])
  const [categories,  setCategories]  = useState([])
  const [skills,      setSkills]      = useState([])
  const [activities,  setActivities]  = useState([])

  const [selSubject,  setSelSubject]  = useState('')
  const [selCategory, setSelCategory] = useState('')
  const [selSkill,    setSelSkill]    = useState('')
  const [term,        setTerm]        = useState('T1')
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0])
  const [counts,      setCounts]      = useState({})  // activityId → practice count
  const [note,        setNote]        = useState('')

  // levels: activityId → level string
  const [levels,      setLevels]      = useState({})

  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [saveError,   setSaveError]   = useState('')

  // Load subjects on open
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const subs = await getSubjects(student.grade)
        setSubjects(subs)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
  }, [student.grade])

  // Load categories when subject changes
  useEffect(() => {
    if (!selSubject) return
    setSelCategory(''); setSelSkill(''); setActivities([]); setLevels({})
    getCategories(selSubject).then(setCategories)
  }, [selSubject])

  // Load skills when category changes
  useEffect(() => {
    if (!selSubject || !selCategory) return
    setSelSkill(''); setActivities([]); setLevels({})
    getSkills(selSubject, selCategory).then(setSkills)
  }, [selCategory])

  // Load activities when skill changes
  useEffect(() => {
    if (!selSubject || !selCategory || !selSkill) return
    setLevels({})
    getActivities(selSubject, selCategory, selSkill).then(setActivities)
  }, [selSkill])

  const setActivityLevel = (actId, lvl) => {
    setLevels(prev => ({ ...prev, [actId]: prev[actId] === lvl ? null : lvl }))
  }

  const handleSave = async () => {
    const toSave = activities.filter(a => levels[a.id])
    if (toSave.length === 0 && !note.trim()) {
      setSaveError('Please select at least one level before saving.')
      return
    }
    setSaving(true); setSaveError('')

    const subjectName  = subjects.find(s => s.id === selSubject)?.name  || ''
    const categoryName = categories.find(c => c.id === selCategory)?.name || ''
    const skillName    = skills.find(s => s.id === selSkill)?.name        || ''

    try {
      for (const act of toSave) {
        const lvl   = levels[act.id]
        const docId = `${student.id}_${act.id}_${term}`.replace(/[^a-zA-Z0-9_-]/g, '-')
        await setDoc(doc(db, 'progress', docId), {
          studentId:          student.id,
          studentName:        student.name,
          classId:            student.classId,
          grade:              student.grade,
          term,
          // 4-layer references
          subjectId:          selSubject,
          subjectName,
          categoryId:         selCategory,
          categoryName,
          skillId:            selSkill,
          skillName,
          activityId:         act.id,
          activityName:       act.name,
          // level
          level:              lvl,
          // metadata
          dateOfPresentation: date,
          practiceCount:      counts[act.id] ? Number(counts[act.id]) : null,
          loggedBy:           profile?.uid  || '',
          loggedByName:       profile?.name || '',
          updatedAt:          serverTimestamp(),
        }, { merge: true })
      }

      // Save teacher note
      if (note.trim()) {
        await addDoc(collection(db, 'teacherNotes'), {
          studentId:   student.id,
          classId:     student.classId,
          subjectId:   selSubject,
          subjectName,
          skillId:     selSkill,
          skillName,
          term,
          note:        note.trim(),
          loggedBy:    profile?.uid || '',
          updatedAt:   serverTimestamp(),
        })
      }

      setSaved(true)
      setTimeout(() => { onSaved?.(); onClose() }, 1300)
    } catch (err) {
      console.error('Save failed:', err)
      setSaveError('Save failed: ' + (err?.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const gc = { PreKG: 'badge-PreKG', LKG: 'badge-LKG', UKG: 'badge-UKG' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {saved ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
            <div style={{ fontFamily: 'Playfair Display', fontSize: 20, fontWeight: 700, color: '#2D3748' }}>
              Progress Saved!
            </div>
            <div style={{ color: '#718096', marginTop: 8 }}>Record logged for {student.name}</div>
          </div>
        ) : (
          <>
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
              <button onClick={onClose}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#A0AEC0' }}>×</button>
            </div>
            <div className="divider" />

            {loading ? <Spinner center /> : (
              <>
                {/* Row 1: Subject + Category side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label className="form-label">Subject</label>
                    <select className="form-select" value={selSubject}
                      onChange={e => { setSelSubject(e.target.value); setSelCategory(''); setSelSkill('') }}>
                      <option value="">Select subject...</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Category</label>
                    <select className="form-select" value={selCategory}
                      onChange={e => { setSelCategory(e.target.value); setSelSkill('') }}
                      disabled={!selSubject}>
                      <option value="">Select category...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: Skill */}
                {selCategory && (
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Skill</label>
                    <select className="form-select" value={selSkill}
                      onChange={e => setSelSkill(e.target.value)}>
                      <option value="">Select skill...</option>
                      {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                {/* Row 3: Date of Presentation only */}
                {selSkill && (
                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Date of Presentation</label>
                    <input type="date" className="form-input" value={date}
                      onChange={e => setDate(e.target.value)} style={{ maxWidth: 220 }} />
                  </div>
                )}

                {/* Row 4: Term tabs */}
                {selSkill && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: .8, flexShrink: 0 }}>
                      Recording for:
                    </span>
                    {['T1', 'T2', 'T3'].map(t => (
                      <div key={t} className={`term-tab ${term === t ? 'active' : ''}`}
                        onClick={() => setTerm(t)}>
                        {t === 'T1' ? 'Term 1' : t === 'T2' ? 'Term 2' : 'Term 3'}
                      </div>
                    ))}
                  </div>
                )}

                {/* Row 5: Activities table with level pills */}
                {selSkill && (
                  <div className="glass" style={{ borderRadius: 12, padding: '4px 14px', marginBottom: 14 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0 8px', borderBottom: '1px solid #EDF2F7' }}>
                      <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: .8 }}>
                        Activity
                      </div>
                      <div style={{ width: 54, textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: .8 }}>
                        Count
                      </div>
                      {LEVELS.map(l => (
                        <div key={l} style={{ width: 38, textAlign: 'center', fontSize: 11, fontWeight: 800, color: LEVEL_COLORS[l] }}>{l}</div>
                      ))}
                    </div>

                    {activities.length === 0 ? (
                      <div style={{ padding: '16px 0', fontSize: 13, color: '#A0AEC0', textAlign: 'center' }}>
                        No activities under this skill yet. Add them in Curriculum.
                      </div>
                    ) : (
                      activities.map(act => {
                        const curr = levels[act.id]
                        return (
                          <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 0', borderBottom: '1px solid #F7FAFC' }}>
                            <div style={{ flex: 1, fontSize: 12, color: '#4A5568', lineHeight: 1.4, paddingRight: 4 }}>
                              {act.name}
                            </div>
                            <input
                              type="number" min="0"
                              placeholder="0"
                              value={counts[act.id] || ''}
                              onChange={e => setCounts(prev => ({ ...prev, [act.id]: e.target.value }))}
                              style={{
                                width: 54, border: '1.5px solid #E2E8F0', borderRadius: 8,
                                padding: '4px 6px', fontSize: 12, textAlign: 'center',
                                outline: 'none', color: '#4A5568', background: '#FAFAFA',
                              }}
                            />
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
                        )
                      })
                    )}
                  </div>
                )}

                {/* Row 6: Teacher note + AI box */}
                {selSkill && (
                  <div>
                    <label className="form-label">
                      Teacher Note for {term === 'T1' ? 'Term 1' : term === 'T2' ? 'Term 2' : 'Term 3'}
                      <span style={{ color: '#A0AEC0', textTransform: 'none', fontWeight: 400, marginLeft: 4, fontSize: 11 }}>(optional)</span>
                    </label>
                    <textarea className="form-textarea" rows={3}
                      placeholder="Add your observations for this term..."
                      value={note} onChange={e => setNote(e.target.value)}
                      style={{ resize: 'vertical' }} />
                    <div className="ai-note-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <span style={{ fontSize: 14 }}>🤖</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#2a7a74', textTransform: 'uppercase', letterSpacing: .8 }}>AI Report Note</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#4A5568', lineHeight: 1.5 }}>
                        Your note will be used by AI to generate the narrative paragraph in the report card. Write in full sentences for best results.
                      </div>
                    </div>
                  </div>
                )}

                {/* Save */}
                {selSkill && (
                  <div style={{ marginTop: 16 }}>
                    {saveError && (
                      <div className="error-box" style={{ marginBottom: 10, fontSize: 13 }}>⚠️ {saveError}</div>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                      <button className="btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save Progress'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
