import { formatDuration } from '../utils/formatters.js';

let timerInterval = null;

export function showRestTimer(durationSeconds) {
  const stored = parseInt(localStorage.getItem('gymcontrol_rest_time'), 10);
  const totalSeconds = stored || durationSeconds;
  let remaining = totalSeconds;

  const overlay = document.getElementById('timer-overlay');
  overlay.classList.remove('hidden');

  const circumference = 2 * Math.PI * 90;

  overlay.innerHTML = `
    <div class="timer-progress">
      <svg viewBox="0 0 200 200">
        <circle class="timer-track" cx="100" cy="100" r="90"></circle>
        <circle class="timer-fill" cx="100" cy="100" r="90"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="0"></circle>
      </svg>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
        <span class="timer-display" id="timer-text">${formatDuration(remaining)}</span>
      </div>
    </div>
    <p style="color:var(--text-secondary)">Descanso</p>
    <div style="display:flex;gap:12px">
      <button class="btn btn-secondary" id="timer-skip">Saltar</button>
      <button class="btn btn-ghost" id="timer-add30">+30s</button>
    </div>
  `;

  const timerText = overlay.querySelector('#timer-text');
  const timerFill = overlay.querySelector('.timer-fill');

  function updateTimer() {
    remaining--;
    if (remaining <= 0) {
      clearInterval(timerInterval);
      // Vibrate if supported
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      timerText.textContent = '¡Ya!';
      timerText.style.color = 'var(--success)';
      setTimeout(() => hideTimer(), 1500);
      return;
    }

    timerText.textContent = formatDuration(remaining);
    const progress = 1 - remaining / totalSeconds;
    timerFill.style.strokeDashoffset = circumference * progress;

    // Change color when almost done
    if (remaining <= 5) {
      timerFill.style.stroke = 'var(--warning)';
    }
  }

  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 1000);

  // Skip button
  overlay.querySelector('#timer-skip').addEventListener('click', hideTimer);

  // Add 30s
  overlay.querySelector('#timer-add30').addEventListener('click', () => {
    remaining += 30;
  });
}

function hideTimer() {
  clearInterval(timerInterval);
  const overlay = document.getElementById('timer-overlay');
  overlay.classList.add('hidden');
  overlay.innerHTML = '';
}
