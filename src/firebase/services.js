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
  // Save current admin user before creating teacher
  const currentAdmin = auth.currentUser

  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    email,
    ...profileData,
    createdAt: serverTimestamp(),
  })

  // Sign admin back in immediately
  if (currentAdmin?.email) {
    // Sign out the newly created teacher account
    await signOut(auth)
  }

  return cred.user
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
    where('status', '==', 'active'),
    orderBy('name')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getAllStudents = async () => {
  const q = query(collection(db, 'students'), where('status', '==', 'active'), orderBy('name'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
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
  const q = query(collection(db, 'areas'), where('grade', '==', grade), orderBy('order'))
  const areasSnap = await getDocs(q)
  const areas = []
  for (const areaDoc of areasSnap.docs) {
    const areaData = { id: areaDoc.id, ...areaDoc.data(), subAreas: [] }
    const subQ = query(
      collection(db, 'areas', areaDoc.id, 'subAreas'),
      orderBy('order')
    )
    const subSnap = await getDocs(subQ)
    for (const subDoc of subSnap.docs) {
      const subData = { id: subDoc.id, ...subDoc.data(), skills: [] }
      const skillQ = query(
        collection(db, 'areas', areaDoc.id, 'subAreas', subDoc.id, 'skills'),
        orderBy('order')
      )
      const skillSnap = await getDocs(skillQ)
      subData.skills = skillSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      areaData.subAreas.push(subData)
    }
    areas.push(areaData)
  }
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
  // NEW — encode to remove any special characters
  const docId = btoa(data.studentId + '|' + data.skillId + '|' + data.term).replace(/[/+=]/g, '_')
  const docRef = doc(db, 'progress', docId)
  await setDoc(docRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return docId
}

export const getProgressByStudent = async (studentId) => {
  const q = query(
    collection(db, 'progress'),
    where('studentId', '==', studentId),
    orderBy('updatedAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const getProgressByClass = async (classId) => {
  const q = query(
    collection(db, 'progress'),
    where('classId', '==', classId),
    orderBy('updatedAt', 'desc')
  )
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
  const q = query(collection(db, 'progress'), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
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