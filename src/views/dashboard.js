import { getUser } from '../services/auth.js';
import { getActiveRoutine } from '../services/routines.js';
import { getLastSessionForExercise } from '../services/sessions.js';
import { getExercises } from '../services/exercises.js';
import { navigate } from '../components/router.js';
import { getActiveSession } from './workout.js';
import { timeAgo, formatWeight } from '../utils/formatters.js';

export async function renderDashboard(container) {
  const user = getUser();
  const firstName = user.displayName?.split(' ')[0] || 'Atleta';

  container.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-greeting">
        <span>Buenas, </span>
        <strong>${firstName}</strong>
      </div>
      ${user.photoURL ? `<img src="${user.photoURL}" alt="Avatar" class="user-avatar">` : ''}
    </div>
    <div id="dashboard-content"><div class="spinner"></div></div>
  `;

  const content = container.querySelector('#dashboard-content');

  try {
    const routine = await getActiveRoutine();

    if (!routine) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p>No tienes una rutina activa.</p>
          <button class="btn btn-primary" id="btn-create-routine">Crear rutina</button>
        </div>
      `;
      content.querySelector('#btn-create-routine')?.addEventListener('click', () => {
        navigate('/settings');
      });
      return;
    }

    const exercises = await getExercises();
    const exerciseMap = Object.fromEntries(exercises.map((e) => [e.id, e]));

    const active = getActiveSession();

    let html = '';

    if (active) {
      html += `
        <div class="day-card active" id="resume-session" style="cursor:pointer">
          <div class="day-card-info">
            <h3>▶ Continuar entreno</h3>
            <p>${active.dayName} · en curso</p>
          </div>
          <span class="day-card-arrow">›</span>
        </div>
      `;
    }

    html += `
      <div class="routine-selector">
        <h2>${routine.name}</h2>
        <p class="text-muted" style="font-size:0.85rem">Elige el día que vas a entrenar hoy</p>
      </div>
      <div class="day-cards">
    `;

    for (let i = 0; i < routine.days.length; i++) {
      const day = routine.days[i];
      const exerciseNames = (day.exercises || [])
        .map((id) => exerciseMap[id]?.name || '?')
        .slice(0, 4)
        .join(', ');
      const extra = (day.exercises || []).length > 4
        ? ` +${(day.exercises || []).length - 4} más`
        : '';

      html += `
        <div class="day-card" data-day-index="${i}" data-routine-id="${routine.id}">
          <div class="day-card-info">
            <h3>${day.dayName}</h3>
            <p>${exerciseNames}${extra}</p>
          </div>
          <span class="day-card-arrow">›</span>
        </div>
      `;
    }

    html += `</div>`;
    content.innerHTML = html;

    content.querySelector('#resume-session')?.addEventListener('click', () => {
      navigate(`/workout?routine=${active.routineId}&day=${active.dayIndex}`);
    });

    content.querySelectorAll('.day-card[data-day-index]').forEach((card) => {
      card.addEventListener('click', () => {
        const dayIndex = card.dataset.dayIndex;
        const routineId = card.dataset.routineId;
        navigate(`/workout?routine=${routineId}&day=${dayIndex}`);
      });
    });
  } catch (err) {
    content.innerHTML = `<p class="text-warning">Error al cargar: ${err.message}</p>`;
  }
}
