import {
  getExercises,
  addExercise,
  updateExercise,
  archiveExercise,
  restoreExercise,
  deleteExercise,
} from '../services/exercises.js';
import { MUSCLE_GROUPS } from '../utils/constants.js';

export async function renderExercises(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h1 style="margin-bottom:0">Ejercicios</h1>
      <button class="btn btn-primary btn-sm" id="btn-add-exercise">+ Nuevo</button>
    </div>
    <div class="chip-group mb-16" id="muscle-filter">
      <button class="chip active" data-group="all">Todos</button>
      ${MUSCLE_GROUPS.map((g) => `<button class="chip" data-group="${g}">${g}</button>`).join('')}
    </div>
    <div>
      <label style="font-size:0.8rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;margin-bottom:12px">
        <input type="checkbox" id="show-archived"> Mostrar archivados
      </label>
    </div>
    <div id="exercise-list"><div class="spinner"></div></div>
    <div id="exercise-modal-container"></div>
  `;

  let allExercises = [];
  let filterGroup = 'all';
  let showArchived = false;

  const listEl = container.querySelector('#exercise-list');
  const modalContainer = container.querySelector('#exercise-modal-container');

  async function loadExercises() {
    allExercises = await getExercises(false);
    renderList();
  }

  function renderList() {
    let filtered = allExercises;
    if (filterGroup !== 'all') {
      filtered = filtered.filter((e) => e.muscleGroup === filterGroup);
    }
    if (!showArchived) {
      filtered = filtered.filter((e) => e.isActive);
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💪</div>
          <p>No hay ejercicios${filterGroup !== 'all' ? ` en ${filterGroup}` : ''}.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map(
        (ex) => `
      <div class="exercise-list-item ${ex.isActive ? '' : 'archived'}" data-id="${ex.id}">
        <div class="exercise-info">
          <h3>${ex.name}</h3>
          <p>${ex.muscleGroup}${ex.notes ? ` · ${ex.notes}` : ''}</p>
        </div>
        <div class="exercise-actions">
          <button class="btn-ghost btn-sm edit-btn" data-id="${ex.id}" title="Editar">✏️</button>
          ${
            ex.isActive
              ? `<button class="btn-ghost btn-sm archive-btn" data-id="${ex.id}" title="Archivar">📦</button>`
              : `<button class="btn-ghost btn-sm restore-btn" data-id="${ex.id}" title="Restaurar">♻️</button>`
          }
        </div>
      </div>
    `
      )
      .join('');

    // Edit
    listEl.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ex = allExercises.find((ex) => ex.id === btn.dataset.id);
        if (ex) showExerciseModal(ex);
      });
    });

    // Archive
    listEl.querySelectorAll('.archive-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await archiveExercise(btn.dataset.id);
        await loadExercises();
      });
    });

    // Restore
    listEl.querySelectorAll('.restore-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await restoreExercise(btn.dataset.id);
        await loadExercises();
      });
    });
  }

  function showExerciseModal(existing = null) {
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="exercise-modal">
        <div class="modal">
          <div class="modal-header">
            <h2>${existing ? 'Editar ejercicio' : 'Nuevo ejercicio'}</h2>
            <button class="btn-ghost" id="modal-close">✕</button>
          </div>
          <div class="input-group">
            <label>Nombre</label>
            <input type="text" class="input" id="ex-name" value="${existing?.name || ''}" placeholder="Ej: Press banca">
          </div>
          <div class="input-group">
            <label>Grupo muscular</label>
            <select class="select" id="ex-group">
              ${MUSCLE_GROUPS.map((g) => `<option value="${g}" ${existing?.muscleGroup === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label>Notas (opcional)</label>
            <textarea class="textarea" id="ex-notes" placeholder="Ej: Agarre ancho, usar cinturón...">${existing?.notes || ''}</textarea>
          </div>
          <button class="btn btn-primary btn-block" id="ex-save">${existing ? 'Guardar cambios' : 'Crear ejercicio'}</button>
          ${existing ? `<button class="btn btn-danger btn-block mt-8" id="ex-delete">Eliminar permanentemente</button>` : ''}
        </div>
      </div>
    `;

    const close = () => (modalContainer.innerHTML = '');
    modalContainer.querySelector('#modal-close').addEventListener('click', close);
    modalContainer.querySelector('.modal-backdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) close();
    });

    modalContainer.querySelector('#ex-save').addEventListener('click', async () => {
      const name = modalContainer.querySelector('#ex-name').value.trim();
      const muscleGroup = modalContainer.querySelector('#ex-group').value;
      const notes = modalContainer.querySelector('#ex-notes').value.trim();

      if (!name) {
        alert('El nombre es obligatorio');
        return;
      }

      if (existing) {
        await updateExercise(existing.id, { name, muscleGroup, notes });
      } else {
        await addExercise({ name, muscleGroup, notes });
      }
      close();
      await loadExercises();
    });

    if (existing) {
      modalContainer.querySelector('#ex-delete').addEventListener('click', async () => {
        if (!confirm(`¿Eliminar "${existing.name}" permanentemente? Se perderán las referencias en las rutinas.`)) return;
        await deleteExercise(existing.id);
        close();
        await loadExercises();
      });
    }
  }

  // Filter chips
  container.querySelector('#muscle-filter').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('#muscle-filter .chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    filterGroup = chip.dataset.group;
    renderList();
  });

  // Show archived toggle
  container.querySelector('#show-archived').addEventListener('change', (e) => {
    showArchived = e.target.checked;
    renderList();
  });

  // Add button
  container.querySelector('#btn-add-exercise').addEventListener('click', () => showExerciseModal());

  await loadExercises();
}
