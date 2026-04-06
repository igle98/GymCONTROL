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
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { getUser } from './auth.js';

function sessionsRef() {
  return collection(db, 'users', getUser().uid, 'sessions');
}

export async function getSessions(limitCount = 50) {
  const q = query(sessionsRef(), orderBy('date', 'desc'), limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSession(id) {
  const snap = await getDoc(doc(sessionsRef(), id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// Get the last session that includes a specific exercise
export async function getLastSessionForExercise(exerciseId) {
  const q = query(sessionsRef(), orderBy('date', 'desc'), limit(20));
  const snapshot = await getDocs(q);

  for (const d of snapshot.docs) {
    const session = d.data();
    const exerciseSets = (session.sets || []).filter(
      (s) => s.exerciseId === exerciseId
    );
    if (exerciseSets.length > 0) {
      return {
        sessionId: d.id,
        date: session.date,
        sets: exerciseSets,
      };
    }
  }
  return null;
}

// Get progression data for an exercise (all sessions)
export async function getExerciseProgression(exerciseId, maxSessions = 100) {
  const q = query(sessionsRef(), orderBy('date', 'asc'), limit(maxSessions));
  const snapshot = await getDocs(q);

  const progression = [];
  for (const d of snapshot.docs) {
    const session = d.data();
    const exerciseSets = (session.sets || []).filter(
      (s) => s.exerciseId === exerciseId && s.type !== 'warmup'
    );
    if (exerciseSets.length > 0) {
      const maxWeight = Math.max(...exerciseSets.map((s) => s.weight));
      const totalVolume = exerciseSets.reduce(
        (sum, s) => sum + s.weight * s.reps,
        0
      );
      const bestSet = exerciseSets.reduce((best, s) =>
        s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)
          ? s
          : best
      );

      progression.push({
        date: session.date,
        maxWeight,
        totalVolume,
        bestSet,
        totalSets: exerciseSets.length,
        totalReps: exerciseSets.reduce((sum, s) => sum + s.reps, 0),
      });
    }
  }
  return progression;
}

export async function saveSession(sessionData) {
  return addDoc(sessionsRef(), {
    date: sessionData.date || Timestamp.now(),
    routineId: sessionData.routineId || null,
    dayName: sessionData.dayName || '',
    sets: sessionData.sets || [],
    notes: sessionData.notes || '',
    duration: sessionData.duration || null,
    createdAt: Timestamp.now(),
  });
}

export async function updateSession(id, data) {
  return updateDoc(doc(sessionsRef(), id), data);
}

export async function deleteSession(id) {
  return deleteDoc(doc(sessionsRef(), id));
}

// Get sessions filtered by date range
export async function getSessionsByDateRange(startDate, endDate) {
  const q = query(
    sessionsRef(),
    where('date', '>=', Timestamp.fromDate(new Date(startDate))),
    where('date', '<=', Timestamp.fromDate(new Date(endDate))),
    orderBy('date', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
