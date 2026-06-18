import * as XLSX from 'xlsx'

// ─── Excel export for teacher logs — 4-layer structure ───────────────────────

export function exportLogsToExcel(records, students, className) {
  if (!records || records.length === 0) {
    alert('No logs to export yet.')
    return
  }

  const rows = records.map(r => {
    // Support both Supabase (snake_case) and Firebase (camelCase) field names
    const studentId   = r.student_id   || r.studentId
    const student     = students.find(s => s.id === studentId)
    const levelMeaning = r.level === 'M' ? 'Making an effort'
                       : r.level === 'A' ? 'Advancing'
                       : r.level === 'R' ? 'Reaching milestone'
                       : r.level === 'P' ? 'Proficient' : ''
    // Format last updated — Supabase uses ISO string, Firebase uses Timestamp
    let lastUpdated = ''
    if (r.updated_at) {
      lastUpdated = new Date(r.updated_at).toLocaleDateString('en-IN')
    } else if (r.updatedAt?.toDate) {
      lastUpdated = r.updatedAt.toDate().toLocaleDateString('en-IN')
    }
    // Dates array (new Supabase field)
    const datesLogged = Array.isArray(r.dates) ? r.dates.join(', ') : (r.dateOfPresentation || '')

    return {
      'Student Name':       student?.name         || r.student_name  || r.studentName  || '',
      'Grade':              student?.grade         || r.grade         || '',
      'Subject':            r.subject_name         || r.subjectName   || '',
      'Category':           r.category_name        || r.categoryName  || '',
      'Skill':              r.skill_name           || r.skillName     || '',
      'Activity':           r.activity_name        || r.activityName  || '',
      'Term':               r.term                 || '',
      'Level':              r.level                || '',
      'Level Meaning':      levelMeaning,
      'Dates Logged':       datesLogged,
      'Total Practice Count': r.total_practice_count ?? r.practiceCount ?? '',
      'Logged By':          r.logged_by_name       || r.loggedByName  || '',
      'Last Updated':       lastUpdated,
    }
  })

  // Sort by student name then term
  rows.sort((a, b) => {
    const nameComp = a['Student Name'].localeCompare(b['Student Name'])
    if (nameComp !== 0) return nameComp
    return (a['Term'] || '').localeCompare(b['Term'] || '')
  })

  const ws = XLSX.utils.json_to_sheet(rows)

  // Set column widths
  ws['!cols'] = [
    { wch: 24 }, // Student Name
    { wch: 8  }, // Grade
    { wch: 18 }, // Subject
    { wch: 22 }, // Category
    { wch: 26 }, // Skill
    { wch: 30 }, // Activity
    { wch: 6  }, // Term
    { wch: 6  }, // Level
    { wch: 20 }, // Level Meaning
    { wch: 18 }, // Date
    { wch: 14 }, // Practice Count
    { wch: 40 }, // Teacher Note
    { wch: 18 }, // Logged By
    { wch: 14 }, // Last Updated
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Progress Logs')
  XLSX.writeFile(wb, `${className}_progress_logs_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ─── Excel import for student list ───────────────────────────────────────────

export function parseStudentExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data     = new Uint8Array(e.target.result)
        const wb       = XLSX.read(data, { type: 'array' })
        const ws       = wb.Sheets[wb.SheetNames[0]]
        const rows     = XLSX.utils.sheet_to_json(ws)
        const students = rows.map(r => ({
          name:    (r['Name'] || r['Student Name'] || r['name'] || '').trim(),
          dob:     r['DOB'] || r['Date of Birth'] || r['dob'] || '',
          grade:   r['Grade'] || r['grade'] || '',
          classId: r['Class'] || r['class'] || r['ClassId'] || '',
        })).filter(s => s.name)
        resolve(students)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ─── Report card Excel export ─────────────────────────────────────────────────

export function exportReportCardExcel(student, curriculum, skillProgressMap) {
  const rows = []

  for (const subject of curriculum) {
    for (const sub of (subject.subAreas || subject.categories || [])) {
      for (const skill of sub.skills) {
        const sp = skillProgressMap[skill.id] || {}
        rows.push({
          'Subject':  subject.name,
          'Category': sub.name,
          'Skill':    skill.name,
          'Term 1':   sp['T1']?.level || '—',
          'Term 2':   sp['T2']?.level || '—',
          'Term 3':   sp['T3']?.level || '—',
          'T1 Avg':   sp['T1']?.avg   || '—',
          'T2 Avg':   sp['T2']?.avg   || '—',
          'T3 Avg':   sp['T3']?.avg   || '—',
        })
      }
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 20 }, { wch: 22 }, { wch: 30 },
    { wch: 8  }, { wch: 8  }, { wch: 8  },
    { wch: 8  }, { wch: 8  }, { wch: 8  },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report Card')
  XLSX.writeFile(wb, `${student.name.replace(/\s+/g, '_')}_report_card.xlsx`)
}

// ─── Report card HTML export ──────────────────────────────────────────────────

export function exportReportCardHTML(student, curriculum, skillProgressMap, narratives, attendance) {
  const LEVEL_COLORS_HTML = { M:'#b7860a', A:'#c0623c', R:'#2a7a74', P:'#276749', NA:'#718096' }

  const subjectsHTML = curriculum.map(subject => {
    const allSkills = (subject.subAreas || subject.categories || [])
      .flatMap(sub => (sub.skills || []).map(sk => ({ ...sk, categoryName: sub.name })))

    const skillRows = allSkills.map(skill => {
      const sp = skillProgressMap[skill.id] || {}
      const cell = (t) => {
        const d = sp[t]
        if (!d) return '<span style="color:#CBD5E0">—</span>'
        return `<span style="font-weight:800;color:${LEVEL_COLORS_HTML[d.level] || '#718096'}" title="avg ${d.avg}/4">${d.level}</span>`
      }
      return `<tr>
        <td style="font-size:11px;padding:5px 8px;border:1px solid #CBD5E0">${skill.name}</td>
        <td style="text-align:center;border:1px solid #CBD5E0;padding:5px">${cell('T1')}</td>
        <td style="text-align:center;border:1px solid #CBD5E0;padding:5px">${cell('T2')}</td>
        <td style="text-align:center;border:1px solid #CBD5E0;padding:5px">${cell('T3')}</td>
      </tr>`
    }).join('')

    const narrative = narratives?.[subject.id]
      ? `<p style="font-size:11px;color:#4A5568;padding:8px 12px;background:#f0fdfa;border:1px solid #b2f5ea;border-top:none;margin:0;line-height:1.7">${narratives[subject.id]}</p>`
      : ''

    return `
      <div style="margin-bottom:18px">
        <div style="background:#3BBFB2;color:white;font-weight:700;font-size:12px;padding:6px 12px;border-radius:4px 4px 0 0">${subject.name}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr>
            <th style="width:55%;text-align:left;padding:6px 8px;border:1px solid #CBD5E0;background:#F7FAFC">Skill</th>
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
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #2D3748; }
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
      <td><b>Class:</b> ${student.classId || student.className || ''}</td>
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
  ${subjectsHTML}
  <div style="margin-top:20px;padding-top:12px;border-top:2px solid #EDF2F7;font-size:11px;color:#718096;line-height:1.8">
    <b>Level of Achievement</b> — P (Proficient · 4) · R (Reaching milestone · 3) · A (Advancing · 2) · M (Making an Effort · 1) · — (Not yet recorded)<br/>
    <b>Formula:</b> Skill level = average of all activity levels logged for that skill, rounded to nearest level.
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${student.name.replace(/\s+/g, '_')}_report_card.html`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Gemini AI narrative ──────────────────────────────────────────────────────

export async function generateNarrativeWithGemini(areaName, skills, progressMap, teacherNote, studentName) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API key not configured')

  const skillLines = skills.map(skill => {
    const p = progressMap[skill.id] || {}
    const levels = ['T1', 'T2', 'T3']
      .filter(t => p[t]?.level)
      .map(t => `${t}: ${p[t].level} (avg ${p[t].avg}/4)`)
      .join(', ')
    return `- ${skill.name}: ${levels || 'not yet recorded'}`
  }).join('\n')

  const prompt = `You are writing a Montessori school report card narrative for ${studentName}.

Subject: ${areaName}

Skill progress (M=1, A=2, R=3, P=4, averaged across activities per term):
${skillLines}

Teacher observations: ${teacherNote || 'None provided'}

Write a warm, encouraging 3-4 sentence paragraph summarising progress.
Use the student's name. No level codes. No heading — just the paragraph.`

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
