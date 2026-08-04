// api/keepalive.js
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  )
  const { error } = await supabase.from('students').select('id').limit(1)
  if (error) {
    res.status(500).json({ ok: false, error: error.message })
    return
  }
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ok: true, pinged: new Date().toISOString() })
}