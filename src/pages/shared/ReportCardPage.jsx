import { useState, useEffect } from 'react'
import { collection, getDocs, query, where } from 'supabase/firestore'
import { db } from '../../supabase/config'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Spinner, SearchInput, GradeBadge, EmptyState } from '../../components/UI'
import { getAllStudents, getStudentsByClass, getAllTeacherNotesByStudent } from '../../supabase/services'
import { CLASSES, LEVEL_COLORS, TEAL, PEACH } from '../../utils/theme'
import { generateNarrativeWithGemini, exportReportCardHTML, exportReportCardExcel } from '../../utils/exportUtils'

// ─── Level weights ────────────────────────────────────────────────────────────
const LEVEL_WEIGHT = { M: 1, A: 2, R: 3, P: 4 }
const WEIGHT_LEVEL = { 1: 'M', 2: 'A', 3: 'R', 4: 'P' }

// Round to nearest — 3.5 and above → P (4), below → R (3)
const weightToLevel = (avg) => {
  const rounded = Math.round(avg)
  const clamped = Math.min(4, Math.max(1, rounded))
  return WEIGHT_LEVEL[clamped]
}

// ─── Fetch all progress for a student ────────────────────────────────────────
const getProgressForStudent = async (studentId) => {
  const q    = query(collection(db, 'progress'), where('studentId', '==', studentId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ─── Fetch full 4-layer curriculum for a grade ────────────────────────────────
/*const getCurriculumForGrade = async (grade) => {
  const subSnap = await getDocs(query(collection(db, 'subjects'), where('grade', '==', grade)))
  const subjects = subSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  for (const sub of subjects) {
    const catSnap = await getDocs(collection(db, 'subjects', sub.id, 'categories'))
    sub.categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    for (const cat of sub.categories) {
      const skillSnap = await getDocs(collection(db, 'subjects', sub.id, 'categories', cat.id, 'skills'))
      cat.skills = skillSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

      for (const skill of cat.skills) {
        const actSnap = await getDocs(collection(db, 'subjects', sub.id, 'categories', cat.id, 'skills', skill.id, 'activities'))
        skill.activities = actSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      }
    }
  }
  return subjects
}
*/
// ─── Compute skill progress per term ─────────────────────────────────────────
// Returns: { skillId: { T1: { avg, level, count }, T2: ..., T3: ... } }
const computeSkillProgress = (progressRecords, curriculum) => {
  const result = {}

  for (const subject of curriculum) {
    for (const cat of subject.categories) {
      for (const skill of cat.skills) {
        result[skill.id] = {}
        for (const term of ['T1', 'T2', 'T3']) {
          // Get all activity records for this skill + term
          const termRecs = progressRecords.filter(r =>
            r.skillId === skill.id && r.term === term && LEVEL_WEIGHT[r.level]
          )
          if (termRecs.length === 0) {
            result[skill.id][term] = null // no data this term
          } else {
            const weights = termRecs.map(r => LEVEL_WEIGHT[r.level])
            const avg     = weights.reduce((s, w) => s + w, 0) / weights.length
            result[skill.id][term] = {
              avg:   avg.toFixed(1),
              level: weightToLevel(avg),
              count: termRecs.length,
            }
          }
        }
      }
    }
  }
  return result
}

// ─── AI narrative stubs (Gemini) ──────────────────────────────────────────────
const generateNarrative = async (subjectName, skills, skillProgress, teacherNotes, studentName) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) return null

  const skillLines = skills.map(skill => {
    const p = skillProgress[skill.id] || {}
    const parts = ['T1', 'T2', 'T3']
      .filter(t => p[t])
      .map(t => `${t}: ${p[t].level} (avg ${p[t].avg}/4)`)
    return `- ${skill.name}: ${parts.join(', ') || 'no data'}`
  }).join('\n')

  const note = teacherNotes
    .filter(n => n.subjectId && n.subjectName === subjectName)
    .map(n => n.note).join(' ')

  const prompt = `You are writing a Montessori school report card for ${studentName}.

Subject: ${subjectName}

Skill progress (M=1,A=2,R=3,P=4, averaged across activities):
${skillLines}

Teacher observations: ${note || 'None provided'}

Write a warm, encouraging 3-4 sentence paragraph summarising this student's progress.
Use the student's name. Do not mention level codes. No heading — just the paragraph.`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
        }),
      }
    )
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch { return null }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportCardPage({ role }) {
  const { profile } = useAuth()
  const [mode,       setMode]       = useState('student')
  const [selClass,   setSelClass]   = useState('')
  const [students,   setStudents]   = useState([])
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState(null)
  const [curriculum, setCurriculum] = useState([])
  const [progress,   setProgress]   = useState([])   // raw records
  const [skillProg,  setSkillProg]  = useState({})   // computed per skill per term
  const [notes,      setNotes]      = useState([])
  const [narratives, setNarratives] = useState({})   // subjectId → text
  const [generating, setGenerating] = useState(false)
  const [generated,  setGenerated]  = useState(false)
  const [genPct,     setGenPct]     = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  // Load student list
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const list = role === 'teacher'
          ? await getStudentsByClass(profile?.classId)
          : await getAllStudents()
        setStudents(list)
      } catch (e) { setError('Failed to load students.') }
      finally { setLoading(false) }
    }
    load()
  }, [role])

  // When student selected — load curriculum + progress + notes
  useEffect(() => {
    if (!selected) return
    const load = async () => {
      try {
        const [curric, recs, notesList] = await Promise.all([
          getCurriculumForGrade(selected.grade),
          getProgressForStudent(selected.id),
          getAllTeacherNotesByStudent(selected.id),
        ])
        setCurriculum(curric)
        setProgress(recs)
        setNotes(notesList)
        setSkillProg(computeSkillProgress(recs, curric))
        setNarratives({})
        setGenerated(false)
      } catch (e) { setError('Failed to load student data: ' + e.message) }
    }
    load()
  }, [selected?.id])

  const filtered = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  // ── Generate report card ──────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selected) return
    setGenerating(true); setGenerated(false); setNarratives({}); setGenPct(0); setError('')

    for (let i = 0; i < curriculum.length; i++) {
      const subject = curriculum[i]
      const allSkills = subject.categories.flatMap(c => c.skills)
      const narrative = await generateNarrative(
        subject.name, allSkills, skillProg, notes, selected.name
      )
      setNarratives(prev => ({ ...prev, [subject.id]: narrative || `${selected.name} has been working on ${subject.name} activities and continues to make good progress.` }))
      setGenPct(Math.round(((i + 1) / curriculum.length) * 100))
    }

    setGenerating(false)
    setGenerated(true)
  }

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = () => {
    if (!selected) return
    // Build simplified areas array for exportReportCardHTML
    const areas = curriculum.map(sub => ({
      id:   sub.id,
      name: sub.name,
      subAreas: sub.categories.map(cat => ({
        name: cat.name,
        skills: cat.skills.map(skill => ({
          id:   skill.id,
          name: skill.name,
        }))
      }))
    }))
    // Build progressMap in format expected by export: skillId → { T1: { level }, T2, T3 }
    const progMap = {}
    Object.entries(skillProg).forEach(([skillId, terms]) => {
      progMap[skillId] = {}
      Object.entries(terms).forEach(([t, val]) => {
        if (val) progMap[skillId][t] = { level: val.level }
      })
    })
    exportReportCardHTML(
      { ...selected, className: profile?.classId || '' },
      areas, progMap, narratives, null
    )
  }

  const handleDownloadExcel = () => {
    if (!selected) return
    const areas = curriculum.map(sub => ({
      name: sub.name,
      subAreas: sub.categories.map(cat => ({
        name:   cat.name,
        skills: cat.skills.map(s => ({ id: s.id, name: s.name }))
      }))
    }))
    const progMap = {}
    Object.entries(skillProg).forEach(([skillId, terms]) => {
      progMap[skillId] = {}
      Object.entries(terms).forEach(([t, val]) => {
        if (val) progMap[skillId][t] = { level: val.level }
      })
    })
    exportReportCardExcel(selected, areas, progMap)
  }

  // ── Report preview ────────────────────────────────────────────────────────
  const renderPreview = () => {
    if (!selected) return (
      <EmptyState icon="📄" message="Select a student to preview their report card" />
    )

    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, lineHeight: 1.6 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 18, paddingBottom: 14, borderBottom: '2px solid #EDF2F7' }}>
          <div style={{ fontSize: 20, fontFamily: 'Playfair Display', fontWeight: 700, color: '#2D3748' }}>
            🪷 Kamala Niketan
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEAL, marginTop: 3 }}>
            Year End Progress Report 2025–2026
          </div>
        </div>

        {/* Student info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 16, fontSize: 12 }}>
          <div><b>Name:</b> {selected.name}</div>
          <div><b>Grade:</b> {selected.grade}</div>
          <div><b>Class:</b> {selected.classId}</div>
          <div><b>Principal:</b> Mrs. Mala Sivakumar</div>
        </div>

        {/* Attendance */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#2D3748', marginBottom: 6 }}>Attendance</div>
          <div className="rc-table-wrap">
            <table>
              <thead><tr><th>Term 1</th><th>Term 2</th><th>Term 3</th><th>Total</th></tr></thead>
              <tbody><tr>
                <td style={{ textAlign: 'center' }}>— / —</td>
                <td style={{ textAlign: 'center' }}>— / —</td>
                <td style={{ textAlign: 'center' }}>— / —</td>
                <td style={{ textAlign: 'center' }}>— / —</td>
              </tr></tbody>
            </table>
          </div>
        </div>

        {/* Subjects */}
        {curriculum.map(subject => (
          <div key={subject.id} style={{ marginBottom: 20 }}>
            <div className="rc-section-header">{subject.name}</div>
            <div className="rc-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '52%' }}>Skill</th>
                    <th style={{ textAlign: 'center', width: '16%' }}>Term 1</th>
                    <th style={{ textAlign: 'center', width: '16%' }}>Term 2</th>
                    <th style={{ textAlign: 'center', width: '16%' }}>Term 3</th>
                  </tr>
                </thead>
                <tbody>
                  {subject.categories.flatMap(cat =>
                    cat.skills.map(skill => {
                      const sp = skillProg[skill.id] || {}
                      const cell = (t) => {
                        const d = sp[t]
                        if (!d) return <span style={{ color: '#CBD5E0' }}>—</span>
                        return (
                          <span title={`avg ${d.avg}/4 (${d.count} activities)`}
                            style={{ fontWeight: 800, color: LEVEL_COLORS[d.level], cursor: 'help' }}>
                            {d.level}
                          </span>
                        )
                      }
                      return (
                        <tr key={skill.id}>
                          <td style={{ fontSize: 11 }}>{skill.name}</td>
                          <td style={{ textAlign: 'center' }}>{cell('T1')}</td>
                          <td style={{ textAlign: 'center' }}>{cell('T2')}</td>
                          <td style={{ textAlign: 'center' }}>{cell('T3')}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>

              {/* AI narrative */}
              {narratives[subject.id] ? (
                <div style={{ fontSize: 11, color: '#4A5568', padding: '10px 12px', background: 'rgba(59,191,178,.04)', lineHeight: 1.7, borderTop: '1px solid #EDF2F7' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: .8 }}>🤖 AI Narrative · </span>
                  {narratives[subject.id]}
                </div>
              ) : generating ? (
                <div style={{ padding: '10px 12px', borderTop: '1px solid #EDF2F7' }}>
                  <div className="ai-streaming" style={{ width: '95%' }} />
                  <div className="ai-streaming" style={{ width: '78%' }} />
                  <div className="ai-streaming" style={{ width: '55%' }} />
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#CBD5E0', fontStyle: 'italic', padding: '7px 12px', borderTop: '1px solid #EDF2F7' }}>
                  Narrative will appear after generation
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Legend */}
        {generated && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '2px solid #EDF2F7', fontSize: 11, color: '#718096', lineHeight: 1.8 }}>
            <b>Level of Achievement</b> — <b>P</b> Proficient (4) · <b>R</b> Reaching milestone (3) · <b>A</b> Advancing (2) · <b>M</b> Making an effort (1)<br />
            <b>Formula:</b> Each skill level = average of all activity levels logged for that skill (rounded to nearest level) · <b>—</b> Not yet recorded
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        role={role}
        title="Report Card Generator"
        subtitle="Skill score = average of activity levels (M=1, A=2, R=3, P=4)"
      />

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Admin mode tabs */}
      {role === 'admin' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'rgba(255,255,255,.5)', padding: 4, borderRadius: 12, width: 'fit-content' }}>
          <div className={`tab ${mode === 'student' ? 'active' : ''}`}
            onClick={() => { setMode('student'); setSelClass(''); setSelected(null); setGenerated(false) }}>
            Individual Student
          </div>
          <div className={`tab ${mode === 'class' ? 'active' : ''}`}
            onClick={() => { setMode('class'); setSelected(null); setGenerated(false) }}>
            By Class (Batch)
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="glass" style={{ borderRadius: 16, padding: 20 }}>

            {/* Class batch — admin only */}
            {role === 'admin' && mode === 'class' && (
              <>
                <div style={{ fontWeight: 700, color: '#2D3748', fontSize: 14, marginBottom: 14 }}>Select Class</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {CLASSES.map(c => (
                    <div key={c} onClick={() => { setSelClass(c); setGenerated(false); setNarratives({}) }}
                      style={{
                        padding: '10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                        fontWeight: 600, fontSize: 14,
                        border: `1.5px solid ${selClass === c ? TEAL : '#E2E8F0'}`,
                        background: selClass === c ? 'rgba(59,191,178,.1)' : 'white',
                        color: selClass === c ? TEAL : '#2D3748', transition: 'all .18s',
                      }}>{c}</div>
                  ))}
                </div>
              </>
            )}

            {/* Individual student picker */}
            {(mode === 'student' || role === 'teacher') && (
              <>
                <div style={{ fontWeight: 700, color: '#2D3748', fontSize: 14, marginBottom: 12 }}>Select Student</div>
                <div style={{ marginBottom: 10 }}>
                  <SearchInput value={search} onChange={setSearch} placeholder="Search student..." />
                </div>
                {loading ? <Spinner center /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 360, overflowY: 'auto' }}>
                    {filtered.map(s => (
                      <div key={s.id}
                        onClick={() => { setSelected(s); setGenerated(false); setNarratives({}) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          borderRadius: 10, cursor: 'pointer', transition: 'all .18s',
                          background: selected?.id === s.id ? 'rgba(59,191,178,.12)' : 'transparent',
                          border: `1.5px solid ${selected?.id === s.id ? TEAL : 'transparent'}`,
                        }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: `linear-gradient(135deg, ${TEAL}22, ${PEACH}22)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 13, color: '#2D3748',
                        }}>{s.name[0]}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#2D3748' }}>{s.name}</div>
                          <GradeBadge grade={s.grade} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Generate + download buttons */}
          {(selected || selClass) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn-primary" style={{ width: '100%' }}
                onClick={handleGenerate} disabled={generating}>
                {generating ? `Generating… ${genPct}%` : '✨ Generate Report Card'}
              </button>
              {generating && (
                <div style={{ background: '#EDF2F7', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: TEAL, borderRadius: 99, width: `${genPct}%`, transition: 'width .4s' }} />
                </div>
              )}
              {generated && (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-peach" style={{ flex: 1, fontSize: 13 }} onClick={handleDownload}>
                      📥 Download (.html)
                    </button>
                    <button className="btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={handleDownloadExcel}>
                      📊 .xlsx
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#A0AEC0', textAlign: 'center', lineHeight: 1.5 }}>
                    Open .html in browser → Print → Save as PDF
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right — preview */}
        <div className="glass" style={{ borderRadius: 16, padding: 28, minHeight: 400 }}>
          {renderPreview()}
        </div>
      </div>
    </div>
  )
}
