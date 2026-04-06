import { getRoutine } from '../services/routines.js';
import { getExercises } from '../services/exercises.js';
import { getLastSessionForExercise, saveSession } from '../services/sessions.js';
import { getWeightSuggestion } from '../utils/suggestions.js';
import { calculateWarmup, estimate1RM } from '../utils/calculations.js';
import { formatWeight, formatDate, formatDuration } from '../utils/formatters.js';
import { showRestTimer } from '../components/rest-timer.js';
import { navigate } from '../components/router.js';
import { DEFAULT_REST_TIME } from '../utils/constants.js';
import { Timestamp } from 'firebase/firestore';

let sessionStartTime = null;
let sessionTimer = null;

export async function renderWorkout(container) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const routineId = params.get('routine');
  const dayIndex = parseInt(params.get('day'), 10);

  if (!routineId || isNaN(dayIndex)) {
    container.innerHTML = '<p class="text-warning">Parámetros inválidos</p>';
    return;
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

  // Load previous session data for each exercise
  const previousData = {};
  const suggestions = {};
  for (const exId of day.exercises || []) {
    const prev = await getLastSessionForExercise(exId);
    if (prev) {
      previousData[exId] = prev;
      suggestions[exId] = getWeightSuggestion(prev.sets);
    }
  }

  // Build session state
  const sessionState = {
    routineId,
    dayName: day.dayName,
    exercises: {},
  };

  for (const exId of day.exercises || []) {
    const prev = previousData[exId];
    const numSets = prev ? prev.sets.filter((s) => s.type !== 'warmup').length : 3;
    sessionState.exercises[exId] = {
      sets: Array.from({ length: numSets }, (_, i) => ({
        setNumber: i + 1,
        weight: suggestions[exId]?.weight || (prev ? prev.sets.find((s) => s.type !== 'warmup')?.weight : '') || '',
        reps: '',
        type: 'working',
        completed: false,
      })),
    };
  }

  sessionStartTime = Date.now();
  renderWorkoutUI(container, day, exerciseMap, previousData, suggestions, sessionState, routineId);
}

function renderWorkoutUI(container, day, exerciseMap, previousData, suggestions, sessionState, routineId) {
  let elapsed = 0;

  let html = `
    <div class="workout-header">
      <div>
        <h1>${day.dayName}</h1>
        <p class="text-muted" style="font-size:0.85rem">${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>
      <button class="btn btn-ghost" id="btn-back">✕</button>
    </div>
    <div class="workout-timer-bar">
      <span>Duración</span>
      <span id="session-elapsed">0:00</span>
    </div>
  `;

  for (const exId of Object.keys(sessionState.exercises)) {
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
          <span class="badge badge-muted">${ex.muscleGroup}</span>
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
  `;

  container.innerHTML = html;

  // Session timer
  sessionTimer = setInterval(() => {
    elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const el = container.querySelector('#session-elapsed');
    if (el) el.textContent = formatDuration(elapsed);
  }, 1000);

  // Event: back button
  container.querySelector('#btn-back').addEventListener('click', () => {
    if (confirm('¿Salir sin guardar?')) {
      clearInterval(sessionTimer);
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
      // Re-render
      clearInterval(sessionTimer);
      const currentNotes = container.querySelector('#session-notes')?.value || '';
      renderWorkoutUI(container, { dayName: container.querySelector('h1').textContent, exercises: Object.keys(sessionState.exercises) },
        Object.fromEntries(Object.keys(sessionState.exercises).map(id => [id, { id, name: container.querySelector(`[data-exercise-id="${id}"] h3`)?.textContent || '', muscleGroup: '' }])),
        {}, {}, sessionState, routineId);
      const notesField = container.querySelector('#session-notes');
      if (notesField) notesField.value = currentNotes;
    });
  });

  // Event: save session
  container.querySelector('#btn-save-session').addEventListener('click', async () => {
    clearInterval(sessionTimer);
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
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
        routineId,
        dayName: sessionState.dayName,
        sets: allSets,
        notes,
        duration,
      });

      navigate('/');
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    }
  });

  return {
    destroy() {
      clearInterval(sessionTimer);
    },
  };
}
