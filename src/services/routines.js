import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { getUser } from './auth.js';

function routinesRef() {
  return collection(db, 'users', getUser().uid, 'routines');
}

export async function getRoutines() {
  const q = query(routinesRef(), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getActiveRoutine() {
  const q = query(routinesRef(), where('isActive', '==', true));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getRoutine(id) {
  const snap = await getDoc(doc(routinesRef(), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function addRoutine(routine) {
  // Deactivate any currently active routine
  if (routine.isActive) {
    await deactivateAllRoutines();
  }
  return addDoc(routinesRef(), {
    name: routine.name,
    days: routine.days || [],
    isActive: routine.isActive || false,
    createdAt: Timestamp.now(),
  });
}

export async function updateRoutine(id, data) {
  if (data.isActive) {
    await deactivateAllRoutines();
  }
  return updateDoc(doc(routinesRef(), id), data);
}

export async function activateRoutine(id) {
  await deactivateAllRoutines();
  return updateDoc(doc(routinesRef(), id), { isActive: true });
}

export async function deleteRoutine(id) {
  return deleteDoc(doc(routinesRef(), id));
}

async function deactivateAllRoutines() {
  const q = query(routinesRef(), where('isActive', '==', true));
  const snapshot = await getDocs(q);
  const updates = snapshot.docs.map((d) => updateDoc(d.ref, { isActive: false }));
  await Promise.all(updates);
}
