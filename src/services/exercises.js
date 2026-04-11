import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { getUser } from './auth.js';

function exercisesRef() {
  return collection(db, 'users', getUser().uid, 'exercises');
}

export async function getExercises(onlyActive = true) {
  // Fetch ordered by name only, then filter client-side to avoid needing a
  // composite Firestore index on (isActive, name).
  const q = query(exercisesRef(), orderBy('name'));
  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  return onlyActive ? all.filter((e) => e.isActive !== false) : all;
}

export async function getExercisesByGroup(muscleGroup) {
  // Same rationale as getExercises: filter client-side to skip composite index.
  const all = await getExercises(true);
  return all.filter((e) => e.muscleGroup === muscleGroup);
}

export async function addExercise(exercise) {
  return addDoc(exercisesRef(), {
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    notes: exercise.notes || '',
    isActive: true,
    createdAt: Timestamp.now(),
  });
}

export async function updateExercise(id, data) {
  return updateDoc(doc(exercisesRef(), id), data);
}

export async function archiveExercise(id) {
  return updateDoc(doc(exercisesRef(), id), { isActive: false });
}

export async function restoreExercise(id) {
  return updateDoc(doc(exercisesRef(), id), { isActive: true });
}

export async function deleteExercise(id) {
  return deleteDoc(doc(exercisesRef(), id));
}
