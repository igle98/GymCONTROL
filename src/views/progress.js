import { getExercises } from '../services/exercises.js';
import { getExerciseProgression } from '../services/sessions.js';
import { estimate1RM, calculateVolume } from '../utils/calculations.js';
import { formatDate, formatWeight } from '../utils/formatters.js';
import { CHART_COLORS } from '../utils/constants.js';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

let currentChart = null;

export async function renderProgress(container) {
  container.innerHTML = `
    <h1>Progreso</h1>
    <div id="exercise-list"><div class="spinner"></div></div>
    <div id="chart-area" class="hidden"></div>
  `;

  const exerciseList = container.querySelector('#exercise-list');
  const chartArea = container.querySelector('#chart-area');

  const exercises = await getExercises();

  if (exercises.length === 0) {
    exerciseList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>Aún no tienes ejercicios. Créalos en Ajustes.</p>
      </div>
    `;
    return;
  }

  // Group by muscle group
  const grouped = {};
  exercises.forEach((ex) => {
    if (!grouped[ex.muscleGroup]) grouped[ex.muscleGroup] = [];
    grouped[ex.muscleGroup].push(ex);
  });

  let html = '';
  for (const [group, exList] of Object.entries(grouped).sort()) {
    html += `<h2 class="mt-16 mb-8" style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase">${group}</h2>`;
    exList.forEach((ex) => {
      html += `
        <div class="exercise-select-card" data-exercise-id="${ex.id}">
          <span>${ex.name}</span>
          <span class="day-card-arrow">›</span>
        </div>
      `;
    });
  }
  exerciseList.innerHTML = html;

  // Click handler
  exerciseList.querySelectorAll('.exercise-select-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const exId = card.dataset.exerciseId;
      const exName = card.querySelector('span').textContent;

      exerciseList.classList.add('hidden');
      chartArea.classList.remove('hidden');
      chartArea.innerHTML = '<div class="spinner"></div>';

      const progression = await getExerciseProgression(exId);

      if (progression.length < 2) {
        chartArea.innerHTML = `
          <button class="btn btn-ghost mb-16" id="btn-back-list">← Volver</button>
          <div class="empty-state">
            <div class="empty-state-icon">📈</div>
            <p>Necesitas al menos 2 sesiones con ${exName} para ver progresión.</p>
          </div>
        `;
        chartArea.querySelector('#btn-back-list').addEventListener('click', () => {
          chartArea.classList.add('hidden');
          exerciseList.classList.remove('hidden');
        });
        return;
      }

      const labels = progression.map((p) => formatDate(p.date.toDate ? p.date.toDate() : p.date));
      const weights = progression.map((p) => p.maxWeight);
      const volumes = progression.map((p) => p.totalVolume);
      const estimated1RMs = progression.map((p) => estimate1RM(p.bestSet.weight, p.bestSet.reps));

      // Stats
      const currentMax = weights[weights.length - 1];
      const allTimeMax = Math.max(...weights);
      const current1RM = estimated1RMs[estimated1RMs.length - 1];
      const totalSessions = progression.length;

      chartArea.innerHTML = `
        <button class="btn btn-ghost mb-16" id="btn-back-list">← Volver</button>
        <h2>${exName}</h2>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${formatWeight(currentMax)}</div>
            <div class="stat-label">Último peso</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatWeight(allTimeMax)}</div>
            <div class="stat-label">Máximo histórico</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${formatWeight(current1RM)}</div>
            <div class="stat-label">1RM estimado</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${totalSessions}</div>
            <div class="stat-label">Sesiones</div>
          </div>
        </div>

        <div class="chart-container">
          <canvas id="chart-weight"></canvas>
        </div>

        <div class="chart-container">
          <canvas id="chart-volume"></canvas>
        </div>
      `;

      // Weight progression chart
      const ctxWeight = chartArea.querySelector('#chart-weight').getContext('2d');
      if (currentChart) currentChart.destroy();

      currentChart = new Chart(ctxWeight, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Peso máximo (kg)',
              data: weights,
              borderColor: CHART_COLORS.primary,
              backgroundColor: 'rgba(233, 69, 96, 0.1)',
              fill: true,
              tension: 0.3,
              pointRadius: 4,
              pointBackgroundColor: CHART_COLORS.primary,
            },
            {
              label: '1RM estimado (kg)',
              data: estimated1RMs,
              borderColor: '#f39c12',
              borderDash: [5, 5],
              tension: 0.3,
              pointRadius: 3,
              fill: false,
            },
          ],
        },
        options: chartOptions('Peso (kg)'),
      });

      // Volume chart
      const ctxVolume = chartArea.querySelector('#chart-volume').getContext('2d');
      new Chart(ctxVolume, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Volumen total (kg)',
              data: volumes,
              backgroundColor: 'rgba(46, 204, 113, 0.5)',
              borderColor: '#2ecc71',
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        options: chartOptions('Volumen (kg)'),
      });

      chartArea.querySelector('#btn-back-list').addEventListener('click', () => {
        if (currentChart) currentChart.destroy();
        currentChart = null;
        chartArea.classList.add('hidden');
        exerciseList.classList.remove('hidden');
      });
    });
  });

  return {
    destroy() {
      if (currentChart) {
        currentChart.destroy();
        currentChart = null;
      }
    },
  };
}

function chartOptions(yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: { color: CHART_COLORS.text, font: { size: 11 } },
      },
    },
    scales: {
      x: {
        ticks: { color: CHART_COLORS.text, font: { size: 10 }, maxRotation: 45 },
        grid: { color: CHART_COLORS.grid },
      },
      y: {
        title: { display: true, text: yLabel, color: CHART_COLORS.text },
        ticks: { color: CHART_COLORS.text },
        grid: { color: CHART_COLORS.grid },
        beginAtZero: false,
      },
    },
  };
}
