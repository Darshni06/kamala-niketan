// src/utils/planUtils.js
// Small shared helpers for the Weekly Plan feature (teacher creation tab,
// teacher/admin visualization tables). Kept in one place so the status
// label/colour logic can never drift between the two screens.

// presentation_count → display label
//   0            → "PL"  (planned, not yet presented)
//   1            → "PR"  (presented once)
//   2, 3, 4 ...  → "P-1", "P-2", "P-3" ...  (practiced again after presenting)
export function planStatusLabel(count) {
  const n = count || 0
  if (n === 0) return 'PL'
  if (n === 1) return 'PR'
  return `P-${n - 1}`
}

export function planStatusColor(count) {
  const n = count || 0
  if (n === 0) return '#A0AEC0' // planned — grey
  if (n === 1) return '#3BBFB2' // presented — teal
  return '#48BB78'              // practiced again — green
}

export function planStatusBg(count) {
  const n = count || 0
  if (n === 0) return '#F7FAFC'
  if (n === 1) return 'rgba(59,191,178,.12)'
  return 'rgba(72,187,120,.12)'
}

// Inclusive list of 'YYYY-MM-DD' strings from `fromISO` to `toISO`
export function dateRange(fromISO, toISO) {
  const out = []
  let d = new Date(fromISO + 'T00:00:00')
  const end = new Date(toISO + 'T00:00:00')
  if (isNaN(d) || isNaN(end)) return out
  while (d <= end) {
    out.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

// Monday of the week containing `dateStr`
export function startOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0 = Sun ... 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export function startOfMonth(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function endOfMonth(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().split('T')[0]
}

export function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatDateRangeLabel(fromISO, toISO) {
  const f = new Date(fromISO + 'T00:00:00')
  const t = new Date(toISO + 'T00:00:00')
  const opts = { day: 'numeric', month: 'short' }
  return `${f.toLocaleDateString('en-IN', opts)} – ${t.toLocaleDateString('en-IN', opts)}`
}
