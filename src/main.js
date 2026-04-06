import { initAuth, getUser, onUserChange } from './services/auth.js';
import { registerRoute, initRouter, navigate } from './components/router.js';
import { renderNavbar, showNavbar, hideNavbar } from './components/navbar.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderWorkout } from './views/workout.js';
import { renderProgress } from './views/progress.js';
import { renderHistory } from './views/history.js';
import { renderExercises } from './views/exercises.js';
import { renderRoutines } from './views/routines.js';
import { renderSettings } from './views/settings.js';

// Auth guard: redirect to login if not authenticated
function authGuard(renderFn) {
  return async (container) => {
    if (!getUser()) {
      navigate('/login');
      return;
    }
    return renderFn(container);
  };
}

// Register routes
registerRoute('/login', async (container) => {
  hideNavbar();
  if (getUser()) {
    navigate('/');
    return;
  }
  return renderLogin(container);
});

registerRoute('/', authGuard(async (container) => {
  showNavbar();
  return renderDashboard(container);
}));

registerRoute('/workout', authGuard(async (container) => {
  showNavbar();
  return renderWorkout(container);
}));

registerRoute('/progress', authGuard(async (container) => {
  showNavbar();
  return renderProgress(container);
}));

registerRoute('/history', authGuard(async (container) => {
  showNavbar();
  return renderHistory(container);
}));

registerRoute('/exercises', authGuard(async (container) => {
  showNavbar();
  return renderExercises(container);
}));

registerRoute('/routines', authGuard(async (container) => {
  showNavbar();
  return renderRoutines(container);
}));

registerRoute('/settings', authGuard(async (container) => {
  showNavbar();
  return renderSettings(container);
}));

// Init
async function init() {
  // Show loading
  document.getElementById('view-container').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100dvh">
      <div class="spinner"></div>
    </div>
  `;

  // Wait for auth state
  const user = await initAuth();

  // Setup navbar
  renderNavbar();

  // Listen for auth changes
  onUserChange((user) => {
    if (!user && window.location.hash !== '#/login') {
      navigate('/login');
    }
  });

  // Start router
  if (!user && window.location.hash !== '#/login') {
    navigate('/login');
  }
  initRouter();
}

init();
