import { getUser, logout } from '../services/auth.js';
import { navigate } from '../components/router.js';
import { getSessions } from '../services/sessions.js';
import { getExercises } from '../services/exercises.js';
import { DEFAULT_REST_TIME, REST_TIMES } from '../utils/constants.js';

export async function renderSettings(container) {
  const user = getUser();

  container.innerHTML = `
    <h1>Ajustes</h1>

    <div class="settings-section">
      <h2>Cuenta</h2>
      <div class="settings-item" style="cursor:default">
        <div style="display:flex;align-items:center;gap:12px">
          ${user.photoURL ? `<img src="${user.photoURL}" alt="" style="width:36px;height:36px;border-radius:50%">` : ''}
          <div>
            <strong>${user.displayName || 'Usuario'}</strong>
            <p style="font-size:0.8rem;color:var(--text-secondary)">${user.email}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h2>Gestión</h2>
      <div class="settings-item" id="nav-exercises">
        <span>Ejercicios</span>
        <span style="color:var(--text-muted)">›</span>
      </div>
      <div class="settings-item" id="nav-routines">
        <span>Rutinas</span>
        <span style="color:var(--text-muted)">›</span>
      </div>
    </div>

    <div class="settings-section">
      <h2>Temporizador de descanso</h2>
      <div class="chip-group" id="rest-timer-options">
        ${REST_TIMES.map(
          (t) =>
            `<button class="chip ${t.seconds === getStoredRestTime() ? 'active' : ''}" data-seconds="${t.seconds}">${t.label}</button>`
        ).join('')}
      </div>
    </div>

    <div class="settings-section">
      <h2>Datos</h2>
      <div class="settings-item" id="btn-export">
        <span>Exportar datos (JSON)</span>
        <span style="color:var(--text-muted)">📥</span>
      </div>
      <div class="settings-item" id="btn-export-csv">
        <span>Exportar datos (CSV)</span>
        <span style="color:var(--text-muted)">📄</span>
      </div>
    </div>

    <div class="settings-section mt-24">
      <button class="btn btn-danger btn-block" id="btn-logout">Cerrar sesión</button>
    </div>
  `;

  // Navigation
  container.querySelector('#nav-exercises').addEventListener('click', () => navigate('/exercises'));
  container.querySelector('#nav-routines').addEventListener('click', () => navigate('/routines'));

  // Rest timer preference
  container.querySelector('#rest-timer-options').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    container.querySelectorAll('#rest-timer-options .chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    localStorage.setItem('gymcontrol_rest_time', chip.dataset.seconds);
  });

  // Export JSON
  container.querySelector('#btn-export').addEventListener('click', async () => {
    try {
      const [sessions, exercises] = await Promise.all([
        getSessions(1000),
        getExercises(false),
      ]);
      const data = {
        exportDate: new Date().toISOString(),
        exercises,
        sessions: sessions.map((s) => ({
          ...s,
          date: s.date?.toDate ? s.date.toDate().toISOString() : s.date,
          createdAt: s.createdAt?.toDate ? s.createdAt.toDate().toISOString() : s.createdAt,
        })),
      };
      downloadFile(JSON.stringify(data, null, 2), 'gymcontrol-export.json', 'application/json');
    } catch (err) {
      alert('Error al exportar: ' + err.message);
    }
  });

  // Export CSV
  container.querySelector('#btn-export-csv').addEventListener('click', async () => {
    try {
      const [sessions, exercises] = await Promise.all([
        getSessions(1000),
        getExercises(false),
      ]);
      const exerciseMap = Object.fromEntries(exercises.map((e) => [e.id, e]));

      let csv = 'Fecha,Día,Ejercicio,Grupo Muscular,Serie,Peso (kg),Reps,Tipo\n';
      sessions.forEach((s) => {
        const date = s.date?.toDate ? s.date.toDate().toISOString().split('T')[0] : '';
        (s.sets || []).forEach((set) => {
          const ex = exerciseMap[set.exerciseId];
          csv += `${date},"${s.dayName || ''}","${ex?.name || '?'}","${ex?.muscleGroup || ''}",${set.setNumber},${set.weight},${set.reps},${set.type}\n`;
        });
      });
      downloadFile(csv, 'gymcontrol-export.csv', 'text/csv');
    } catch (err) {
      alert('Error al exportar: ' + err.message);
    }
  });

  // Logout
  container.querySelector('#btn-logout').addEventListener('click', async () => {
    await logout();
    navigate('/login');
  });
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getStoredRestTime() {
  return parseInt(localStorage.getItem('gymcontrol_rest_time') || DEFAULT_REST_TIME, 10);
}
