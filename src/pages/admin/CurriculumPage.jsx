import { useState, useEffect } from 'react'
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { PageHeader, Spinner, ConfirmDialog } from '../../components/UI'
import { GRADES, TEAL } from '../../utils/theme'

// ─── Firestore helpers — 4 layers: subjects → categories → skills → activities

const getSubjects = async (grade) => {
  const q = query(collection(db, 'subjects'), where('grade', '==', grade))
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

const addSubject  = (grade, name, order) => addDoc(collection(db, 'subjects'), { grade, name, order, createdAt: serverTimestamp() })
const addCategory = (sId, name, order) => addDoc(collection(db, 'subjects', sId, 'categories'), { name, order, createdAt: serverTimestamp() })
const addSkill    = (sId, cId, name, order) => addDoc(collection(db, 'subjects', sId, 'categories', cId, 'skills'), { name, order, createdAt: serverTimestamp() })
const addActivity = (sId, cId, skId, name, order) => addDoc(collection(db, 'subjects', sId, 'categories', cId, 'skills', skId, 'activities'), { name, order, createdAt: serverTimestamp() })

const updateSubject  = (sId, name) => updateDoc(doc(db, 'subjects', sId), { name })
const updateCategory = (sId, cId, name) => updateDoc(doc(db, 'subjects', sId, 'categories', cId), { name })
const updateSkill    = (sId, cId, skId, name) => updateDoc(doc(db, 'subjects', sId, 'categories', cId, 'skills', skId), { name })
const updateActivity = (sId, cId, skId, aId, name) => updateDoc(doc(db, 'subjects', sId, 'categories', cId, 'skills', skId, 'activities', aId), { name })

const deleteActivity = (sId, cId, skId, aId) => deleteDoc(doc(db, 'subjects', sId, 'categories', cId, 'skills', skId, 'activities', aId))
const deleteSkill = async (sId, cId, skId) => {
  const acts = await getActivities(sId, cId, skId)
  for (const a of acts) await deleteActivity(sId, cId, skId, a.id)
  await deleteDoc(doc(db, 'subjects', sId, 'categories', cId, 'skills', skId))
}
const deleteCategory = async (sId, cId) => {
  const skills = await getSkills(sId, cId)
  for (const s of skills) await deleteSkill(sId, cId, s.id)
  await deleteDoc(doc(db, 'subjects', sId, 'categories', cId))
}
const deleteSubject = async (sId) => {
  const cats = await getCategories(sId)
  for (const c of cats) await deleteCategory(sId, c.id)
  await deleteDoc(doc(db, 'subjects', sId))
}

// ─── Inline add/edit components ───────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function CurriculumPage() {
  const [grade,    setGrade]    = useState('PreKG')
  const [subjects, setSubjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [confirm,  setConfirm]  = useState(null)

  // open = which node is expanded
  const [openSub,  setOpenSub]  = useState(null)
  const [openCat,  setOpenCat]  = useState(null)
  const [openSkill,setOpenSkill]= useState(null)

  // editing = { type, key } where key uniquely identifies the node
  const [editing, setEditing] = useState(null)
  // adding = { type, parentKey }
  const [adding,  setAdding]  = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const subList = await getSubjects(grade)
      const tree = await Promise.all(subList.map(async sub => {
        const cats = await getCategories(sub.id)
        const catsTree = await Promise.all(cats.map(async cat => {
          const skills = await getSkills(sub.id, cat.id)
          const skillsTree = await Promise.all(skills.map(async skill => {
            const activities = await getActivities(sub.id, cat.id, skill.id)
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

  const BG_DEPTH  = ['rgba(255,255,255,0)', 'rgba(59,191,178,.03)', 'rgba(232,135,106,.03)', 'rgba(100,100,180,.02)']
  const COLOR_DEPTH = ['#2D3748', '#2a7a74', '#c0623c', '#718096']
  const ICON_DEPTH  = ['📚', '📂', '🎯', '▸']
  const LABEL_DEPTH = ['Subject', 'Category', 'Skill', 'Activity']

  const Row = ({ name, depth, editKey, childCount, isOpen, onToggle,
    onEdit, onDelete, addType, addParentKey, addPlaceholder,
    addFn, children }) => {

    const isEditingThis = editing?.key === editKey
    const isAddingHere  = adding?.type === addType && adding?.parentKey === addParentKey

    return (
      <div style={{ background: BG_DEPTH[depth] }}>
        {/* The row itself */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: `9px ${16 + depth * 20}px 9px ${16 + depth * 20}px`,
          borderBottom: '1px solid #F7FAFC',
          minHeight: 42,
        }}>
          <span style={{ fontSize: depth === 3 ? 11 : 13, color: '#A0AEC0', flexShrink: 0 }}>{ICON_DEPTH[depth]}</span>

          {isEditingThis ? (
            <EditRow
              initialValue={name} saving={saving}
              onSave={(val) => doSave(onEdit(val), `${LABEL_DEPTH[depth]} updated.`)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <>
              <span
                style={{ flex: 1, fontSize: depth === 0 ? 15 : depth === 1 ? 14 : 13, fontWeight: depth < 2 ? 600 : 400, color: COLOR_DEPTH[depth], cursor: onToggle ? 'pointer' : 'default' }}
                onClick={onToggle}>
                {name}
                {childCount !== undefined && <span style={{ fontSize: 11, color: '#A0AEC0', marginLeft: 6 }}>({childCount})</span>}
              </span>
              {onToggle && <span style={{ color: '#A0AEC0', fontSize: 14, cursor: 'pointer', flexShrink: 0 }} onClick={onToggle}>{isOpen ? '▴' : '▾'}</span>}
              <button className="btn-ghost"  style={{ padding: '3px 10px', fontSize: 11, flexShrink: 0 }} onClick={() => { setEditing({ key: editKey }); setAdding(null) }}>Edit</button>
              <button className="btn-danger" style={{ padding: '3px 8px',  fontSize: 11, flexShrink: 0 }} onClick={onDelete}>Delete</button>
            </>
          )}
        </div>

        {/* Children + add row */}
        {isOpen && (
          <div>
            {children}
            {addType && (
              <div style={{ paddingLeft: (depth + 1) * 20 + 16, paddingRight: 16, paddingBottom: isAddingHere ? 12 : 6 }}>
                {isAddingHere ? (
                  <AddRow placeholder={addPlaceholder} saving={saving}
                    onAdd={(val) => doSave(() => addFn(val), `${addType.charAt(0).toUpperCase() + addType.slice(1)} added.`)}
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
      <PageHeader
        role="admin"
        title="Curriculum"
        subtitle="Subject → Category → Skill → Activity (4 layers)"
        action={
          <button className="btn-primary"
            onClick={() => { setAdding({ type: 'subject', parentKey: grade }); setEditing(null) }}>
            + Add Subject
          </button>
        }
      />

      {/* Grade tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'rgba(255,255,255,.5)', padding: 4, borderRadius: 12, width: 'fit-content' }}>
        {GRADES.map(g => <div key={g} className={`tab ${grade === g ? 'active' : ''}`} onClick={() => setGrade(g)}>{g}</div>)}
      </div>

      {/* Layer legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {['📚 Subject', '📂 Category', '🎯 Skill', '▸ Activity'].map(l => (
          <span key={l} style={{ fontSize: 12, color: '#718096', background: 'rgba(255,255,255,.6)', padding: '3px 10px', borderRadius: 8 }}>{l}</span>
        ))}
      </div>

      {error   && <div className="error-box"   style={{ marginBottom: 14 }}>{error}</div>}
      {success && <div className="success-box" style={{ marginBottom: 14 }}>✅ {success}</div>}

      {/* Add subject */}
      {adding?.type === 'subject' && (
        <div className="glass" style={{ borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <AddRow placeholder="e.g. Practical Life" saving={saving}
            onAdd={(val) => doSave(() => addSubject(grade, val, subjects.length), 'Subject added.')}
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
              <Row
                name={sub.name} depth={0}
                editKey={`sub-${sub.id}`}
                childCount={sub.categories.length}
                isOpen={openSub === sub.id}
                onToggle={() => { setOpenSub(openSub === sub.id ? null : sub.id); setOpenCat(null); setOpenSkill(null) }}
                onEdit={(val) => () => updateSubject(sub.id, val)}
                onDelete={() => doConfirm(`Delete subject "${sub.name}" and ALL its content?`, () => deleteSubject(sub.id))}
                addType="category"
                addParentKey={sub.id}
                addPlaceholder="e.g. Elementary Movement"
                addFn={(val) => addCategory(sub.id, val, sub.categories.length)}>

                {sub.categories.map(cat => (
                  <Row key={cat.id}
                    name={cat.name} depth={1}
                    editKey={`cat-${cat.id}`}
                    childCount={cat.skills.length}
                    isOpen={openCat === cat.id}
                    onToggle={() => { setOpenCat(openCat === cat.id ? null : cat.id); setOpenSkill(null) }}
                    onEdit={(val) => () => updateCategory(sub.id, cat.id, val)}
                    onDelete={() => doConfirm(`Delete category "${cat.name}" and all its skills?`, () => deleteCategory(sub.id, cat.id))}
                    addType="skill"
                    addParentKey={cat.id}
                    addPlaceholder="e.g. Fine motor development"
                    addFn={(val) => addSkill(sub.id, cat.id, val, cat.skills.length)}>

                    {cat.skills.map(skill => (
                      <Row key={skill.id}
                        name={skill.name} depth={2}
                        editKey={`skill-${skill.id}`}
                        childCount={skill.activities.length}
                        isOpen={openSkill === skill.id}
                        onToggle={() => setOpenSkill(openSkill === skill.id ? null : skill.id)}
                        onEdit={(val) => () => updateSkill(sub.id, cat.id, skill.id, val)}
                        onDelete={() => doConfirm(`Delete skill "${skill.name}" and all its activities?`, () => deleteSkill(sub.id, cat.id, skill.id))}
                        addType="activity"
                        addParentKey={skill.id}
                        addPlaceholder="e.g. Walking on the line"
                        addFn={(val) => addActivity(sub.id, cat.id, skill.id, val, skill.activities.length)}>

                        {skill.activities.map(act => (
                          <Row key={act.id}
                            name={act.name} depth={3}
                            editKey={`act-${act.id}`}
                            isOpen={false} onToggle={null}
                            childCount={undefined}
                            onEdit={(val) => () => updateActivity(sub.id, cat.id, skill.id, act.id, val)}
                            onDelete={() => doConfirm(`Delete activity "${act.name}"?`, () => deleteActivity(sub.id, cat.id, skill.id, act.id))}>
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
