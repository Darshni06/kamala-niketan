import { useState, useEffect } from 'react'
import { getAllTeachers, createUser, updateUserProfile, deleteUserProfile, resetPassword } from '../../supabase/services'
import { PageHeader, Spinner, ConfirmDialog, SearchInput, EmptyState } from '../../components/UI'
import { CLASSES, TEAL } from '../../utils/theme'

const BLANK = { name: '', email: '', password: '', classId: 'PP1' }

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)
  const [form,     setForm]     = useState(BLANK)
  const [search,   setSearch]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [confirm,  setConfirm]  = useState(null)

  const load = async () => {
    setLoading(true)
    try { setTeachers(await getAllTeachers()) }
    catch { setError('Failed to load teachers.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = teachers.filter(t =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.email?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required.'); return }
    if (modal === 'add' && !form.password) { setError('Password is required for new teachers.'); return }
    setSaving(true); setError('')
    try {
      if (modal === 'add') {
        await createUser(form.email.trim(), form.password, {
          name: form.name.trim(), role: 'teacher', classId: form.classId,
          className: form.classId,
        })
      } else {
        await updateUserProfile(form.id, { name: form.name.trim(), classId: form.classId, className: form.classId })
      }
      setModal(null); setForm(BLANK); load()
      setSuccess(modal === 'add' ? 'Teacher account created.' : 'Teacher updated.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      const msg = e.code === 'auth/email-already-in-use' ? 'This email is already in use.' : 'Failed to save teacher.'
      setError(msg)
    } finally { setSaving(false) }
  }

  const handleResetPassword = async (email) => {
    await resetPassword(email)
    setSuccess(`Password reset email sent to ${email}.`)
    setTimeout(() => setSuccess(''), 4000)
  }

  return (
    <div>
      <PageHeader
        role="admin"
        title="Teachers"
        subtitle={`${teachers.length} teacher accounts`}
        action={
          <button className="btn-primary" onClick={() => { setForm(BLANK); setModal('add') }}>
            + Add Teacher
          </button>
        }
      />

      {error   && <div className="error-box"   style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="success-box" style={{ marginBottom: 16 }}>{success}</div>}

      <div style={{ marginBottom: 20, maxWidth: 340 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email..." />
      </div>

      {loading ? <Spinner center /> : (
        filtered.length === 0 ? (
          <EmptyState icon="👤" message="No teachers yet."
            action={<button className="btn-primary" onClick={() => { setForm(BLANK); setModal('add') }}>Add First Teacher</button>} />
        ) : (
          <div className="glass" style={{ borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(59,191,178,.06)', borderBottom: '2px solid #EDF2F7' }}>
                  {['Name', 'Email', 'Class', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#4A5568', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #EDF2F7', background: i % 2 === 0 ? 'white' : 'rgba(247,250,252,.6)' }}>
                    <td style={{ padding: '11px 16px', fontWeight: 500 }}>{t.name}</td>
                    <td style={{ padding: '11px 16px', color: '#718096' }}>{t.email}</td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{ fontWeight: 700, color: TEAL, background: 'rgba(59,191,178,.1)', padding: '3px 10px', borderRadius: 8 }}>{t.classId}</span>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => { setForm({ ...t, password: '' }); setModal('edit') }}>Edit</button>
                        <button className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#718096', borderColor: '#E2E8F0' }}
                          onClick={() => handleResetPassword(t.email)}>Reset Pwd</button>
                        <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => setConfirm({ msg: `Delete teacher account for ${t.name}?`, onConfirm: async () => { await deleteUserProfile(t.id); setConfirm(null); load() } })}>
                          Delete
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

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontFamily: 'Playfair Display', fontSize: 20, fontWeight: 700, color: '#2D3748' }}>
                {modal === 'add' ? 'Add Teacher' : 'Edit Teacher'}
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#A0AEC0' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Full Name *</label>
                <input className="form-input" placeholder="Teacher's full name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" placeholder="teacher@kamalaniketan.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={modal === 'edit'} />
              </div>
              {modal === 'add' && (
                <div>
                  <label className="form-label">Password *</label>
                  <input className="form-input" type="password" placeholder="Min 8 characters" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="form-label">Assigned Class *</label>
                <select className="form-select" value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}>
                  {CLASSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              {error && <div className="error-box">{error}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setModal(null)}>Cancel</button>
                <button className="btn-primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : modal === 'add' ? 'Create Account' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog message={confirm.msg} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  )
}
