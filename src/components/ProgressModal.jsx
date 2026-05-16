import { useState, useEffect } from 'react'
import { saveProgressRecord, saveTeacherNote, getProgressByStudent, getAllTeacherNotesByStudent } from '../firebase/services'
import { useAuth } from '../contexts/AuthContext'
import { LEVELS, LEVEL_COLORS } from '../utils/theme'
import { GradeBadge, Spinner } from './UI'

export default function ProgressModal({ student, curriculum, onClose, onSaved }) {
  const { profile } = useAuth()
  const [term,     setTerm]    = useState('T1')
  const [area,     setArea]    = useState(null)
  const [subArea,  setSubArea] = useState(null)
  const [date,     setDate]    = useState(new Date().toISOString().split('T')[0])
  const [count,    setCount]   = useState('')
  const [levels,   setLevels]  = useState({})   // skillId → { T1, T2, T3 } → level string
  const [note,     setNote]    = useState('')
  const [saving,   setSaving]  = useState(false)
  const [saved,    setSaved]   = useState(false)
  const [loading,  setLoading] = useState(false)
  const [existing, setExisting]= useState([])   // existing progress records for this student

  const skills = area && subArea
    ? curriculum.find(a => a.id === area)?.subAreas?.find(s => s.id === subArea)?.skills || []
    : []

  // Load existing progress for this student so we can pre-show current levels
  useEffect(() => {
    if (!student) return
    setLoading(true)
    getProgressByStudent(student.id).then(recs => {
      setExisting(recs)
      // Build levels map from existing records
      const map = {}
      recs.forEach(r => {
        if (!map[r.skillId]) map[r.skillId] = {}
        map[r.skillId][r.term] = r.level
      })
      setLevels(map)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [student?.id])

  const setSkillLevel = (skillId, t, lvl) => {
    setLevels(prev => ({
      ...prev,
      [skillId]: {
        ...(prev[skillId] || {}),
        [t]: prev[skillId]?.[t] === lvl ? null : lvl,
      },
    }))
  }

  const handleSave = async () => {
  if (!area || !subArea) return
  setSaving(true)
  try {
    const areaObj = curriculum.find(a => a.id === area)
    const subObj = areaObj?.subAreas?.find(s => s.id === subArea)

    const promises = skills.map(async (skill) => {
      const lvl = levels[skill.id]?.[term]
      if (!lvl) return

      console.log('Saving skill:', skill.id, skill.name, '| level:', lvl, '| student:', student.id)

      return saveProgressRecord({
        studentId: student.id,
        studentName: student.name,
        classId: student.classId,
        grade: student.grade,
        areaId: area,
        areaName: areaObj?.name || '',
        subAreaId: subArea,
        subAreaName: subObj?.name || '',
        skillId: skill.id,
        skillName: skill.name,
        term,
        level: lvl,
        dateOfPresentation: date,
        practiceCount: count ? Number(count) : null,
        loggedBy: profile?.uid || '',
        loggedByName: profile?.name || '',
      })
    })

    if (note.trim()) {
      promises.push(saveTeacherNote({
        studentId: student.id,
        classId: student.classId,
        areaId: area,
        areaName: areaObj?.name || '',
        term,
        note: note.trim(),
        loggedBy: profile?.uid || '',
      }))
    }

    await Promise.all(promises)
    setSaved(true)
    setTimeout(() => { onSaved?.(); onClose() }, 1300)

  } catch (err) {
    console.error(err)
  } finally {
    setSaving(false)
  }
}

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {saved ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
            <div style={{ fontFamily: 'Playfair Display', fontSize: 20, fontWeight: 700, color: '#2D3748' }}>Progress Saved!</div>
            <div style={{ color: '#718096', marginTop: 8 }}>Record logged for {student.name}</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: 'Playfair Display', fontSize: 20, fontWeight: 700, color: '#2D3748' }}>Log Progress</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                  <span style={{ fontSize: 14, color: '#4A5568', fontWeight: 500 }}>{student.name}</span>
                  <GradeBadge grade={student.grade} />
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#A0AEC0' }}>×</button>
            </div>
            <div className="divider" />

            {loading ? <Spinner center /> : (
              <>
                {/* Row 1: Area + Sub-area side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label className="form-label">Area</label>
                    <select className="form-select" value={area || ''} onChange={e => { setArea(e.target.value || null); setSubArea(null) }}>
                      <option value="">Select area...</option>
                      {curriculum.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Sub-Area</label>
                    <select className="form-select" value={subArea || ''} onChange={e => setSubArea(e.target.value || null)} disabled={!area}>
                      <option value="">Select sub-area...</option>
                      {(curriculum.find(a => a.id === area)?.subAreas || []).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Date + Practice Count */}
                {subArea && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label className="form-label">Date of Presentation</label>
                      <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Practice Count</label>
                      <input type="number" className="form-input" placeholder="e.g. 3" value={count} onChange={e => setCount(e.target.value)} min="0" />
                    </div>
                  </div>
                )}

                {/* Row 3: Term tabs */}
                {subArea && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: .8, flexShrink: 0 }}>Recording for:</span>
                    {['T1', 'T2', 'T3'].map(t => (
                      <div key={t} className={`term-tab ${term === t ? 'active' : ''}`} onClick={() => setTerm(t)}>
                        {t === 'T1' ? 'Term 1' : t === 'T2' ? 'Term 2' : 'Term 3'}
                      </div>
                    ))}
                  </div>
                )}

                {/* Row 4: Skills table */}
                {subArea && skills.length > 0 && (
                  <div className="glass" style={{ borderRadius: 12, padding: '4px 14px', marginBottom: 14 }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0 8px', borderBottom: '1px solid #EDF2F7' }}>
                      <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#A0AEC0', textTransform: 'uppercase', letterSpacing: .8 }}>Skill</div>
                      {LEVELS.map(l => (
                        <div key={l} style={{ width: 38, textAlign: 'center', fontSize: 11, fontWeight: 800, color: LEVEL_COLORS[l] }}>{l}</div>
                      ))}
                    </div>
                    {/* Skill rows */}
                    {skills.map((skill) => {
                      const curr = levels[skill.id]?.[term]
                      return (
                        <div key={skill.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0', borderBottom: '1px solid #F7FAFC' }}>
                          <div style={{ flex: 1, fontSize: 12, color: '#4A5568', lineHeight: 1.4, paddingRight: 8 }}>{skill.name}</div>
                          {LEVELS.map(l => {
                            const isSelected = curr === l
                            return (
                              <div
                                key={l}
                                onClick={() => setSkillLevel(skill.id, term, l)}
                                style={{
                                  width: 38, height: 38, borderRadius: 8,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                                  transition: 'all .15s',
                                  background: isSelected ? LEVEL_COLORS[l] : `${LEVEL_COLORS[l]}22`,
                                  color: isSelected ? 'white' : LEVEL_COLORS[l],
                                  border: `2px solid ${isSelected ? LEVEL_COLORS[l] : 'transparent'}`,
                                  transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                                  boxShadow: isSelected ? `0 2px 8px ${LEVEL_COLORS[l]}55` : 'none',
                                  userSelect: 'none',
                                }}>
                                {l}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Row 5: Teacher note + AI box */}
                {subArea && (
                  <div>
                    <label className="form-label">
                      Teacher Note for {term === 'T1' ? 'Term 1' : term === 'T2' ? 'Term 2' : 'Term 3'}
                      <span style={{ color: '#A0AEC0', textTransform: 'none', fontWeight: 400, marginLeft: 4, fontSize: 11 }}>(optional)</span>
                    </label>
                    <textarea
                      className="form-textarea" rows={3}
                      placeholder="Add your observations for this term..."
                      value={note} onChange={e => setNote(e.target.value)}
                      style={{ resize: 'vertical' }}
                    />
                    <div className="ai-note-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <span style={{ fontSize: 14 }}>🤖</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#2a7a74', textTransform: 'uppercase', letterSpacing: .8 }}>AI Report Note</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#4A5568', lineHeight: 1.5 }}>
                        Your note above will be used by the AI to generate the narrative paragraph for this area in the report card. Write in full sentences for best results.
                      </div>
                    </div>
                  </div>
                )}

                {subArea && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button className="btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                    <button className="btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving…' : 'Save Progress'}
                    </button>
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
