import * as XLSX from 'xlsx'

// ─── Excel export for teacher logs ───────────────────────────────────────────

export function exportLogsToExcel(records, students, className) {
  const rows = records.map(r => {
    const student = students.find(s => s.id === r.studentId)
    return {
      'Student Name':     student?.name || r.studentId,
      'Grade':            student?.grade || '',
      'Area':             r.areaName    || '',
      'Sub-area':         r.subAreaName || '',
      'Skill / Activity': r.skillName   || '',
      'Term':             r.term        || '',
      'Level':            r.level       || '',
      'Date Presented':   r.dateOfPresentation || '',
      'Practice Count':   r.practiceCount || '',
      'Teacher Note':     r.note        || '',
      'Logged By':        r.loggedByName|| '',
      'Last Updated':     r.updatedAt?.toDate?.().toLocaleDateString('en-IN') || '',
    }
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Progress Logs')
  XLSX.writeFile(wb, `${className}_logs_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ─── Excel import for student list ───────────────────────────────────────────

export function parseStudentExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data  = new Uint8Array(e.target.result)
        const wb    = XLSX.read(data, { type: 'array' })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const rows  = XLSX.utils.sheet_to_json(ws)
        const students = rows.map(r => ({
          name:    (r['Name'] || r['Student Name'] || '').trim(),
          dob:     r['DOB'] || r['Date of Birth'] || '',
          grade:   r['Grade'] || '',
          classId: r['Class'] || '',
        })).filter(s => s.name)
        resolve(students)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ─── Report card Excel export ─────────────────────────────────────────────────

export function exportReportCardExcel(student, areas, progressMap) {
  const rows = []
  areas.forEach(area => {
    area.subAreas.forEach(sub => {
      sub.skills.forEach(skill => {
        const key = skill.id
        rows.push({
          'Area':     area.name,
          'Sub-area': sub.name,
          'Skill':    skill.name,
          'Term 1':   progressMap[key]?.T1?.level || '—',
          'Term 2':   progressMap[key]?.T2?.level || '—',
          'Term 3':   progressMap[key]?.T3?.level || '—',
        })
      })
    })
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report Card')
  XLSX.writeFile(wb, `${student.name.replace(/\s+/g, '_')}_report_card.xlsx`)
}

// ─── Gemini AI narrative generator ───────────────────────────────────────────

export async function generateNarrativeWithGemini(areaName, skills, progressMap, teacherNote, studentName) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API key not configured')

  // Build context for the prompt
  const skillLines = skills.map(skill => {
    const p = progressMap[skill.id]
    const levels = ['T1', 'T2', 'T3']
      .filter(t => p?.[t]?.level)
      .map(t => `${t === 'T1' ? 'Term 1' : t === 'T2' ? 'Term 2' : 'Term 3'}: ${p[t].level}`)
      .join(', ')
    return `- ${skill.name}: ${levels || 'not yet recorded'}`
  }).join('\n')

  const levelMeaning = 'M=Making an effort, A=Advancing, R=Reaching milestone, P=Proficient'

  const prompt = `You are writing a Montessori school report card narrative paragraph for a student named ${studentName}.

Area: ${areaName}

Skills and levels recorded (${levelMeaning}):
${skillLines}

Teacher's observation note: ${teacherNote || 'No note provided'}

Write a warm, encouraging, and professional narrative paragraph (3-5 sentences) summarizing this student's progress in this area. 
- Write in third person using the student's name
- Be specific about what they can do, not just labels
- Maintain a positive and growth-oriented tone
- Do not mention the level codes (M, A, R, P) directly
- Do not add any heading — just the paragraph text`

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
  if (!res.ok) throw new Error('Gemini API error: ' + res.status)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─── Report card Word doc (.docx) export — plain HTML to docx via Blob ───────
// We generate an HTML string and trigger download as .html for now;
// proper .docx generation requires a server. The HTML prints cleanly to PDF/Word.

export function exportReportCardHTML(student, areas, progressMap, narratives, attendance) {
  const levelColors = { M:'#b7860a', A:'#c0623c', R:'#2a7a74', P:'#276749', NA:'#718096' }

  const areaHTML = areas.map(area => {
    const skillRows = area.subAreas.flatMap(sub =>
      sub.skills.map(skill => {
        const p = progressMap[skill.id] || {}
        const cell = (t) => p[t]?.level
          ? `<span style="font-weight:800;color:${levelColors[p[t].level]}">${p[t].level}</span>`
          : `<span style="color:#CBD5E0">—</span>`
        return `<tr>
          <td style="font-size:11px;padding:5px 8px;border:1px solid #CBD5E0">${skill.name}</td>
          <td style="text-align:center;border:1px solid #CBD5E0;padding:5px">${cell('T1')}</td>
          <td style="text-align:center;border:1px solid #CBD5E0;padding:5px">${cell('T2')}</td>
          <td style="text-align:center;border:1px solid #CBD5E0;padding:5px">${cell('T3')}</td>
        </tr>`
      })
    ).join('')

    const narrative = narratives[area.id]
      ? `<p style="font-size:11px;color:#4A5568;padding:8px 12px;background:#f0fdfa;border:1px solid #b2f5ea;border-radius:0 0 4px 4px;line-height:1.7;margin:0">${narratives[area.id]}</p>`
      : ''

    return `
      <div style="margin-bottom:18px">
        <div style="background:#3BBFB2;color:white;font-weight:700;font-size:12px;padding:6px 12px;border-radius:4px 4px 0 0">${area.name}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr>
            <th style="width:55%;text-align:left;padding:6px 8px;border:1px solid #CBD5E0;background:#F7FAFC">Skill / Activity</th>
            <th style="text-align:center;padding:6px;border:1px solid #CBD5E0;background:#F7FAFC;width:15%">Term 1</th>
            <th style="text-align:center;padding:6px;border:1px solid #CBD5E0;background:#F7FAFC;width:15%">Term 2</th>
            <th style="text-align:center;padding:6px;border:1px solid #CBD5E0;background:#F7FAFC;width:15%">Term 3</th>
          </tr></thead>
          <tbody>${skillRows}</tbody>
        </table>
        ${narrative}
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Report Card — ${student.name}</title>
  <style>
    body { font-family: 'DM Sans', Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #2D3748; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #EDF2F7">
    <div style="font-size:22px;font-weight:700;color:#2D3748">🪷 Kamala Niketan</div>
    <div style="font-size:15px;font-weight:700;color:#3BBFB2;margin-top:4px">Year End Progress Report 2025–2026</div>
  </div>
  <table style="width:100%;margin-bottom:16px;font-size:13px">
    <tr>
      <td><b>Name:</b> ${student.name}</td>
      <td><b>Grade:</b> ${student.grade}</td>
    </tr>
    <tr>
      <td><b>Class:</b> ${student.className || ''}</td>
      <td><b>Principal:</b> Mrs. Mala Sivakumar</td>
    </tr>
  </table>
  <div style="margin-bottom:16px">
    <b style="font-size:12px">Attendance</b>
    <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:12px">
      <thead><tr>
        <th style="border:1px solid #CBD5E0;padding:6px;background:#F7FAFC">Term 1</th>
        <th style="border:1px solid #CBD5E0;padding:6px;background:#F7FAFC">Term 2</th>
        <th style="border:1px solid #CBD5E0;padding:6px;background:#F7FAFC">Term 3</th>
        <th style="border:1px solid #CBD5E0;padding:6px;background:#F7FAFC">Total</th>
      </tr></thead>
      <tbody><tr>
        <td style="border:1px solid #CBD5E0;padding:6px;text-align:center">${attendance?.T1 || '— / —'}</td>
        <td style="border:1px solid #CBD5E0;padding:6px;text-align:center">${attendance?.T2 || '— / —'}</td>
        <td style="border:1px solid #CBD5E0;padding:6px;text-align:center">${attendance?.T3 || '— / —'}</td>
        <td style="border:1px solid #CBD5E0;padding:6px;text-align:center">${attendance?.total || '— / —'}</td>
      </tr></tbody>
    </table>
  </div>
  ${areaHTML}
  <div style="margin-top:20px;padding-top:12px;border-top:2px solid #EDF2F7;font-size:11px;color:#718096;line-height:1.8">
    <b>Level of Achievement</b> — P (Proficient) · R (Reaching the milestone) · A (Advancing) · M (Making an Effort) · NA (Not Applicable) · — (Not yet recorded)
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${student.name.replace(/\s+/g,'_')}_report_card.html`
  a.click()
  URL.revokeObjectURL(url)
}
