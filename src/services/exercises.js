import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { getUser } from './auth.js';

function exercisesRef() {
  return collection(db, 'users', getUser().uid, 'exercises');
}

export async function getExercises(onlyActive = true) {
  let q;
  if (onlyActive) {
    q = query(exercisesRef(), where('isActive', '==', true), orderBy('name'));
  } else {
    q = query(exercisesRef(), orderBy('name'));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getExercisesByGroup(muscleGroup) {
  const q = query(
    exercisesRef(),
    where('isActive', '==', true),
    where('muscleGroup', '==', muscleGroup),
    orderBy('name')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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
