// src/pages/admin/WeeklyPlanAdminPage.jsx
import { useState } from 'react'
import { PageHeader, EmptyState } from '../../components/UI'
import WeeklyPlanTable from '../../components/WeeklyPlanTable'
import { CLASSES } from '../../utils/theme'

export default function WeeklyPlanAdminPage() {
  const [classId, setClassId] = useState('')

  return (
    <div>
      <PageHeader role="admin" title="Class Weekly Plans"
        subtitle="Pick a class to see that teacher's weekly plan — the same view they see." />

      <div className="glass" style={{ borderRadius: 12, padding: 16, marginBottom: 18, maxWidth: 260 }}>
        <label className="form-label">Class</label>
        <select className="form-select" value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">Select a class...</option>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {!classId ? (
        <EmptyState icon="🏫" message="Choose a class above to view its weekly plan." />
      ) : (
        <WeeklyPlanTable key={classId} classId={classId} />
      )}
    </div>
  )
}
