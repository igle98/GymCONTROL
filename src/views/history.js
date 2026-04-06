import { getSessions, deleteSession } from '../services/sessions.js';
import { getExercises } from '../services/exercises.js';
import { formatDateFull, formatWeight, formatDuration, timeAgo } from '../utils/formatters.js';
import { calculateVolume, estimate1RM } from '../utils/calculations.js';

export async function renderHistory(container) {
  container.innerHTML = `
    <h1>Historial</h1>
    <div id="history-content"><div class="spinner"></div></div>
  `;

  const content = container.querySelector('#history-content');

  try {
    const [sessions, exercises] = await Promise.all([
      getSessions(100),
      getExercises(false),
    ]);

    const exerciseMap = Object.fromEntries(exercises.map((e) => [e.id, e]));

    if (sessions.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <p>Aún no has registrado ninguna sesión.</p>
        </div>
      `;
      return;
    }

    renderSessionList(content, sessions, exerciseMap);
  } catch (err) {
    content.innerHTML = `<p class="text-warning">Error: ${err.message}</p>`;
  }
}

function renderSessionList(content, sessions, exerciseMap) {
  let html = '';

  sessions.forEach((session) => {
    const date = session.date?.toDate ? session.date.toDate() : new Date(session.date);
    const sets = session.sets || [];
    const workingSets = sets.filter((s) => s.type !== 'warmup');

    // Group sets by exercise
    const byExercise = {};
    workingSets.forEach((s) => {
      if (!byExercise[s.exerciseId]) byExercise[s.exerciseId] = [];
      byExercise[s.exerciseId].push(s);
    });

    const volume = calculateVolume(sets);
    const exerciseNames = Object.keys(byExercise)
      .map((id) => exerciseMap[id]?.name || '?')
      .join(', ');

    html += `
      <div class="session-card" data-session-id="${session.id}">
        <div class="session-card-header">
          <div>
            <strong>${formatDateFull(date)}</strong>
            <span class="badge badge-muted" style="margin-left:8px">${timeAgo(date)}</span>
          </div>
          <button class="btn-ghost btn-sm session-delete" data-id="${session.id}" title="Eliminar">🗑️</button>
        </div>
        ${session.dayName ? `<p style="font-size:0.85rem;color:var(--accent);margin-bottom:8px">${session.dayName}</p>` : ''}
        <div class="session-exercises">
    `;

    for (const [exId, exSets] of Object.entries(byExercise)) {
      const exName = exerciseMap[exId]?.name || 'Ejercicio eliminado';
      const setsText = exSets.map((s) => `${s.weight}×${s.reps}`).join(' | ');
      html += `<p><strong>${exName}:</strong> ${setsText}</p>`;
    }

    html += `
        </div>
        <div style="display:flex;gap:16px;margin-top:8px;font-size:0.8rem;color:var(--text-muted)">
          <span>Vol: ${formatWeight(volume)}</span>
          ${session.duration ? `<span>Dur: ${formatDuration(session.duration)}</span>` : ''}
          <span>${workingSets.length} series</span>
        </div>
        ${session.notes ? `<p style="font-size:0.8rem;color:var(--text-secondary);margin-top:8px;font-style:italic">"${session.notes}"</p>` : ''}
      </div>
    `;
  });

  content.innerHTML = html;

  // Delete handlers
  content.querySelectorAll('.session-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Eliminar esta sesión? No se puede deshacer.')) return;
      try {
        await deleteSession(btn.dataset.id);
        const card = btn.closest('.session-card');
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 200);
      } catch (err) {
        alert('Error al eliminar: ' + err.message);
      }
    });
  });
}
