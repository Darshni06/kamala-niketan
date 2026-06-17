// src/supabase/services.js
// Complete replacement for src/firebase/services.js
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

// Create teacher account (admin use only)
// Uses Supabase admin API via service role — but since we only have anon key,
// we use signUp then immediately sign back in as admin
export const createUser = async (email, password, profileData) => {
  // Save current admin session
  const { data: { session: adminSession } } = await supabase.auth.getSession()

  // Sign up new user
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  const newUid = data.user?.id
  if (!newUid) throw new Error('User creation failed')

  // Insert profile into users table
  const { error: profileError } = await supabase
    .from('users')
    .insert({
      id:         newUid,
      email,
      name:       profileData.name       || '',
      role:       profileData.role       || 'teacher',
      class_id:   profileData.classId    || '',
      class_name: profileData.className  || '',
    })
  if (profileError) throw profileError

  // Restore admin session
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
    .from('users')
    .select('*')
    .eq('id', uid)
    .single()
  if (error) return null
  // Map snake_case to camelCase
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
    .from('users')
    .select('*')
    .eq('role', 'teacher')
    .order('name')
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

export const deleteUserProfile = async (uid) => {
  const { error } = await supabase.from('users').delete().eq('id', uid)
  if (error) throw error
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
    .from('students')
    .select('*')
    .eq('status', 'active')
    .order('name')
  if (error) throw error
  return data.map(s => ({ ...s, classId: s.class_id }))
}

export const getStudentsByClass = async (classId) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', classId)
    .eq('status', 'active')
    .order('name')
  if (error) throw error
  return data.map(s => ({ ...s, classId: s.class_id }))
}

export const getStudent = async (studentId) => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single()
  if (error) return null
  return { ...data, classId: data.class_id }
}

export const addStudent = async (studentData) => {
  const { data, error } = await supabase
    .from('students')
    .insert({
      name:     studentData.name,
      dob:      studentData.dob      || null,
      grade:    studentData.grade,
      class_id: studentData.classId  || studentData.class_id,
      status:   'active',
    })
    .select()
    .single()
  if (error) throw error
  return data.id
}

export const updateStudent = async (id, studentData) => {
  const { error } = await supabase
    .from('students')
    .update({
      name:     studentData.name,
      dob:      studentData.dob      || null,
      grade:    studentData.grade,
      class_id: studentData.classId  || studentData.class_id,
    })
    .eq('id', id)
  if (error) throw error
}

export const deleteStudent = async (id) => {
  const { error } = await supabase
    .from('students')
    .update({ status: 'alumni' })
    .eq('id', id)
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
    .from('subjects')
    .select('*')
    .eq('grade', grade)
    .order('order')
  if (error) throw error
  return data
}

export const getCategoriesBySubject = async (subjectId) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('subject_id', subjectId)
    .order('order')
  if (error) throw error
  return data.map(c => ({ ...c, subjectId: c.subject_id }))
}

export const getSkillsByCategory = async (categoryId) => {
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .eq('category_id', categoryId)
    .order('order')
  if (error) throw error
  return data.map(s => ({ ...s, categoryId: s.category_id }))
}

export const getActivitiesBySkill = async (skillId) => {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('skill_id', skillId)
    .order('order')
  if (error) throw error
  return data.map(a => ({ ...a, skillId: a.skill_id }))
}

// Full curriculum tree for a grade
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

// Curriculum CRUD
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
  // Cascade handled by DB foreign keys
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

// ─── Progress Records ─────────────────────────────────────────────────────────
// Level overwrites, practice count accumulates, dates append

export const saveProgressRecord = async (data) => {
  const today = new Date().toISOString().split('T')[0]

  // Check if record exists for this student + activity + term
  const { data: existing } = await supabase
    .from('progress')
    .select('id, total_practice_count, dates')
    .eq('student_id',  data.studentId)
    .eq('activity_id', data.activityId)
    .eq('term',        data.term)
    .single()

  if (existing) {
    // UPDATE — level overwrites, count accumulates, date appends
    const newCount = (existing.total_practice_count || 0) + (data.practiceCount || 0)
    const existingDates = existing.dates || []
    const newDates = existingDates.includes(today) ? existingDates : [...existingDates, today]

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
    return existing.id
  } else {
    // INSERT — first time this activity is logged for this student+term
    const { data: inserted, error } = await supabase
      .from('progress')
      .insert({
        student_id:           data.studentId,
        student_name:         data.studentName     || '',
        class_id:             data.classId         || '',
        grade:                data.grade           || '',
        term:                 data.term,
        subject_id:           data.subjectId       || null,
        subject_name:         data.subjectName     || '',
        category_id:          data.categoryId      || null,
        category_name:        data.categoryName    || '',
        skill_id:             data.skillId         || null,
        skill_name:           data.skillName       || '',
        activity_id:          data.activityId      || null,
        activity_name:        data.activityName    || '',
        level:                data.level,
        total_practice_count: data.practiceCount   || 0,
        dates:                [today],
        logged_by:            data.loggedBy        || null,
        logged_by_name:       data.loggedByName    || '',
      })
      .select()
      .single()
    if (error) throw error
    return inserted.id
  }
}

export const getProgressByStudent = async (studentId) => {
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('student_id', studentId)
  if (error) throw error
  return data.map(r => ({
    ...r,
    studentId:    r.student_id,
    activityId:   r.activity_id,
    activityName: r.activity_name,
    skillId:      r.skill_id,
    skillName:    r.skill_name,
    subjectId:    r.subject_id,
    subjectName:  r.subject_name,
    practiceCount: r.total_practice_count,
  }))
}

export const getProgressByClass = async (classId) => {
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('class_id', classId)
  if (error) throw error
  return data.map(r => ({
    ...r,
    studentId:    r.student_id,
    activityId:   r.activity_id,
    activityName: r.activity_name,
    skillId:      r.skill_id,
    skillName:    r.skill_name,
    subjectId:    r.subject_id,
    subjectName:  r.subject_name,
    practiceCount: r.total_practice_count,
  }))
}

export const getAllProgress = async () => {
  const { data, error } = await supabase.from('progress').select('*')
  if (error) throw error
  return data.map(r => ({
    ...r,
    studentId:    r.student_id,
    activityId:   r.activity_id,
    activityName: r.activity_name,
    skillId:      r.skill_id,
    skillName:    r.skill_name,
    subjectId:    r.subject_id,
    subjectName:  r.subject_name,
    practiceCount: r.total_practice_count,
  }))
}

// ─── Teacher notes ────────────────────────────────────────────────────────────

export const saveTeacherNote = async (data) => {
  // Check if note exists for this student+subject+term
  const { data: existing } = await supabase
    .from('teacher_notes')
    .select('id')
    .eq('student_id', data.studentId)
    .eq('subject_id', data.subjectId)
    .eq('term',       data.term)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('teacher_notes')
      .update({ note: data.note, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('teacher_notes')
      .insert({
        student_id:   data.studentId,
        class_id:     data.classId    || '',
        subject_id:   data.subjectId  || null,
        subject_name: data.subjectName|| '',
        skill_id:     data.skillId    || null,
        skill_name:   data.skillName  || '',
        term:         data.term,
        note:         data.note,
        logged_by:    data.loggedBy   || null,
      })
    if (error) throw error
  }
}

export const getAllTeacherNotesByStudent = async (studentId) => {
  const { data, error } = await supabase
    .from('teacher_notes')
    .select('*')
    .eq('student_id', studentId)
  if (error) return []
  return data.map(n => ({
    ...n,
    studentId:   n.student_id,
    subjectId:   n.subject_id,
    subjectName: n.subject_name,
    skillId:     n.skill_id,
  }))
}
