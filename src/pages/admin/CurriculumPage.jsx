// src/pages/admin/CurriculumPage.jsx — Supabase version
import { useState, useEffect } from 'react'
import { PageHeader, Spinner, ConfirmDialog } from '../../components/UI'
import { GRADES, TEAL } from '../../utils/theme'
import {
  getSubjectsByGrade, addSubject, updateSubjectName, deleteSubjectCascade,
  getCategoriesBySubject, addCategory, updateCategoryName, deleteCategoryCascade,
  getSkillsByCategory, addSkill, updateSkillName, deleteSkillCascade,
  getActivitiesBySkill, addActivity, updateActivityName, deleteActivityById,
  bulkImportCurriculum,
} from '../../supabase/services'
import { parseCurriculumExcel } from '../../utils/exportUtils'

function AddRow({ placeholder, onAdd, onCancel, saving }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 4 }}>
      <input className="form-input" style={{ flex: 1, fontSize: 13 }}
        placeholder={placeholder} value={val} autoFocus
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) onAdd(val.trim()); if (e.key === 'Escape') onCancel() }} />
      <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}
        onClick={() => onAdd(val.trim())} disabled={saving || !val.trim()}>{saving ? '…' : 'Add'}</button>
      <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={onCancel}>Cancel</button>
    </div>
  )
}

function EditRow({ initialValue, onSave, onCancel, saving }) {
  const [val, setVal] = useState(initialValue)
  return (
    <div style={{ display: 'flex', gap: 8, flex: 1 }}>
      <input className="form-input" style={{ flex: 1, fontSize: 13 }}
        value={val} autoFocus
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) onSave(val.trim()); if (e.key === 'Escape') onCancel() }} />
      <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}
        onClick={() => onSave(val.trim())} disabled={saving || !val.trim()}>{saving ? '…' : 'Save'}</button>
      <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={onCancel}>Cancel</button>
    </div>
  )
}

export default function CurriculumPage() {
  const [grade,    setGrade]    = useState('PreKG')
  const [subjects, setSubjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [confirm,  setConfirm]  = useState(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  const [openSub,   setOpenSub]   = useState(null)
  const [openCat,   setOpenCat]   = useState(null)
  const [openSkill, setOpenSkill] = useState(null)

  const [editing, setEditing] = useState(null)
  const [adding,  setAdding]  = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const subs = await getSubjectsByGrade(grade)
      const tree = await Promise.all(subs.map(async sub => {
        const cats = await getCategoriesBySubject(sub.id)
        const catsTree = await Promise.all(cats.map(async cat => {
          const skills = await getSkillsByCategory(cat.id)
          const skillsTree = await Promise.all(skills.map(async skill => {
            const activities = await getActivitiesBySkill(skill.id)
            return { ...skill, activities }
          }))
          return { ...cat, skills: skillsTree }
        }))
        return { ...sub, categories: catsTree }
      }))
      setSubjects(tree)
    } catch (e) { setError('Failed to load: ' + e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    setOpenSub(null); setOpenCat(null); setOpenSkill(null)
    setEditing(null); setAdding(null)
    load()
  }, [grade])

  const flash = msg => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  const doSave = async (fn, msg) => {
    setSaving(true); setError('')
    try { await fn(); setEditing(null); setAdding(null); await load(); flash(msg) }
    catch (e) { setError('Failed: ' + e.message) }
    finally { setSaving(false) }
  }

  const doConfirm = (msg, fn) => setConfirm({ msg, onConfirm: async () => {
    setSaving(true)
    try { await fn(); setConfirm(null); await load(); flash('Deleted.') }
    catch (e) { setError('Failed: ' + e.message) }
    finally { setSaving(false) }
  }})

  const ICON  = ['📚','📂','🎯','▸']
  const COLOR = ['#2D3748','#2a7a74','#c0623c','#718096']
  const LABEL = ['Subject','Category','Skill','Activity']

  const Row = ({ name, depth, editKey, childCount, isOpen, onToggle,
    onEdit, onDelete, addType, addParentKey, addPlaceholder, addFn, children }) => {
    const isEditingThis = editing?.key === editKey
    const isAddingHere  = adding?.type === addType && adding?.parentKey === addParentKey
    return (
      <div style={{ background: depth % 2 === 0 ? 'transparent' : 'rgba(59,191,178,.02)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: `9px ${16 + depth * 20}px`,
          borderBottom: '1px solid #F7FAFC', minHeight: 44,
        }}>
          <span style={{ fontSize: depth === 3 ? 11 : 13, color: '#A0AEC0', flexShrink: 0 }}>{ICON[depth]}</span>
          {isEditingThis ? (
            <EditRow initialValue={name} saving={saving}
              onSave={val => doSave(() => onEdit(val), `${LABEL[depth]} updated.`)}
              onCancel={() => setEditing(null)} />
          ) : (
            <>
              <span style={{ flex: 1, fontSize: depth === 0 ? 15 : 13, fontWeight: depth < 2 ? 600 : 400,
                color: COLOR[depth], cursor: onToggle ? 'pointer' : 'default' }}
                onClick={onToggle}>
                {name}
                {childCount !== undefined && <span style={{ fontSize: 11, color: '#A0AEC0', marginLeft: 6 }}>({childCount})</span>}
              </span>
              {onToggle && <span style={{ color: '#A0AEC0', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={onToggle}>{isOpen ? '▴' : '▾'}</span>}
              <button className="btn-ghost"  style={{ padding: '3px 10px', fontSize: 11, flexShrink: 0 }}
                onClick={() => { setEditing({ key: editKey }); setAdding(null) }}>Edit</button>
              <button className="btn-danger" style={{ padding: '3px 8px', fontSize: 11, flexShrink: 0 }}
                onClick={onDelete}>Delete</button>
            </>
          )}
        </div>
        {isOpen && (
          <div>
            {children}
            {addType && (
              <div style={{ paddingLeft: (depth + 1) * 20 + 16, paddingRight: 16, paddingBottom: isAddingHere ? 12 : 6 }}>
                {isAddingHere ? (
                  <AddRow placeholder={addPlaceholder} saving={saving}
                    onAdd={val => doSave(() => addFn(val), `${addType.charAt(0).toUpperCase() + addType.slice(1)} added.`)}
                    onCancel={() => setAdding(null)} />
                ) : (
                  <button className="btn-ghost" style={{ marginTop: 4, fontSize: 11, padding: '4px 14px' }}
                    onClick={() => { setAdding({ type: addType, parentKey: addParentKey }); setEditing(null) }}>
                    + Add {addType.charAt(0).toUpperCase() + addType.slice(1)}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader role="admin" title="Curriculum" subtitle="Subject → Category → Skill → Activity"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files[0]
                  if (!file) return
                  setImporting(true); setImportMsg(''); setError('')
                  try {
                    const rows = await parseCurriculumExcel(file)
                    const result = await bulkImportCurriculum(rows)
                    await load()
                    setImportMsg(`Imported: ${result.created.subjects} subjects, ${result.created.categories} categories, ${result.created.skills} skills, ${result.created.activities} activities. (${result.skipped} skipped/duplicate)`)
                    setTimeout(() => setImportMsg(''), 8000)
                  } catch (err) {
                    setError('Import failed: ' + err.message)
                  } finally {
                    setImporting(false)
                    e.target.value = ''
                  }
                }} />
              <span className="btn-ghost">{importing ? 'Importing…' : '📥 Import Excel'}</span>
            </label>
            <button className="btn-primary" onClick={() => { setAdding({ type: 'subject', parentKey: grade }); setEditing(null) }}>
              + Add Subject
            </button>
          </div>
        }
      />

      <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 16 }}>
        📋 Excel import format: columns <b>Subject</b>, <b>Category</b>, <b>Skill</b>, <b>Activity</b>, <b>Grade</b> (PreKG/LKG/UKG). One row per activity — existing subjects/categories/skills are reused automatically.
      </div>

      {importMsg && <div className="success-box" style={{ marginBottom: 14 }}>✅ {importMsg}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'rgba(255,255,255,.5)', padding: 4, borderRadius: 12, width: 'fit-content' }}>
        {GRADES.map(g => <div key={g} className={`tab ${grade === g ? 'active' : ''}`} onClick={() => setGrade(g)}>{g}</div>)}
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {['📚 Subject','📂 Category','🎯 Skill','▸ Activity'].map(l => (
          <span key={l} style={{ fontSize: 12, color: '#718096', background: 'rgba(255,255,255,.6)', padding: '3px 10px', borderRadius: 8 }}>{l}</span>
        ))}
      </div>

      {error   && <div className="error-box"   style={{ marginBottom: 14 }}>{error}</div>}
      {success && <div className="success-box" style={{ marginBottom: 14 }}>✅ {success}</div>}

      {adding?.type === 'subject' && (
        <div className="glass" style={{ borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <AddRow placeholder="e.g. Practical Life" saving={saving}
            onAdd={val => doSave(() => addSubject(grade, val, subjects.length), 'Subject added.')}
            onCancel={() => setAdding(null)} />
        </div>
      )}

      {loading ? <Spinner center /> : subjects.length === 0 ? (
        <div className="glass" style={{ borderRadius: 14, padding: 40, textAlign: 'center', color: '#A0AEC0' }}>
          No curriculum for {grade} yet. Click <b>+ Add Subject</b> to begin.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {subjects.map(sub => (
            <div key={sub.id} className="glass" style={{ borderRadius: 14, overflow: 'hidden' }}>
              <Row name={sub.name} depth={0} editKey={`sub-${sub.id}`}
                childCount={sub.categories.length}
                isOpen={openSub === sub.id}
                onToggle={() => { setOpenSub(openSub === sub.id ? null : sub.id); setOpenCat(null); setOpenSkill(null) }}
                onEdit={val => () => updateSubjectName(sub.id, val)}
                onDelete={() => doConfirm(`Delete subject "${sub.name}" and ALL its content?`, () => deleteSubjectCascade(sub.id))}
                addType="category" addParentKey={sub.id}
                addPlaceholder="e.g. Elementary Movement"
                addFn={val => addCategory(sub.id, val, sub.categories.length)}>
                {sub.categories.map(cat => (
                  <Row key={cat.id} name={cat.name} depth={1} editKey={`cat-${cat.id}`}
                    childCount={cat.skills.length}
                    isOpen={openCat === cat.id}
                    onToggle={() => { setOpenCat(openCat === cat.id ? null : cat.id); setOpenSkill(null) }}
                    onEdit={val => () => updateCategoryName(cat.id, val)}
                    onDelete={() => doConfirm(`Delete category "${cat.name}" and all its skills?`, () => deleteCategoryCascade(cat.id))}
                    addType="skill" addParentKey={cat.id}
                    addPlaceholder="e.g. Fine motor development"
                    addFn={val => addSkill(cat.id, val, cat.skills.length)}>
                    {cat.skills.map(skill => (
                      <Row key={skill.id} name={skill.name} depth={2} editKey={`skill-${skill.id}`}
                        childCount={skill.activities.length}
                        isOpen={openSkill === skill.id}
                        onToggle={() => setOpenSkill(openSkill === skill.id ? null : skill.id)}
                        onEdit={val => () => updateSkillName(skill.id, val)}
                        onDelete={() => doConfirm(`Delete skill "${skill.name}" and all activities?`, () => deleteSkillCascade(skill.id))}
                        addType="activity" addParentKey={skill.id}
                        addPlaceholder="e.g. Walking on the line"
                        addFn={val => addActivity(skill.id, val, skill.activities.length)}>
                        {skill.activities.map(act => (
                          <Row key={act.id} name={act.name} depth={3} editKey={`act-${act.id}`}
                            isOpen={false} onToggle={null} childCount={undefined}
                            onEdit={val => () => updateActivityName(act.id, val)}
                            onDelete={() => doConfirm(`Delete activity "${act.name}"?`, () => deleteActivityById(act.id))}>
                          </Row>
                        ))}
                      </Row>
                    ))}
                  </Row>
                ))}
              </Row>
            </div>
          ))}
        </div>
      )}
      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  )
}