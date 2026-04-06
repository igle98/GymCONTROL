import {
  getRoutines,
  addRoutine,
  updateRoutine,
  activateRoutine,
  deleteRoutine,
} from '../services/routines.js';
import { getExercises } from '../services/exercises.js';

export async function renderRoutines(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h1 style="margin-bottom:0">Rutinas</h1>
      <button class="btn btn-primary btn-sm" id="btn-add-routine">+ Nueva</button>
    </div>
    <div id="routines-list"><div class="spinner"></div></div>
    <div id="routine-modal-container"></div>
  `;

  const listEl = container.querySelector('#routines-list');
  const modalContainer = container.querySelector('#routine-modal-container');
  let allExercises = [];

  async function load() {
    const [routines, exercises] = await Promise.all([getRoutines(), getExercises()]);
    allExercises = exercises;
    const exerciseMap = Object.fromEntries(exercises.map((e) => [e.id, e]));

    if (routines.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p>No tienes rutinas. Crea una para empezar.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = routines
      .map(
        (r) => `
      <div class="routine-card ${r.isActive ? 'active' : ''}" data-id="${r.id}">
        <div class="routine-card-header">
          <div>
            <h3>${r.name}</h3>
            ${r.isActive ? '<span class="badge badge-accent">Activa</span>' : ''}
          </div>
          <div style="display:flex;gap:4px">
            ${!r.isActive ? `<button class="btn btn-sm btn-secondary activate-btn" data-id="${r.id}">Activar</button>` : ''}
            <button class="btn-ghost btn-sm edit-routine-btn" data-id="${r.id}">✏️</button>
            <button class="btn-ghost btn-sm delete-routine-btn" data-id="${r.id}">🗑️</button>
          </div>
        </div>
        <ul class="routine-days-list">
          ${(r.days || [])
            .map((d) => {
              const exNames = (d.exercises || [])
                .map((id) => exerciseMap[id]?.name || '?')
                .join(', ');
              return `<li><strong>${d.dayName}:</strong> ${exNames || 'Sin ejercicios'}</li>`;
            })
            .join('')}
        </ul>
      </div>
    `
      )
      .join('');

    // Activate
    listEl.querySelectorAll('.activate-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await activateRoutine(btn.dataset.id);
        await load();
      });
    });

    // Edit
    listEl.querySelectorAll('.edit-routine-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const routine = routines.find((r) => r.id === btn.dataset.id);
        if (routine) showRoutineModal(routine);
      });
    });

    // Delete
    listEl.querySelectorAll('.delete-routine-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('¿Eliminar esta rutina?')) return;
        await deleteRoutine(btn.dataset.id);
        await load();
      });
    });
  }

  function showRoutineModal(existing = null) {
    const days = existing?.days ? JSON.parse(JSON.stringify(existing.days)) : [{ dayName: '', exercises: [] }];

    function renderModal() {
      modalContainer.innerHTML = `
        <div class="modal-backdrop" id="routine-modal">
          <div class="modal">
            <div class="modal-header">
              <h2>${existing ? 'Editar rutina' : 'Nueva rutina'}</h2>
              <button class="btn-ghost" id="rmodal-close">✕</button>
            </div>
            <div class="input-group">
              <label>Nombre de la rutina</label>
              <input type="text" class="input" id="r-name" value="${existing?.name || ''}" placeholder="Ej: Push/Pull/Legs">
            </div>

            <h3 class="mb-8">Días de entrenamiento</h3>
            <div id="days-container">
              ${days
                .map(
                  (day, i) => `
                <div class="card mb-8" data-day-index="${i}">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <input type="text" class="input day-name-input" value="${day.dayName}" placeholder="Ej: Día A - Pecho" style="flex:1;margin-right:8px">
                    ${days.length > 1 ? `<button class="btn-ghost btn-sm remove-day-btn" data-index="${i}">✕</button>` : ''}
                  </div>
                  <div class="day-exercises" data-day-index="${i}">
                    ${(day.exercises || [])
                      .map((exId) => {
                        const ex = allExercises.find((e) => e.id === exId);
                        return ex
                          ? `<span class="badge badge-accent" style="margin:2px;display:inline-flex;align-items:center;gap:4px">
                              ${ex.name}
                              <button class="remove-ex-btn" data-day="${i}" data-ex="${exId}" style="background:none;border:none;color:inherit;cursor:pointer;font-size:0.8rem">✕</button>
                            </span>`
                          : '';
                      })
                      .join('')}
                  </div>
                  <select class="select mt-8 add-exercise-select" data-day-index="${i}">
                    <option value="">+ Añadir ejercicio...</option>
                    ${allExercises
                      .filter((e) => !(day.exercises || []).includes(e.id))
                      .map((e) => `<option value="${e.id}">${e.name} (${e.muscleGroup})</option>`)
                      .join('')}
                  </select>
                </div>
              `
                )
                .join('')}
            </div>

            <button class="btn btn-secondary btn-block btn-sm mt-8" id="add-day-btn">+ Añadir día</button>
            <button class="btn btn-primary btn-block mt-16" id="r-save">${existing ? 'Guardar cambios' : 'Crear rutina'}</button>
          </div>
        </div>
      `;

      // Close
      const close = () => (modalContainer.innerHTML = '');
      modalContainer.querySelector('#rmodal-close').addEventListener('click', close);
      modalContainer.querySelector('.modal-backdrop').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) close();
      });

      // Remove day
      modalContainer.querySelectorAll('.remove-day-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          days.splice(parseInt(btn.dataset.index, 10), 1);
          renderModal();
        });
      });

      // Remove exercise from day
      modalContainer.querySelectorAll('.remove-ex-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const dayIdx = parseInt(btn.dataset.day, 10);
          days[dayIdx].exercises = days[dayIdx].exercises.filter((id) => id !== btn.dataset.ex);
          renderModal();
        });
      });

      // Add exercise to day
      modalContainer.querySelectorAll('.add-exercise-select').forEach((sel) => {
        sel.addEventListener('change', () => {
          const dayIdx = parseInt(sel.dataset.dayIndex, 10);
          if (sel.value) {
            if (!days[dayIdx].exercises) days[dayIdx].exercises = [];
            days[dayIdx].exercises.push(sel.value);
            renderModal();
          }
        });
      });

      // Day name sync
      modalContainer.querySelectorAll('.day-name-input').forEach((input, i) => {
        input.addEventListener('input', () => {
          days[i].dayName = input.value;
        });
      });

      // Add day
      modalContainer.querySelector('#add-day-btn').addEventListener('click', () => {
        days.push({ dayName: '', exercises: [] });
        renderModal();
      });

      // Save
      modalContainer.querySelector('#r-save').addEventListener('click', async () => {
        const name = modalContainer.querySelector('#r-name').value.trim();
        if (!name) {
          alert('El nombre es obligatorio');
          return;
        }

        // Sync day names from inputs
        modalContainer.querySelectorAll('.day-name-input').forEach((input, i) => {
          days[i].dayName = input.value.trim() || `Día ${i + 1}`;
        });

        if (existing) {
          await updateRoutine(existing.id, { name, days });
        } else {
          await addRoutine({ name, days, isActive: true });
        }
        close();
        await load();
      });
    }

    renderModal();
  }

  container.querySelector('#btn-add-routine').addEventListener('click', () => showRoutineModal());

  await load();
}
