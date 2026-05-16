import {
  collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { db, auth } from './config'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)

export const logoutUser = () => signOut(auth)

export const resetPassword = (email) => sendPasswordResetEmail(auth, email)

// Create a new user account (admin use only)
// Uses a secondary Firebase app so admin session is never interrupted
export const createUser = async (email, password, profileData) => {
  const { initializeApp, getApps, deleteApp } = await import('firebase/app')
  const { getAuth, createUserWithEmailAndPassword: createUser2 } = await import('firebase/auth')

  // Get the main app config
  const mainApp = getApps()[0]
  const config  = mainApp.options

  // Create a temporary secondary app instance
  const secondaryApp  = initializeApp(config, 'temp_admin_create_' + Date.now())
  const secondaryAuth = getAuth(secondaryApp)

  try {
    const cred = await createUser2(secondaryAuth, email, password)
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email,
      ...profileData,
      createdAt: serverTimestamp(),
    })
    return cred.user
  } finally {
    // Always clean up the secondary app — admin session untouched
    await deleteApp(secondaryApp)
  }
}

// ─── Users / Profiles ─────────────────────────────────────────────────────────

export const getUserProfile = async (uid) => {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const getAllTeachers = async () => {
  const q = query(collection(db, 'users'), where('role', '==', 'teacher'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const updateUserProfile = async (uid, data) => {
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() })
}

export const deleteUserProfile = async (uid) => {
  await deleteDoc(doc(db, 'users', uid))
}

// ─── Classes ──────────────────────────────────────────────────────────────────

export const getClasses = async () => {
  const snap = await getDocs(collection(db, 'classes'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ─── Students ────────────────────────────────────────────────────────────────

export const getStudentsByClass = async (classId) => {
  const q = query(
    collection(db, 'students'),
    where('classId', '==', classId),
    where('status', '==', 'active')
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const getAllStudents = async () => {
  const q = query(collection(db, 'students'), where('status', '==', 'active'))
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const getStudent = async (studentId) => {
  const snap = await getDoc(doc(db, 'students', studentId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const addStudent = async (data) => {
  const ref = await addDoc(collection(db, 'students'), {
    ...data,
    status: 'active',
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export const updateStudent = async (id, data) => {
  await updateDoc(doc(db, 'students', id), { ...data, updatedAt: serverTimestamp() })
}

export const deleteStudent = async (id) => {
  await updateDoc(doc(db, 'students', id), { status: 'alumni', updatedAt: serverTimestamp() })
}

// Bulk import from Excel
export const bulkAddStudents = async (students) => {
  const batch = writeBatch(db)
  students.forEach(s => {
    const ref = doc(collection(db, 'students'))
    batch.set(ref, { ...s, status: 'active', createdAt: serverTimestamp() })
  })
  await batch.commit()
}

// ─── Curriculum ───────────────────────────────────────────────────────────────

export const getCurriculumByGrade = async (grade) => {
  // No orderBy to avoid composite index requirement — sort client-side by order field
  const q = query(collection(db, 'areas'), where('grade', '==', grade))
  const areasSnap = await getDocs(q)
  const areas = []
  for (const areaDoc of areasSnap.docs) {
    const areaData = { id: areaDoc.id, ...areaDoc.data(), subAreas: [] }
    const subSnap = await getDocs(collection(db, 'areas', areaDoc.id, 'subAreas'))
    for (const subDoc of subSnap.docs) {
      const subData = { id: subDoc.id, ...subDoc.data(), skills: [] }
      const skillSnap = await getDocs(collection(db, 'areas', areaDoc.id, 'subAreas', subDoc.id, 'skills'))
      subData.skills = skillSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      areaData.subAreas.push(subData)
    }
    areaData.subAreas.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    areas.push(areaData)
  }
  areas.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return areas
}

export const addArea = async (grade, name) => {
  const existing = await getCurriculumByGrade(grade)
  const ref = await addDoc(collection(db, 'areas'), {
    grade, name, order: existing.length, createdAt: serverTimestamp(),
  })
  return ref.id
}

export const updateArea = async (areaId, data) => {
  await updateDoc(doc(db, 'areas', areaId), data)
}

export const deleteArea = async (areaId) => {
  await deleteDoc(doc(db, 'areas', areaId))
}

export const addSubArea = async (areaId, name) => {
  const q = query(collection(db, 'areas', areaId, 'subAreas'))
  const snap = await getDocs(q)
  const ref = await addDoc(collection(db, 'areas', areaId, 'subAreas'), {
    name, order: snap.size, createdAt: serverTimestamp(),
  })
  return ref.id
}

export const updateSubArea = async (areaId, subAreaId, data) => {
  await updateDoc(doc(db, 'areas', areaId, 'subAreas', subAreaId), data)
}

export const deleteSubArea = async (areaId, subAreaId) => {
  await deleteDoc(doc(db, 'areas', areaId, 'subAreas', subAreaId))
}

export const addSkill = async (areaId, subAreaId, name) => {
  const q = query(collection(db, 'areas', areaId, 'subAreas', subAreaId, 'skills'))
  const snap = await getDocs(q)
  const ref = await addDoc(
    collection(db, 'areas', areaId, 'subAreas', subAreaId, 'skills'),
    { name, order: snap.size, createdAt: serverTimestamp() }
  )
  return ref.id
}

export const updateSkill = async (areaId, subAreaId, skillId, data) => {
  await updateDoc(
    doc(db, 'areas', areaId, 'subAreas', subAreaId, 'skills', skillId), data
  )
}

export const deleteSkill = async (areaId, subAreaId, skillId) => {
  await deleteDoc(doc(db, 'areas', areaId, 'subAreas', subAreaId, 'skills', skillId))
}

// ─── Progress Records ─────────────────────────────────────────────────────────

export const saveProgressRecord = async (data) => {
  // Safe deterministic doc ID — no composite index needed
  const raw   = data.studentId + '_' + data.skillId + '_' + data.term
  const docId = raw.replace(/[^a-zA-Z0-9_-]/g, '-')
  const docRef = doc(db, 'progress', docId)
  await setDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return docId
}

export const getProgressByStudent = async (studentId) => {
  const q = query(collection(db, 'progress'), where('studentId', '==', studentId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getProgressByClass = async (classId) => {
  const q = query(collection(db, 'progress'), where('classId', '==', classId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getProgressByTeacher = async (teacherId) => {
  const q = query(
    collection(db, 'progress'),
    where('loggedBy', '==', teacherId),
    orderBy('updatedAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getAllProgress = async () => {
  const snap = await getDocs(collection(db, 'progress'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getTeacherNotes = async (studentId, areaId, term) => {
  const q = query(
    collection(db, 'teacherNotes'),
    where('studentId', '==', studentId),
    where('areaId',    '==', areaId),
    where('term',      '==', term)
  )
  const snap = await getDocs(q)
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }
}

export const saveTeacherNote = async (data) => {
  const existing = await getTeacherNotes(data.studentId, data.areaId, data.term)
  if (existing) {
    await updateDoc(doc(db, 'teacherNotes', existing.id), {
      note: data.note, updatedAt: serverTimestamp(),
    })
  } else {
    await addDoc(collection(db, 'teacherNotes'), {
      ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    })
  }
}

export const getAllTeacherNotesByStudent = async (studentId) => {
  const q = query(collection(db, 'teacherNotes'), where('studentId', '==', studentId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}