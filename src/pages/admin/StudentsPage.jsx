import { useState, useEffect } from 'react'
import { getAllStudents, addStudent, updateStudent, deleteStudent, bulkAddStudents } from '../../supabase/services'
import { PageHeader, Spinner, ConfirmDialog, SearchInput, GradeBadge, EmptyState } from '../../components/UI'
import { parseStudentExcel } from '../../utils/exportUtils'
import { CLASSES, GRADES, TEAL } from '../../utils/theme'

const BLANK = { name: '', dob: '', grade: 'PreKG', classId: 'PP1' }

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState({ grade: '', classId: '' })
  const [modal,    setModal]    = useState(null)   // 'add' | 'edit'
  const [form,     setForm]     = useState(BLANK)
  const [confirm,  setConfirm]  = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [importing,setImporting]= useState(false)

  const load = async () => {
    setLoading(true)
    try { setStudents(await getAllStudents()) }
    catch { setError('Failed to load students.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase())
    const matchGrade  = !filter.grade   || s.grade   === filter.grade
    const matchClass  = !filter.classId || s.classId === filter.classId
    return matchSearch && matchGrade && matchClass
  })

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Student name is required.'); return }
    setSaving(true); setError('')
    try {
      if (modal === 'edit') {
        await updateStudent(form.id, { name: form.name.trim(), dob: form.dob, grade: form.grade, classId: form.classId })
      } else {
        await addStudent({ name: form.name.trim(), dob: form.dob, grade: form.grade, classId: form.classId })
      }
      setModal(null); setForm(BLANK); load()
      setSuccess(modal === 'edit' ? 'Student updated.' : 'Student added.')
      setTimeout(() => setSuccess(''), 3000)
    } catch { setError('Failed to save student.') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    await deleteStudent(id)
    setConfirm(null); load()
  }

  const handleExcelImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true); setError('')
    try {
      const rows = await parseStudentExcel(file)
      if (rows.length === 0) { setError('No valid rows found in Excel file.'); return }
      await bulkAddStudents(rows)
      load()
      setSuccess(`${rows.length} students imported successfully.`)
      setTimeout(() => setSuccess(''), 4000)
    } catch { setError('Failed to import Excel file. Check the format.') }
    finally { setImporting(false); e.target.value = '' }
  }

  return (
    <div>
      <PageHeader
        role="admin"
        title="Students"
        subtitle={`${students.length} total students`}
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelImport} />
              <span className="btn-ghost">{importing ? 'Importing…' : '📥 Import Excel'}</span>
            </label>
            <button className="btn-primary" onClick={() => { setForm(BLANK); setModal('add') }}>
              + Add Student
            </button>
          </div>
        }
      />

      {error   && <div className="error-box"   style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="success-box" style={{ marginBottom: 16 }}>{success}</div>}

      {/* Filters */}
      <div className="glass" style={{ borderRadius: 14, padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name..." />
        </div>
        <div>
          <label className="form-label">Grade</label>
          <select className="form-select" style={{ width: 'auto' }} value={filter.grade}
            onChange={e => setFilter(f => ({ ...f, grade: e.target.value }))}>
            <option value="">All Grades</option>
            {GRADES.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Class</label>
          <select className="form-select" style={{ width: 'auto' }} value={filter.classId}
            onChange={e => setFilter(f => ({ ...f, classId: e.target.value }))}>
            <option value="">All Classes</option>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Excel format hint */}
      <div style={{ fontSize: 12, color: '#A0AEC0', marginBottom: 16 }}>
        📋 Excel import format: columns <b>Name</b>, <b>DOB</b>, <b>Grade</b> (PreKG/LKG/UKG), <b>Class</b> (PP1–PP10)
      </div>

      {loading ? <Spinner center /> : (
        filtered.length === 0 ? (
          <EmptyState icon="🎓" message="No students found."
            action={<button className="btn-primary" onClick={() => { setForm(BLANK); setModal('add') }}>Add First Student</button>} />
        ) : (
          <div className="glass" style={{ borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(59,191,178,.06)', borderBottom: '2px solid #EDF2F7' }}>
                  {['Name', 'DOB', 'Grade', 'Class', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#4A5568', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #EDF2F7', background: i % 2 === 0 ? 'white' : 'rgba(247,250,252,.6)' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 500, color: '#2D3748' }}>{s.name}</td>
                    <td style={{ padding: '11px 16px', color: '#718096' }}>{s.dob || '—'}</td>
                    <td style={{ padding: '11px 16px' }}><GradeBadge grade={s.grade} /></td>
                    <td style={{ padding: '11px 16px', color: '#718096', fontWeight: 600 }}>{s.classId}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => { setForm({ ...s }); setModal('edit') }}>Edit</button>
                        <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => setConfirm({ msg: `Mark ${s.name} as alumni? Their data will be preserved.`, onConfirm: () => handleDelete(s.id) })}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Add/Edit modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontFamily: 'Playfair Display', fontSize: 20, fontWeight: 700, color: '#2D3748' }}>
                {modal === 'add' ? 'Add Student' : 'Edit Student'}
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#A0AEC0' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Full Name *</label>
                <input className="form-input" placeholder="Student's full name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Date of Birth</label>
                <input type="date" className="form-input" value={form.dob}
                  onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Grade *</label>
                  <select className="form-select" value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}>
                    {GRADES.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Class *</label>
                  <select className="form-select" value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}>
                    {CLASSES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {error && <div className="error-box">{error}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : modal === 'add' ? 'Add Student' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog message={confirm.msg} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />
      )}
    </div>
  )
}
