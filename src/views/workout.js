import { getRoutine } from '../services/routines.js';
import { getExercises } from '../services/exercises.js';
import { getLastSessionForExercise, saveSession } from '../services/sessions.js';
import { getWeightSuggestion } from '../utils/suggestions.js';
import { calculateWarmup, estimate1RM } from '../utils/calculations.js';
import { formatWeight, formatDate, formatDuration } from '../utils/formatters.js';
import { showRestTimer } from '../components/rest-timer.js';
import { navigate } from '../components/router.js';
import { DEFAULT_REST_TIME, MUSCLE_GROUPS } from '../utils/constants.js';
import { Timestamp } from 'firebase/firestore';

let sessionTimer = null;

// In-memory active session so the user can leave the workout (e.g. tap another
// tab) and resume it from "Entrenar" without losing entered sets. Cleared when
// the session is saved or explicitly discarded.
let activeSession = null;

// Rendering context for the current workout, used by re-render triggers
// (add set, swap exercise) so they don't need to re-fetch everything.
let ctx = null;

export function getActiveSession() {
  return activeSession;
}

function clearActiveSession() {
  activeSession = null;
}

// Build the initial set rows for an exercise from its previous session data.
function buildSetsForExercise(prev, suggestion) {
  const numSets = prev ? prev.sets.filter((s) => s.type !== 'warmup').length : 3;
  return Array.from({ length: numSets }, (_, i) => ({
    setNumber: i + 1,
    weight:
      suggestion?.weight ||
      (prev ? prev.sets.find((s) => s.type !== 'warmup')?.weight : '') ||
      '',
    reps: '',
    type: 'working',
    completed: false,
  }));
}

async function loadExerciseData(exId) {
  const prev = await getLastSessionForExercise(exId);
  return { prev, suggestion: prev ? getWeightSuggestion(prev.sets) : null };
}

export async function renderWorkout(container) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  let routineId = params.get('routine');
  let dayIndex = parseInt(params.get('day'), 10);

  // Tapping the "Entrenar" tab lands here without params. Resume the active
  // session if there is one; otherwise send the user to the day picker.
  if (!routineId || isNaN(dayIndex)) {
    if (activeSession) {
      routineId = activeSession.routineId;
      dayIndex = activeSession.dayIndex;
    } else {
      navigate('/');
      return;
    }
  }

  container.innerHTML = '<div class="spinner"></div>';

  const routine = await getRoutine(routineId);
  if (!routine || !routine.days[dayIndex]) {
    container.innerHTML = '<p class="text-warning">Rutina no encontrada</p>';
    return;
  }

  const day = routine.days[dayIndex];
  const allExercises = await getExercises(false);
  const exerciseMap = Object.fromEntries(allExercises.map((e) => [e.id, e]));

  const resuming =
    activeSession &&
    activeSession.routineId === routineId &&
    activeSession.dayIndex === dayIndex;

  // Switching to a different day while a session is in progress would discard it.
  if (activeSession && !resuming) {
    if (!confirm('Tienes un entreno en curso. ¿Descartarlo y empezar este día?')) {
      navigate('/workout?routine=' + activeSession.routineId + '&day=' + activeSession.dayIndex);
      return;
    }
    clearActiveSession();
  }

  const previousData = {};
  const suggestions = {};

  if (!resuming) {
    // Fresh session: load previous data and seed sets for each exercise.
    const sessionState = {
      routineId,
      dayIndex,
      dayName: day.dayName,
      order: [...(day.exercises || [])],
      exercises: {},
    };

    for (const exId of sessionState.order) {
      const { prev, suggestion } = await loadExerciseData(exId);
      if (prev) {
        previousData[exId] = prev;
        suggestions[exId] = suggestion;
      }
      sessionState.exercises[exId] = { sets: buildSetsForExercise(prev, suggestion) };
    }

    activeSession = sessionState;
    activeSession.startTime = Date.now();
  } else {
    // Resuming: reload previous-session data for display only; keep entered sets.
    for (const exId of activeSession.order) {
      const { prev, suggestion } = await loadExerciseData(exId);
      if (prev) {
        previousData[exId] = prev;
        suggestions[exId] = suggestion;
      }
    }
  }

  ctx = { container, day, exerciseMap, previousData, suggestions, allExercises };
  renderWorkoutUI();
}

function rerender() {
  clearInterval(sessionTimer);
  renderWorkoutUI();
}

function renderWorkoutUI() {
  const { container, exerciseMap, previousData, suggestions } = ctx;
  const sessionState = activeSession;

  let html = `
    <div class="workout-header">
      <div>
        <h1>${sessionState.dayName}</h1>
        <p class="text-muted" style="font-size:0.85rem">${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>
      <button class="btn btn-ghost" id="btn-back">✕</button>
    </div>
    <div class="workout-timer-bar">
      <span>Duración</span>
      <span id="session-elapsed">0:00</span>
    </div>
  `;

  for (const exId of sessionState.order) {
    const ex = exerciseMap[exId];
    if (!ex) continue;

    const prev = previousData[exId];
    const suggestion = suggestions[exId];
    const warmup = sessionState.exercises[exId].sets[0]?.weight
      ? calculateWarmup(sessionState.exercises[exId].sets[0].weight)
      : [];

    html += `
      <div class="exercise-block" data-exercise-id="${exId}">
        <div class="exercise-block-header">
          <h3>${ex.name}</h3>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="badge badge-muted">${ex.muscleGroup}</span>
            <button class="btn-ghost btn-sm swap-exercise-btn" data-exercise-id="${exId}" title="Cambiar ejercicio">⇄</button>
          </div>
        </div>
    `;

    if (prev) {
      const prevSetsText = prev.sets
        .filter((s) => s.type !== 'warmup')
        .map((s) => `${s.weight}kg×${s.reps}`)
        .join(' | ');
      html += `
        <div class="previous-data">
          Última sesión (${formatDate(prev.date.toDate ? prev.date.toDate() : prev.date)}): ${prevSetsText}
          ${suggestion ? `<br><span class="suggestion-text trend-${suggestion.trend || 'hold'}">${suggestion.message}</span>` : ''}
        </div>
      `;
    }

    if (warmup.length > 0) {
      html += `<p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px">Calentamiento sugerido</p>`;
      warmup.forEach((w) => {
        html += `
          <div class="set-row warmup">
            <span class="set-number">W</span>
            <input type="number" class="input input-number" value="${w.weight}" disabled>
            <input type="number" class="input input-number" value="${w.reps}" disabled>
            <span class="text-muted" style="text-align:center;font-size:0.7rem">${w.percentage}%</span>
          </div>
        `;
      });
      html += `<div style="margin-top:12px"></div>`;
    }

    // Set header
    html += `
      <div class="set-row" style="margin-bottom:4px">
        <span class="set-number">#</span>
        <span style="font-size:0.75rem;color:var(--text-muted);text-align:center">Peso (kg)</span>
        <span style="font-size:0.75rem;color:var(--text-muted);text-align:center">Reps</span>
        <span></span>
      </div>
    `;

    sessionState.exercises[exId].sets.forEach((set, i) => {
      html += `
        <div class="set-row" data-exercise-id="${exId}" data-set-index="${i}">
          <span class="set-number">${set.setNumber}</span>
          <input type="number" class="input input-number set-weight"
                 value="${set.weight}" placeholder="kg" inputmode="decimal" step="0.5">
          <input type="number" class="input input-number set-reps"
                 value="${set.reps}" placeholder="reps" inputmode="numeric">
          <button class="set-check" data-exercise-id="${exId}" data-set-index="${i}">✓</button>
        </div>
      `;
    });

    html += `
        <button class="btn btn-ghost btn-sm add-set-btn" data-exercise-id="${exId}" style="margin-top:4px">+ Serie</button>
      </div>
    `;
  }

  html += `
    <div class="mt-24">
      <div class="input-group">
        <label>Notas de la sesión</label>
        <textarea class="textarea" id="session-notes" placeholder="Notas opcionales..."></textarea>
      </div>
      <button class="btn btn-primary btn-block" id="btn-save-session">Guardar sesión</button>
    </div>
    <div id="workout-modal-container"></div>
  `;

  container.innerHTML = html;

  // Session timer (anchored to the session start so it survives re-renders)
  const updateElapsed = () => {
    const el = container.querySelector('#session-elapsed');
    if (el) el.textContent = formatDuration(Math.floor((Date.now() - sessionState.startTime) / 1000));
  };
  updateElapsed();
  sessionTimer = setInterval(updateElapsed, 1000);

  // Event: back button (discards the active session)
  container.querySelector('#btn-back').addEventListener('click', () => {
    if (confirm('¿Salir sin guardar? Se perderá el entreno en curso.')) {
      clearInterval(sessionTimer);
      clearActiveSession();
      navigate('/');
    }
  });

  // Event: check buttons (complete set + trigger rest timer)
  container.querySelectorAll('.set-check').forEach((btn) => {
    btn.addEventListener('click', () => {
      const exId = btn.dataset.exerciseId;
      const setIdx = parseInt(btn.dataset.setIndex, 10);
      const row = btn.closest('.set-row');
      const weight = parseFloat(row.querySelector('.set-weight').value);
      const reps = parseInt(row.querySelector('.set-reps').value, 10);

      if (!weight || !reps) {
        row.classList.add('shake');
        setTimeout(() => row.classList.remove('shake'), 300);
        return;
      }

      sessionState.exercises[exId].sets[setIdx].weight = weight;
      sessionState.exercises[exId].sets[setIdx].reps = reps;
      sessionState.exercises[exId].sets[setIdx].completed = true;

      btn.classList.add('checked');
      row.classList.add('completed');

      // Show rest timer
      showRestTimer(DEFAULT_REST_TIME);
    });
  });

  // Event: weight/reps input changes
  container.querySelectorAll('.set-weight, .set-reps').forEach((input) => {
    input.addEventListener('change', () => {
      const row = input.closest('.set-row');
      const exId = row.dataset.exerciseId;
      const setIdx = parseInt(row.dataset.setIndex, 10);
      if (exId && !isNaN(setIdx)) {
        if (input.classList.contains('set-weight')) {
          sessionState.exercises[exId].sets[setIdx].weight = parseFloat(input.value) || 0;
        } else {
          sessionState.exercises[exId].sets[setIdx].reps = parseInt(input.value, 10) || 0;
        }
      }
    });
  });

  // Event: add set
  container.querySelectorAll('.add-set-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const exId = btn.dataset.exerciseId;
      const sets = sessionState.exercises[exId].sets;
      const lastSet = sets[sets.length - 1];
      sets.push({
        setNumber: sets.length + 1,
        weight: lastSet?.weight || '',
        reps: '',
        type: 'working',
        completed: false,
      });
      const currentNotes = container.querySelector('#session-notes')?.value || '';
      sessionState.notes = currentNotes;
      rerender();
    });
  });

  // Event: swap exercise (machine occupied → substitute, this session only)
  container.querySelectorAll('.swap-exercise-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      sessionState.notes = container.querySelector('#session-notes')?.value || '';
      showSwapModal(btn.dataset.exerciseId);
    });
  });

  // Restore notes after a re-render
  if (sessionState.notes) {
    const notesField = container.querySelector('#session-notes');
    if (notesField) notesField.value = sessionState.notes;
  }

  // Event: save session
  container.querySelector('#btn-save-session').addEventListener('click', async () => {
    clearInterval(sessionTimer);
    const duration = Math.floor((Date.now() - sessionState.startTime) / 1000);
    const notes = container.querySelector('#session-notes')?.value || '';

    const allSets = [];
    for (const [exId, exData] of Object.entries(sessionState.exercises)) {
      for (const set of exData.sets) {
        if (set.completed && set.weight && set.reps) {
          allSets.push({
            exerciseId: exId,
            setNumber: set.setNumber,
            weight: set.weight,
            reps: set.reps,
            type: set.type,
          });
        }
      }
    }

    if (allSets.length === 0) {
      alert('No hay series completadas para guardar.');
      return;
    }

    try {
      const btn = container.querySelector('#btn-save-session');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      await saveSession({
        date: Timestamp.now(),
        routineId: sessionState.routineId,
        dayName: sessionState.dayName,
        sets: allSets,
        notes,
        duration,
      });

      clearActiveSession();
      navigate('/');
    } catch (err) {
      alert('Error al guardar: ' + err.message);
      const b = container.querySelector('#btn-save-session');
      if (b) { b.disabled = false; b.textContent = 'Guardar sesión'; }
    }
  });

  return {
    destroy() {
      clearInterval(sessionTimer);
    },
  };
}

// Modal to substitute an exercise for another, just for the current session.
// Defaults the filter to the same muscle group so the swap is quick.
function showSwapModal(oldId) {
  const { container, exerciseMap, allExercises } = ctx;
  const sessionState = activeSession;
  const oldEx = exerciseMap[oldId];
  const modalContainer = container.querySelector('#workout-modal-container');
  let groupFilter = oldEx?.muscleGroup || '';

  function candidates() {
    return allExercises
      .filter((e) => e.isActive !== false)
      .filter((e) => e.id === oldId || !sessionState.order.includes(e.id))
      .filter((e) => e.id !== oldId)
      .filter((e) => !groupFilter || e.muscleGroup === groupFilter);
  }

  function render() {
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="swap-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>Cambiar ejercicio</h2>
            <button class="btn-ghost" id="swap-close">✕</button>
          </div>
          <p class="text-muted" style="font-size:0.85rem;margin-bottom:12px">
            Sustituye <strong>${oldEx?.name || ''}</strong> solo para este entreno. La rutina no cambia.
          </p>
          <div class="input-group">
            <label>Grupo muscular</label>
            <select class="select" id="swap-group">
              <option value="">Todos los grupos</option>
              ${MUSCLE_GROUPS.map(
                (g) => `<option value="${g}" ${groupFilter === g ? 'selected' : ''}>${g}</option>`
              ).join('')}
            </select>
          </div>
          <div class="input-group">
            <label>Ejercicio</label>
            <select class="select" id="swap-exercise">
              <option value="">Selecciona...</option>
              ${candidates()
                .map((e) => `<option value="${e.id}">${e.name} (${e.muscleGroup})</option>`)
                .join('')}
            </select>
          </div>
          <button class="btn btn-primary btn-block mt-8" id="swap-confirm" disabled>Sustituir</button>
        </div>
      </div>
    `;

    const close = () => (modalContainer.innerHTML = '');
    modalContainer.querySelector('#swap-close').addEventListener('click', close);
    modalContainer.querySelector('.modal-backdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) close();
    });

    modalContainer.querySelector('#swap-group').addEventListener('change', (e) => {
      groupFilter = e.target.value;
      render();
    });

    const exSelect = modalContainer.querySelector('#swap-exercise');
    const confirmBtn = modalContainer.querySelector('#swap-confirm');
    exSelect.addEventListener('change', () => {
      confirmBtn.disabled = !exSelect.value;
    });

    confirmBtn.addEventListener('click', async () => {
      const newId = exSelect.value;
      if (!newId) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Cambiando...';

      // Load suggestion/previous data for the replacement and seed its sets.
      const { prev, suggestion } = await loadExerciseData(newId);
      if (prev) {
        ctx.previousData[newId] = prev;
        ctx.suggestions[newId] = suggestion;
      }

      const idx = sessionState.order.indexOf(oldId);
      if (idx !== -1) sessionState.order[idx] = newId;
      delete sessionState.exercises[oldId];
      sessionState.exercises[newId] = { sets: buildSetsForExercise(prev, suggestion) };

      sessionState.notes = container.querySelector('#session-notes')?.value || sessionState.notes || '';
      close();
      rerender();
    });
  }

  render();
}
