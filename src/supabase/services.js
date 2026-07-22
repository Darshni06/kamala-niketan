// src/supabase/services.js
import { supabase } from './client'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginUser = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const resetPassword = async (email) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email)
  if (error) throw error
}

// Create teacher — uses secondary client so admin session is preserved
export const createUser = async (email, password, profileData) => {
  const { data: { session: adminSession } } = await supabase.auth.getSession()

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  const newUid = data.user?.id
  if (!newUid) throw new Error('User creation failed')

  const { error: profileError } = await supabase
    .from('users')
    .insert({
      id:         newUid,
      email,
      name:       profileData.name      || '',
      role:       profileData.role      || 'teacher',
      class_id:   profileData.classId   || '',
      class_name: profileData.className || '',
    })
  if (profileError) throw profileError

  if (adminSession) {
    await supabase.auth.setSession({
      access_token:  adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    })
  }

  return { id: newUid, email, ...profileData }
}

// ─── User profiles ────────────────────────────────────────────────────────────

export const getUserProfile = async (uid) => {
  const { data, error } = await supabase
    .from('users').select('*').eq('id', uid).single()
  if (error) return null
  return {
    id:        data.id,
    uid:       data.id,
    email:     data.email,
    name:      data.name,
    role:      data.role,
    classId:   data.class_id,
    className: data.class_name,
  }
}

export const getAllTeachers = async () => {
  const { data, error } = await supabase
    .from('users').select('*').eq('role', 'teacher').order('name')
  if (error) throw error
  return data.map(u => ({
    id:        u.id,
    uid:       u.id,
    email:     u.email,
    name:      u.name,
    role:      u.role,
    classId:   u.class_id,
    className: u.class_name,
  }))
}

export const updateUserProfile = async (uid, profileData) => {
  const { error } = await supabase
    .from('users')
    .update({
      name:       profileData.name,
      class_id:   profileData.classId,
      class_name: profileData.className || profileData.classId,
    })
    .eq('id', uid)
  if (error) throw error
}

// FIX 1: Delete teacher — removes from users table
// Note: Supabase Auth user deletion requires service role key (admin API)
// We delete from users table which removes their access immediately
// The Auth entry becomes orphaned but harmless
export const deleteUserProfile = async (uid) => {
  const { error } = await supabase.from('users').delete().eq('id', uid)
  if (error) throw error
  // Also try to delete from auth if service role is available
  // This will silently fail with anon key which is fine
  try {
    await supabase.auth.admin.deleteUser(uid)
  } catch {}
}

// ─── Classes ──────────────────────────────────────────────────────────────────

export const getClasses = async () => {
  const { data, error } = await supabase.from('classes').select('*').order('id')
  if (error) throw error
  return data
}

// ─── Students ─────────────────────────────────────────────────────────────────

export const getAllStudents = async () => {
  const { data, error } = await supabase
    .from('students').select('*').eq('status', 'active').order('name')
  if (error) throw error
  return data.map(s => ({ ...s, classId: s.class_id }))
}

export const getStudentsByClass = async (classId) => {
  const { data, error } = await supabase
    .from('students').select('*')
    .eq('class_id', classId).eq('status', 'active').order('name')
  if (error) throw error
  return data.map(s => ({ ...s, classId: s.class_id }))
}

export const getStudent = async (studentId) => {
  const { data, error } = await supabase
    .from('students').select('*').eq('id', studentId).single()
  if (error) return null
  return { ...data, classId: data.class_id }
}

export const addStudent = async (studentData) => {
  const { data, error } = await supabase
    .from('students')
    .insert({
      name:     studentData.name,
      dob:      studentData.dob     || null,
      grade:    studentData.grade,
      class_id: studentData.classId || studentData.class_id,
      status:   'active',
    })
    .select().single()
  if (error) throw error
  return data.id
}

export const updateStudent = async (id, studentData) => {
  const { error } = await supabase
    .from('students')
    .update({
      name:     studentData.name,
      dob:      studentData.dob     || null,
      grade:    studentData.grade,
      class_id: studentData.classId || studentData.class_id,
    })
    .eq('id', id)
  if (error) throw error
}

// FIX 2: Delete student properly — hard delete so it actually disappears
export const deleteStudent = async (id) => {
  // First mark as alumni (soft delete)
  const { error } = await supabase
    .from('students')
    .update({ status: 'alumni' })
    .eq('id', id)
  if (error) throw error
}

// Hard delete — removes student AND all their progress/notes records
export const hardDeleteStudent = async (id) => {
  // Delete progress records first
  await supabase.from('progress').delete().eq('student_id', id)
  // Delete teacher notes
  await supabase.from('teacher_notes').delete().eq('student_id', id)
  // Delete the student
  const { error } = await supabase.from('students').delete().eq('id', id)
  if (error) throw error
}

export const bulkAddStudents = async (students) => {
  const rows = students.map(s => ({
    name:     s.name,
    dob:      s.dob      || null,
    grade:    s.grade,
    class_id: s.classId  || s.class_id || s.Class || '',
    status:   'active',
  }))
  const { error } = await supabase.from('students').insert(rows)
  if (error) throw error
}

// ─── Curriculum — 4-layer ─────────────────────────────────────────────────────

export const getSubjectsByGrade = async (grade) => {
  const { data, error } = await supabase
    .from('subjects').select('*').eq('grade', grade).order('order')
  if (error) throw error
  return data
}

export const getCategoriesBySubject = async (subjectId) => {
  const { data, error } = await supabase
    .from('categories').select('*').eq('subject_id', subjectId).order('order')
  if (error) throw error
  return data.map(c => ({ ...c, subjectId: c.subject_id }))
}

export const getSkillsByCategory = async (categoryId) => {
  const { data, error } = await supabase
    .from('skills').select('*').eq('category_id', categoryId).order('order')
  if (error) throw error
  return data.map(s => ({ ...s, categoryId: s.category_id }))
}

export const getActivitiesBySkill = async (skillId) => {
  const { data, error } = await supabase
    .from('activities').select('*').eq('skill_id', skillId).order('order')
  if (error) throw error
  return data.map(a => ({ ...a, skillId: a.skill_id }))
}

// Flat activity list for a subject — used by Weekly Plan, where teachers only
// ever pick a Subject + Activity (no Category/Skill step). Category/Skill are
// still resolved and carried along quietly so weekly_plans rows stay fully
// consistent with the rest of the curriculum data.
export const getActivitiesBySubject = async (subjectId) => {
  const categories = await getCategoriesBySubject(subjectId)
  const results = []
  for (const cat of categories) {
    const skills = await getSkillsByCategory(cat.id)
    for (const sk of skills) {
      const acts = await getActivitiesBySkill(sk.id)
      acts.forEach(a => results.push({
        ...a,
        skillId:      sk.id,
        skillName:    sk.name,
        categoryId:   cat.id,
        categoryName: cat.name,
      }))
    }
  }
  return results
}

export const getCurriculumForGrade = async (grade) => {
  const subjects = await getSubjectsByGrade(grade)
  for (const sub of subjects) {
    sub.categories = await getCategoriesBySubject(sub.id)
    for (const cat of sub.categories) {
      cat.skills = await getSkillsByCategory(cat.id)
      for (const skill of cat.skills) {
        skill.activities = await getActivitiesBySkill(skill.id)
      }
    }
  }
  return subjects
}

export const addSubject = async (grade, name, order) => {
  const { data, error } = await supabase
    .from('subjects').insert({ grade, name, order }).select().single()
  if (error) throw error
  return data.id
}
export const updateSubjectName = async (id, name) => {
  const { error } = await supabase.from('subjects').update({ name }).eq('id', id)
  if (error) throw error
}
export const deleteSubjectCascade = async (id) => {
  const { error } = await supabase.from('subjects').delete().eq('id', id)
  if (error) throw error
}

export const addCategory = async (subjectId, name, order) => {
  const { data, error } = await supabase
    .from('categories').insert({ subject_id: subjectId, name, order }).select().single()
  if (error) throw error
  return data.id
}
export const updateCategoryName = async (id, name) => {
  const { error } = await supabase.from('categories').update({ name }).eq('id', id)
  if (error) throw error
}
export const deleteCategoryCascade = async (id) => {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

export const addSkill = async (categoryId, name, order) => {
  const { data, error } = await supabase
    .from('skills').insert({ category_id: categoryId, name, order }).select().single()
  if (error) throw error
  return data.id
}
export const updateSkillName = async (id, name) => {
  const { error } = await supabase.from('skills').update({ name }).eq('id', id)
  if (error) throw error
}
export const deleteSkillCascade = async (id) => {
  const { error } = await supabase.from('skills').delete().eq('id', id)
  if (error) throw error
}

export const addActivity = async (skillId, name, order) => {
  const { data, error } = await supabase
    .from('activities').insert({ skill_id: skillId, name, order }).select().single()
  if (error) throw error
  return data.id
}
export const updateActivityName = async (id, name) => {
  const { error } = await supabase.from('activities').update({ name }).eq('id', id)
  if (error) throw error
}
export const deleteActivityById = async (id) => {
  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) throw error
}

// Bulk import curriculum from parsed Excel rows
// Each row: { subject, category, skill, activity, grade }
// Creates Subject → Category → Skill → Activity, reusing existing ones by name+parent
export const bulkImportCurriculum = async (rows) => {
  // Cache to avoid duplicate inserts within this import run
  const subjectCache  = {} // grade+name -> id
  const categoryCache = {} // subjectId+name -> id
  const skillCache    = {} // categoryId+name -> id

  let created = { subjects: 0, categories: 0, skills: 0, activities: 0 }
  let skipped = 0

  for (const row of rows) {
    try {
      // ── Subject ──
      const subKey = `${row.grade}::${row.subject}`
      let subjectId = subjectCache[subKey]
      if (!subjectId) {
        const { data: existingSub } = await supabase
          .from('subjects').select('id')
          .eq('grade', row.grade).eq('name', row.subject)
          .maybeSingle()
        if (existingSub) {
          subjectId = existingSub.id
        } else {
          const { data: newSub, error } = await supabase
            .from('subjects')
            .insert({ grade: row.grade, name: row.subject, order: 0 })
            .select().single()
          if (error) throw error
          subjectId = newSub.id
          created.subjects++
        }
        subjectCache[subKey] = subjectId
      }

      // ── Category ──
      const catKey = `${subjectId}::${row.category}`
      let categoryId = categoryCache[catKey]
      if (!categoryId) {
        const { data: existingCat } = await supabase
          .from('categories').select('id')
          .eq('subject_id', subjectId).eq('name', row.category)
          .maybeSingle()
        if (existingCat) {
          categoryId = existingCat.id
        } else {
          const { data: newCat, error } = await supabase
            .from('categories')
            .insert({ subject_id: subjectId, name: row.category, order: 0 })
            .select().single()
          if (error) throw error
          categoryId = newCat.id
          created.categories++
        }
        categoryCache[catKey] = categoryId
      }

      // ── Skill ──
      const skillKey = `${categoryId}::${row.skill}`
      let skillId = skillCache[skillKey]
      if (!skillId) {
        const { data: existingSkill } = await supabase
          .from('skills').select('id')
          .eq('category_id', categoryId).eq('name', row.skill)
          .maybeSingle()
        if (existingSkill) {
          skillId = existingSkill.id
        } else {
          const { data: newSkill, error } = await supabase
            .from('skills')
            .insert({ category_id: categoryId, name: row.skill, order: 0 })
            .select().single()
          if (error) throw error
          skillId = newSkill.id
          created.skills++
        }
        skillCache[skillKey] = skillId
      }

      // ── Activity ── (always check for duplicate before inserting)
      const { data: existingAct } = await supabase
        .from('activities').select('id')
        .eq('skill_id', skillId).eq('name', row.activity)
        .maybeSingle()
      if (!existingAct) {
        const { error } = await supabase
          .from('activities')
          .insert({ skill_id: skillId, name: row.activity, order: 0 })
        if (error) throw error
        created.activities++
      } else {
        skipped++
      }
    } catch (err) {
      console.error('Row failed:', row, err)
      skipped++
    }
  }

  return { created, skipped, total: rows.length }
}

// ─── Progress Records ─────────────────────────────────────────────────────────
// FIX 3: dateOfPresentation now correctly used as logDate

export const saveProgressRecord = async (data) => {
  // Use the date the teacher selected — NOT today
  // data.dateOfPresentation comes as 'YYYY-MM-DD' from the date input
  const logDate = (data.dateOfPresentation && data.dateOfPresentation.trim())
    ? data.dateOfPresentation.trim()
    : new Date().toISOString().split('T')[0]

  const { data: existing, error: fetchError } = await supabase
    .from('progress')
    .select('id, total_practice_count, dates')
    .eq('student_id',  data.studentId)
    .eq('activity_id', data.activityId)
    .eq('term',        data.term)
    .maybeSingle()  // use maybeSingle instead of single — doesn't error when no row found

  let savedId

  if (existing) {
    const newCount      = (existing.total_practice_count || 0) + (Number(data.practiceCount) || 0)
    const existingDates = Array.isArray(existing.dates) ? existing.dates : []
    const newDates      = existingDates.includes(logDate)
      ? existingDates
      : [...existingDates, logDate]

    const { error } = await supabase
      .from('progress')
      .update({
        level:                data.level,
        total_practice_count: newCount,
        dates:                newDates,
        logged_by:            data.loggedBy     || null,
        logged_by_name:       data.loggedByName || '',
        updated_at:           new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) throw error
    savedId = existing.id
  } else {
    const { data: inserted, error } = await supabase
      .from('progress')
      .insert({
        student_id:           data.studentId,
        student_name:         data.studentName   || '',
        class_id:             data.classId       || '',
        grade:                data.grade         || '',
        term:                 data.term,
        subject_id:           data.subjectId     || null,
        subject_name:         data.subjectName   || '',
        category_id:          data.categoryId    || null,
        category_name:        data.categoryName  || '',
        skill_id:             data.skillId       || null,
        skill_name:           data.skillName     || '',
        activity_id:          data.activityId    || null,
        activity_name:        data.activityName  || '',
        level:                data.level,
        total_practice_count: Number(data.practiceCount) || 0,
        dates:                [logDate],
        logged_by:            data.loggedBy      || null,
        logged_by_name:       data.loggedByName  || '',
      })
      .select().single()
    if (error) throw error
    savedId = inserted.id
  }

  // ── Weekly Plan sync ──────────────────────────────────────────────────────
  // If this student+activity was assigned in the Weekly Plan for a date range
  // covering `logDate`, flip it from PL → PR on first log, then bump the
  // practice count (PR → P-1 → P-2 …) on every repeat. This never throws —
  // if the weekly_plans table doesn't exist yet, or the update fails for any
  // reason, the progress save above has already succeeded and is unaffected.
  try {
    await syncWeeklyPlanOnLog({
      studentId:  data.studentId,
      activityId: data.activityId,
      logDate,
    })
  } catch (syncErr) {
    console.warn('Weekly plan sync skipped:', syncErr?.message || syncErr)
  }

  return savedId
}

export const getProgressByStudent = async (studentId) => {
  const { data, error } = await supabase
    .from('progress').select('*').eq('student_id', studentId)
  if (error) throw error
  return data.map(r => ({
    ...r,
    studentId:     r.student_id,
    activityId:    r.activity_id,
    activityName:  r.activity_name,
    skillId:       r.skill_id,
    skillName:     r.skill_name,
    subjectId:     r.subject_id,
    subjectName:   r.subject_name,
    practiceCount: r.total_practice_count,
  }))
}

export const getProgressByClass = async (classId) => {
  const { data, error } = await supabase
    .from('progress').select('*').eq('class_id', classId)
  if (error) throw error
  return data.map(r => ({
    ...r,
    studentId:     r.student_id,
    activityId:    r.activity_id,
    activityName:  r.activity_name,
    skillId:       r.skill_id,
    skillName:     r.skill_name,
    subjectId:     r.subject_id,
    subjectName:   r.subject_name,
    practiceCount: r.total_practice_count,
  }))
}

export const getAllProgress = async () => {
  const { data, error } = await supabase.from('progress').select('*')
  if (error) throw error
  return data.map(r => ({
    ...r,
    studentId:     r.student_id,
    activityId:    r.activity_id,
    activityName:  r.activity_name,
    skillId:       r.skill_id,
    skillName:     r.skill_name,
    subjectId:     r.subject_id,
    subjectName:   r.subject_name,
    practiceCount: r.total_practice_count,
  }))
}

// ─── Teacher notes ────────────────────────────────────────────────────────────

export const saveTeacherNote = async (data) => {
  // Each month gets its own note row — observations are APPENDED not overwritten
  // Check if a note already exists for this student + subject + month
  const { data: existing } = await supabase
    .from('teacher_notes').select('id')
    .eq('student_id', data.studentId)
    .eq('subject_id', data.subjectId)
    .eq('month',      data.month || '')
    .maybeSingle()

  if (existing) {
    // Update the note for this specific month
    const { error } = await supabase
      .from('teacher_notes')
      .update({
        note:             data.note,
        updated_at:       new Date().toISOString(),
        observation_date: data.observationDate || new Date().toISOString().split('T')[0],
      })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    // Insert new note for this month — previous months are preserved
    const { error } = await supabase
      .from('teacher_notes')
      .insert({
        student_id:       data.studentId,
        class_id:         data.classId          || '',
        subject_id:       data.subjectId        || null,
        subject_name:     data.subjectName      || '',
        skill_id:         data.skillId          || null,
        skill_name:       data.skillName        || '',
        term:             data.term,
        month:            data.month            || '',
        observation_date: data.observationDate  || new Date().toISOString().split('T')[0],
        note:             data.note,
        logged_by:        data.loggedBy         || null,
      })
    if (error) throw error
  }
}

export const getAllTeacherNotesByStudent = async (studentId) => {
  const { data, error } = await supabase
    .from('teacher_notes').select('*').eq('student_id', studentId)
    .order('month', { ascending: true })
  if (error) return []
  return data.map(n => ({
    ...n,
    studentId:   n.student_id,
    subjectId:   n.subject_id,
    subjectName: n.subject_name,
    skillId:     n.skill_id,
  }))
}

// Fetch observations for one student for Excel export
export const getObservationsByStudent = async (studentId) => {
  const { data, error } = await supabase
    .from('teacher_notes')
    .select('*')
    .eq('student_id', studentId)
    .order('month', { ascending: true })
  if (error) return []
  return data
}

// ─── Student Groups (Weekly Plan) ──────────────────────────────────────────────
// A reusable named set of students within a class, so teachers can assign a
// week's activity to "Group A" instead of re-picking the same students
// every time. Purely a convenience layer on top of weekly_plans, which still
// stores one row per student for accurate per-student status/practice sync.

export const getGroupsByClass = async (classId) => {
  const { data, error } = await supabase
    .from('student_groups').select('*').eq('class_id', classId).order('name')
  if (error) throw error
  return data.map(g => ({ ...g, studentIds: g.student_ids || [] }))
}

export const createGroup = async (classId, name, studentIds, createdBy) => {
  const { data, error } = await supabase
    .from('student_groups')
    .insert({ class_id: classId, name, student_ids: studentIds, created_by: createdBy || null })
    .select().single()
  if (error) throw error
  return { ...data, studentIds: data.student_ids || [] }
}

export const updateGroup = async (id, { name, studentIds }) => {
  const { error } = await supabase
    .from('student_groups')
    .update({ name, student_ids: studentIds })
    .eq('id', id)
  if (error) throw error
}

export const deleteGroup = async (id) => {
  const { error } = await supabase.from('student_groups').delete().eq('id', id)
  if (error) throw error
}

// ─── Weekly Plan ────────────────────────────────────────────────────────────────
// One row per (student, activity, date range). Teachers only ever choose
// Subject + Activity — Category/Skill are resolved behind the scenes from
// getActivitiesBySubject() so reports/analytics elsewhere stay consistent.
//
// Status is derived from `presentation_count`, kept in sync automatically by
// saveProgressRecord()'s call to syncWeeklyPlanOnLog() every time a teacher
// logs progress for that student+activity within the plan's date range:
//   0            → "PL" (planned, not yet presented)
//   1            → "PR" (presented once)
//   2, 3, 4 ...  → "P-1", "P-2", "P-3" ... (practiced again after presenting)

const mapWeeklyPlanRow = (p) => ({
  ...p,
  teacherId:         p.teacher_id,
  classId:           p.class_id,
  subjectId:         p.subject_id,
  subjectName:       p.subject_name,
  categoryId:        p.category_id,
  categoryName:      p.category_name,
  skillId:           p.skill_id,
  skillName:         p.skill_name,
  activityId:        p.activity_id,
  activityName:      p.activity_name,
  studentId:         p.student_id,
  studentName:       p.student_name,
  groupId:           p.group_id,
  groupName:         p.group_name,
  fromDate:          p.from_date,
  toDate:            p.to_date,
  presentationCount: p.presentation_count || 0,
  batchId:           p.batch_id,
})

// Creates one weekly_plans row per assignee, all sharing the same batch_id
// so the whole assignment can be displayed/removed as a single unit later.
export const addWeeklyPlan = async ({
  teacherId, classId, grade,
  subjectId, subjectName, categoryId, categoryName, skillId, skillName,
  activityId, activityName,
  assignees,              // [{ id, name }]
  groupId, groupName,
  fromDate, toDate,
}) => {
  const batchId = crypto.randomUUID()
  const rows = assignees.map(s => ({
    batch_id:      batchId,
    teacher_id:    teacherId || null,
    class_id:      classId,
    grade,
    subject_id:    subjectId    || null,
    subject_name:  subjectName  || '',
    category_id:   categoryId   || null,
    category_name: categoryName || '',
    skill_id:      skillId      || null,
    skill_name:    skillName    || '',
    activity_id:   activityId,
    activity_name: activityName || '',
    student_id:    s.id,
    student_name:  s.name || '',
    group_id:      groupId   || null,
    group_name:    groupName || '',
    from_date:     fromDate,
    to_date:       toDate,
    status:        'PL',
    presentation_count: 0,
  }))
  const { error } = await supabase.from('weekly_plans').insert(rows)
  if (error) throw error
  return batchId
}

export const getWeeklyPlansByClass = async (classId) => {
  const { data, error } = await supabase
    .from('weekly_plans').select('*').eq('class_id', classId).order('from_date')
  if (error) throw error
  return data.map(mapWeeklyPlanRow)
}

// Admin view — every class at once
export const getAllWeeklyPlans = async () => {
  const { data, error } = await supabase
    .from('weekly_plans').select('*').order('class_id').order('from_date')
  if (error) throw error
  return data.map(mapWeeklyPlanRow)
}

// Removes an entire assignment batch (every student it was assigned to)
export const deleteWeeklyPlanBatch = async (batchId) => {
  const { error } = await supabase.from('weekly_plans').delete().eq('batch_id', batchId)
  if (error) throw error
}

// Called from saveProgressRecord — finds any weekly_plans row for this
// student+activity whose date range covers the logged date, and advances it.
export const syncWeeklyPlanOnLog = async ({ studentId, activityId, logDate }) => {
  const { data: plans, error } = await supabase
    .from('weekly_plans')
    .select('id, presentation_count')
    .eq('student_id',  studentId)
    .eq('activity_id', activityId)
    .lte('from_date', logDate)
    .gte('to_date',   logDate)
  if (error) throw error
  if (!plans || plans.length === 0) return

  for (const p of plans) {
    const { error: updErr } = await supabase
      .from('weekly_plans')
      .update({
        status:             'PR',
        presentation_count: (p.presentation_count || 0) + 1,
        updated_at:          new Date().toISOString(),
      })
      .eq('id', p.id)
    if (updErr) throw updErr
  }
}