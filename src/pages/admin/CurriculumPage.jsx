import { useState, useEffect } from 'react'
import { getCurriculumByGrade, addArea, updateArea, deleteArea, addSubArea, updateSubArea, deleteSubArea, addSkill, updateSkill, deleteSkill } from '../../firebase/services'
import { PageHeader, Spinner, ConfirmDialog } from '../../components/UI'
import { GRADES, TEAL } from '../../utils/theme'

export default function CurriculumPage() {
  const [grade,    setGrade]    = useState('PreKG')
  const [areas,    setAreas]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [editing,  setEditing]  = useState(null)   // { type, id, parentId, value }
  const [adding,   setAdding]   = useState(null)   // { type, parentId, value }
  const [confirm,  setConfirm]  = useState(null)
  const [error,    setError]    = useState('')

  const load = async () => {
    setLoading(true)
    try { setAreas(await getCurriculumByGrade(grade)) }
    catch (e) { setError('Failed to load curriculum.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [grade])

  const handleAddArea = async () => {
    if (!adding?.value?.trim()) return
    await addArea(grade, adding.value.trim())
    setAdding(null); load()
  }

  const handleUpdateArea = async (areaId) => {
    if (!editing?.value?.trim()) return
    await updateArea(areaId, { name: editing.value.trim() })
    setEditing(null); load()
  }

  const handleDeleteArea = async (areaId) => {
    await deleteArea(areaId)
    setConfirm(null); load()
  }

  const handleAddSubArea = async (areaId) => {
    if (!adding?.value?.trim()) return
    await addSubArea(areaId, adding.value.trim())
    setAdding(null); load()
  }

  const handleAddSkill = async (areaId, subAreaId) => {
    if (!adding?.value?.trim()) return
    await addSkill(areaId, subAreaId, adding.value.trim())
    setAdding(null); load()
  }

  const handleUpdateSkill = async (areaId, subAreaId, skillId) => {
    if (!editing?.value?.trim()) return
    await updateSkill(areaId, subAreaId, skillId, { name: editing.value.trim() })
    setEditing(null); load()
  }

  return (
    <div>
      <PageHeader
        role="admin"
        title="Curriculum"
        subtitle="Manage areas, sub-areas and skills per grade"
        action={
          <button className="btn-primary" onClick={() => setAdding({ type: 'area', value: '' })}>
            + Add Area
          </button>
        }
      />

      {/* Grade tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'rgba(255,255,255,.5)', padding: 4, borderRadius: 12, width: 'fit-content' }}>
        {GRADES.map(g => (
          <div key={g} className={`tab ${grade === g ? 'active' : ''}`} onClick={() => { setGrade(g); setExpanded(null) }}>{g}</div>
        ))}
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Add area input */}
      {adding?.type === 'area' && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input className="form-input" placeholder="New area name..." value={adding.value}
            onChange={e => setAdding({ ...adding, value: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleAddArea()} autoFocus />
          <button className="btn-primary" onClick={handleAddArea}>Add</button>
          <button className="btn-ghost" onClick={() => setAdding(null)}>Cancel</button>
        </div>
      )}

      {loading ? <Spinner center /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {areas.length === 0 && (
            <div className="glass" style={{ borderRadius: 14, padding: 32, textAlign: 'center', color: '#A0AEC0' }}>
              No curriculum set up yet for {grade}. Click "Add Area" to begin.
            </div>
          )}
          {areas.map((area, i) => (
            <div key={area.id} className="glass" style={{ borderRadius: 14 }}>
              {/* Area header */}
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {editing?.type === 'area' && editing?.id === area.id ? (
                  <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                    <input className="form-input" value={editing.value}
                      onChange={e => setEditing({ ...editing, value: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && handleUpdateArea(area.id)} autoFocus />
                    <button className="btn-primary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => handleUpdateArea(area.id)}>Save</button>
                    <button className="btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ fontWeight: 600, color: '#2D3748', fontSize: 15, cursor: 'pointer', flex: 1 }}
                    onClick={() => setExpanded(expanded === area.id ? null : area.id)}>
                    {area.name}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: '#A0AEC0' }}>{area.subAreas.length} sub-areas</span>
                  {editing?.id !== area.id && (
                    <>
                      <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => setEditing({ type: 'area', id: area.id, value: area.name })}>Edit</button>
                      <button className="btn-danger"
                        onClick={() => setConfirm({ msg: `Delete area "${area.name}" and all its content?`, onConfirm: () => handleDeleteArea(area.id) })}>
                        Delete
                      </button>
                    </>
                  )}
                  <span style={{ color: TEAL, fontSize: 18, cursor: 'pointer' }}
                    onClick={() => setExpanded(expanded === area.id ? null : area.id)}>
                    {expanded === area.id ? '▴' : '▾'}
                  </span>
                </div>
              </div>

              {/* Sub-areas */}
              {expanded === area.id && (
                <div style={{ padding: '0 20px 16px', borderTop: '1px solid rgba(0,0,0,.05)' }}>
                  {area.subAreas.map((sub) => (
                    <div key={sub.id} style={{ paddingTop: 12, borderTop: '1px solid #F7FAFC', marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        {editing?.type === 'subArea' && editing?.id === sub.id ? (
                          <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                            <input className="form-input" style={{ fontSize: 13 }} value={editing.value}
                              onChange={e => setEditing({ ...editing, value: e.target.value })} autoFocus
                              onKeyDown={async e => { if (e.key === 'Enter') { await updateSubArea(area.id, sub.id, { name: editing.value }); setEditing(null); load() } }} />
                            <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={async () => { await updateSubArea(area.id, sub.id, { name: editing.value }); setEditing(null); load() }}>Save</button>
                            <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setEditing(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#4A5568' }}>↳ {sub.name}</div>
                        )}
                        {editing?.id !== sub.id && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn-ghost" style={{ padding: '3px 10px', fontSize: 12 }}
                              onClick={() => setEditing({ type: 'subArea', id: sub.id, value: sub.name })}>Edit</button>
                            <button className="btn-danger" style={{ padding: '3px 10px', fontSize: 12 }}
                              onClick={() => setConfirm({ msg: `Delete sub-area "${sub.name}"?`, onConfirm: async () => { await deleteSubArea(area.id, sub.id); setConfirm(null); load() } })}>Delete</button>
                          </div>
                        )}
                      </div>

                      {/* Skills */}
                      {sub.skills.map(skill => (
                        <div key={skill.id} style={{ display: 'flex', alignItems: 'center', padding: '4px 0 4px 12px', borderLeft: `2px solid ${TEAL}33`, gap: 8 }}>
                          {editing?.type === 'skill' && editing?.id === skill.id ? (
                            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                              <input className="form-input" style={{ fontSize: 12 }} value={editing.value}
                                onChange={e => setEditing({ ...editing, value: e.target.value })} autoFocus
                                onKeyDown={e => e.key === 'Enter' && handleUpdateSkill(area.id, sub.id, skill.id)} />
                              <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleUpdateSkill(area.id, sub.id, skill.id)}>Save</button>
                              <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditing(null)}>Cancel</button>
                            </div>
                          ) : (
                            <>
                              <span style={{ fontSize: 12, color: '#718096', flex: 1 }}>• {skill.name}</span>
                              <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}
                                onClick={() => setEditing({ type: 'skill', id: skill.id, value: skill.name })}>Edit</button>
                              <button className="btn-danger" style={{ padding: '2px 8px', fontSize: 11 }}
                                onClick={() => setConfirm({ msg: `Delete skill "${skill.name}"?`, onConfirm: async () => { await deleteSkill(area.id, sub.id, skill.id); setConfirm(null); load() } })}>Del</button>
                            </>
                          )}
                        </div>
                      ))}

                      {/* Add skill */}
                      {adding?.type === 'skill' && adding?.parentId === sub.id ? (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, paddingLeft: 12 }}>
                          <input className="form-input" style={{ fontSize: 12 }} placeholder="New skill..." value={adding.value}
                            onChange={e => setAdding({ ...adding, value: e.target.value })} autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleAddSkill(area.id, sub.id)} />
                          <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleAddSkill(area.id, sub.id)}>Add</button>
                          <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setAdding(null)}>✕</button>
                        </div>
                      ) : (
                        <button className="btn-ghost" style={{ marginTop: 6, marginLeft: 12, fontSize: 11, padding: '4px 12px' }}
                          onClick={() => setAdding({ type: 'skill', parentId: sub.id, value: '' })}>
                          + Add Skill
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Add sub-area */}
                  {adding?.type === 'subArea' && adding?.parentId === area.id ? (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <input className="form-input" style={{ fontSize: 13 }} placeholder="New sub-area..." value={adding.value}
                        onChange={e => setAdding({ ...adding, value: e.target.value })} autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleAddSubArea(area.id)} />
                      <button className="btn-primary" onClick={() => handleAddSubArea(area.id)}>Add</button>
                      <button className="btn-ghost" onClick={() => setAdding(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn-ghost" style={{ marginTop: 12, fontSize: 12 }}
                      onClick={() => setAdding({ type: 'subArea', parentId: area.id, value: '' })}>
                      + Add Sub-area
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          message={confirm.msg}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
