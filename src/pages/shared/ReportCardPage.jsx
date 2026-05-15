import { useState, useEffect } from 'react'
import { getAllStudents, getStudentsByClass, getCurriculumByGrade, getProgressByStudent, getAllTeacherNotesByStudent } from '../../firebase/services'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Spinner, SearchInput, GradeBadge, EmptyState } from '../../components/UI'
import { CLASSES, LEVEL_COLORS, LEVEL_FULL, TEAL, PEACH } from '../../utils/theme'
import { generateNarrativeWithGemini, exportReportCardHTML, exportReportCardExcel } from '../../utils/exportUtils'

export default function ReportCardPage({ role }) {
  const { profile } = useAuth()
  const [mode,       setMode]       = useState('student') // 'student' | 'class' (admin only)
  const [selClass,   setSelClass]   = useState('')
  const [students,   setStudents]   = useState([])
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState(null)
  const [curriculum, setCurriculum] = useState([])
  const [progressMap,setProgressMap]= useState({})  // skillId → { T1, T2, T3 } → { level, date, count }
  const [notes,      setNotes]      = useState([])  // teacher notes array
  const [narratives, setNarratives] = useState({})  // areaId → narrative string
  const [generating, setGenerating] = useState(false)
  const [generated,  setGenerated]  = useState(false)
  const [genProgress,setGenProgress]= useState(0)
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
      } catch { setError('Failed to load students.') }
      finally { setLoading(false) }
    }
    load()
  }, [role])

  // When student selected — load their curriculum + progress + notes
  useEffect(() => {
    if (!selected) return
    const load = async () => {
      try {
        const [curric, recs, notesList] = await Promise.all([
          getCurriculumByGrade(selected.grade),
          getProgressByStudent(selected.id),
          getAllTeacherNotesByStudent(selected.id),
        ])
        setCurriculum(curric)
        setNotes(notesList)
        // Build progressMap: skillId → { T1: { level, date, count }, T2: ..., T3: ... }
        const map = {}
        recs.forEach(r => {
          if (!map[r.skillId]) map[r.skillId] = {}
          map[r.skillId][r.term] = {
            level:         r.level,
            date:          r.dateOfPresentation,
            practiceCount: r.practiceCount,
          }
        })
        setProgressMap(map)
        setNarratives({})
        setGenerated(false)
      } catch (e) { setError('Failed to load student data.') }
    }
    load()
  }, [selected?.id])

  const filteredStudents = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleGenerate = async () => {
    if (!selected || curriculum.length === 0) return
    setGenerating(true); setGenerated(false); setNarratives({}); setGenProgress(0)
    setError('')
    const total = curriculum.length

    for (let i = 0; i < curriculum.length; i++) {
      const area = curriculum[i]
      try {
        // Collect all skills for this area
        const allSkills = area.subAreas.flatMap(sub => sub.skills)
        // Find teacher note for this area (any term — pick most recent)
        const areaNote = notes
          .filter(n => n.areaId === area.id)
          .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))[0]?.note || ''

        const narrative = await generateNarrativeWithGemini(
          area.name, allSkills, progressMap, areaNote, selected.name
        )
        setNarratives(prev => ({ ...prev, [area.id]: narrative }))
      } catch (e) {
        // Fallback narrative if Gemini fails
        setNarratives(prev => ({
          ...prev,
          [area.id]: `${selected.name} has been working on ${area.name} activities this year and continues to make progress across the skills in this area.`
        }))
      }
      setGenProgress(Math.round(((i + 1) / total) * 100))
    }

    setGenerating(false)
    setGenerated(true)
  }

  const handleDownloadHTML = () => {
    if (!selected) return
    exportReportCardHTML(
      { ...selected, className: profile?.classId || '' },
      curriculum,
      progressMap,
      narratives,
      null // attendance — future feature
    )
  }

  const handleDownloadExcel = () => {
    if (!selected) return
    exportReportCardExcel(selected, curriculum, progressMap)
  }

  // ── Report Card Preview ───────────────────────────────────────────────────
  const renderPreview = () => {
    if (!selected) return (
      <EmptyState icon="📄" message={role === 'admin'
        ? 'Select a class or individual student to preview their report card'
        : 'Select a student to preview their report card'} />
    )

    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, lineHeight: 1.6 }}>
        {/* Report header */}
        <div style={{ textAlign: 'center', marginBottom: 18, paddingBottom: 14, borderBottom: '2px solid #EDF2F7' }}>
          <div style={{ fontSize: 20, fontFamily: 'Playfair Display', fontWeight: 700, color: '#2D3748' }}>🪷 Kamala Niketan</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEAL, marginTop: 3 }}>Year End Progress Report 2025–2026</div>
        </div>

        {/* Student meta */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 16, fontSize: 12 }}>
          <div><b>Name of the child:</b> {selected.name}</div>
          <div><b>Grade:</b> {selected.grade}</div>
          <div><b>Class:</b> {selected.classId}</div>
          <div><b>Principal:</b> Mrs. Mala Sivakumar</div>
        </div>

        {/* Attendance placeholder */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#2D3748', marginBottom: 6 }}>Number of days attended</div>
          <div className="rc-table-wrap">
            <table>
              <thead><tr>
                <th>Term 1</th><th>Term 2</th><th>Term 3</th><th>Total</th>
              </tr></thead>
              <tbody><tr>
                <td style={{ textAlign: 'center' }}>— / —</td>
                <td style={{ textAlign: 'center' }}>— / —</td>
                <td style={{ textAlign: 'center' }}>— / —</td>
                <td style={{ textAlign: 'center' }}>— / —</td>
              </tr></tbody>
            </table>
          </div>
        </div>

        {/* Areas */}
        {curriculum.map(area => {
          // Collect all skills across sub-areas
          const allSkills = area.subAreas.flatMap(sub =>
            sub.skills.map(sk => ({ ...sk, subAreaName: sub.name }))
          )
          // Determine which terms have any data for this area
          const termsWithData = ['T1', 'T2', 'T3'].filter(t =>
            allSkills.some(sk => progressMap[sk.id]?.[t]?.level)
          )

          return (
            <div key={area.id} style={{ marginBottom: 20 }}>
              <div className="rc-section-header">{area.name}</div>
              <div className="rc-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '55%' }}>Skill / Activity</th>
                      <th style={{ textAlign: 'center', width: '15%' }}>Term 1</th>
                      <th style={{ textAlign: 'center', width: '15%' }}>Term 2</th>
                      <th style={{ textAlign: 'center', width: '15%' }}>Term 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSkills.map(skill => {
                      const p = progressMap[skill.id] || {}
                      const cell = (t) => {
                        // Only show if that term has data for this area
                        if (!termsWithData.includes(t)) {
                          return <span style={{ color: '#CBD5E0' }}>—</span>
                        }
                        const lvl = p[t]?.level
                        return lvl
                          ? <span style={{ fontWeight: 800, color: LEVEL_COLORS[lvl] }}>{lvl}</span>
                          : <span style={{ color: '#CBD5E0' }}>—</span>
                      }
                      return (
                        <tr key={skill.id}>
                          <td style={{ fontSize: 11 }}>{skill.name}</td>
                          <td style={{ textAlign: 'center' }}>{cell('T1')}</td>
                          <td style={{ textAlign: 'center' }}>{cell('T2')}</td>
                          <td style={{ textAlign: 'center' }}>{cell('T3')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* AI narrative */}
                {narratives[area.id] ? (
                  <div style={{
                    fontSize: 11, color: '#4A5568', padding: '10px 12px',
                    background: 'rgba(59,191,178,.04)', lineHeight: 1.7,
                    borderTop: '1px solid #EDF2F7',
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: TEAL, textTransform: 'uppercase', letterSpacing: .8 }}>🤖 AI Narrative · </span>
                    {narratives[area.id]}
                  </div>
                ) : generating ? (
                  <div style={{ padding: '10px 12px', borderTop: '1px solid #EDF2F7' }}>
                    <div className="ai-streaming" style={{ width: '95%' }} />
                    <div className="ai-streaming" style={{ width: '80%' }} />
                    <div className="ai-streaming" style={{ width: '58%' }} />
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: '#CBD5E0', fontStyle: 'italic', padding: '7px 12px', borderTop: '1px solid #EDF2F7' }}>
                    Narrative paragraph will appear after generation
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* After generation — observations, presentation, legend */}
        {generated && (
          <>
            <div style={{ marginBottom: 16 }}>
              <div className="rc-section-header">Observations & Questioning Skills</div>
              <div className="rc-table-wrap" style={{ padding: '10px 12px', fontSize: 11, color: '#4A5568', lineHeight: 1.7 }}>
                {notes.find(n => n.areaName?.toLowerCase().includes('observ'))?.note ||
                  `${selected.name} carefully observes the environment and asks thoughtful questions. They engage with themes introduced in class and demonstrate growing curiosity and critical thinking.`}
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="rc-section-header">Presentation Skills</div>
              <div className="rc-table-wrap" style={{ padding: '10px 12px', fontSize: 11, color: '#4A5568', lineHeight: 1.7 }}>
                {notes.find(n => n.areaName?.toLowerCase().includes('present'))?.note ||
                  `${selected.name} is able to share ideas clearly during group presentations, staying on topic and expressing thoughts with growing confidence.`}
              </div>
            </div>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '2px solid #EDF2F7', fontSize: 11, color: '#718096', lineHeight: 1.8 }}>
              <b>Level of Achievement</b> — <b>P</b> (Proficient) · <b>R</b> (Reaching the milestone) · <b>A</b> (Advancing) · <b>M</b> (Making an Effort) · <b>NA</b> (Not Applicable) · <b>—</b> (Not yet recorded this term)
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        role={role}
        title="Report Card Generator"
        subtitle="AI-powered narrative report cards per student"
      />

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Admin mode tabs */}
      {role === 'admin' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'rgba(255,255,255,.5)', padding: 4, borderRadius: 12, width: 'fit-content' }}>
          <div className={`tab ${mode === 'student' ? 'active' : ''}`} onClick={() => { setMode('student'); setSelClass(''); setSelected(null); setGenerated(false) }}>
            Individual Student
          </div>
          <div className={`tab ${mode === 'class' ? 'active' : ''}`} onClick={() => { setMode('class'); setSelected(null); setGenerated(false) }}>
            By Class (Batch)
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="glass" style={{ borderRadius: 16, padding: 20 }}>

            {/* Class picker — admin batch mode */}
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
                      }}>
                      {c}
                    </div>
                  ))}
                </div>
                {selClass && (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#718096', textAlign: 'center' }}>
                    Generates report cards for all students in {selClass}
                  </div>
                )}
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
                    {filteredStudents.length === 0 && (
                      <div style={{ fontSize: 12, color: '#A0AEC0', textAlign: 'center', padding: 16 }}>No students found.</div>
                    )}
                    {filteredStudents.map(s => (
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

          {/* Generate button + progress + download */}
          {(selected || selClass) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="btn-primary" style={{ width: '100%' }}
                onClick={handleGenerate}
                disabled={generating || (!selected && !selClass)}>
                {generating ? `Generating… ${genProgress}%` : '✨ Generate Report Card'}
              </button>

              {generating && (
                <div style={{ background: '#EDF2F7', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: TEAL, borderRadius: 99, width: `${genProgress}%`, transition: 'width .4s' }} />
                </div>
              )}

              {generated && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-peach" style={{ flex: 1, fontSize: 13 }} onClick={handleDownloadHTML}>
                    📥 Download (.html)
                  </button>
                  <button className="btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={handleDownloadExcel}>
                    📊 .xlsx
                  </button>
                </div>
              )}

              {generated && (
                <div style={{ fontSize: 11, color: '#A0AEC0', textAlign: 'center', lineHeight: 1.5 }}>
                  Open the .html file in any browser → File → Print → Save as PDF
                </div>
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
