import { navigate } from './router.js';

const tabs = [
  { path: '/', icon: '🏠', label: 'Inicio' },
  { path: '/workout', icon: '💪', label: 'Entrenar' },
  { path: '/progress', icon: '📈', label: 'Progreso' },
  { path: '/history', icon: '📋', label: 'Historial' },
  { path: '/settings', icon: '⚙️', label: 'Ajustes' },
];

export function renderNavbar() {
  const navbar = document.getElementById('navbar');
  navbar.innerHTML = tabs
    .map(
      (tab) => `
    <button class="nav-tab" data-path="${tab.path}">
      <span class="nav-icon">${tab.icon}</span>
      <span class="nav-label">${tab.label}</span>
    </button>
  `
    )
    .join('');

  navbar.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-tab');
    if (!tab) return;
    navigate(tab.dataset.path);
    updateActiveTab();
  });

  window.addEventListener('hashchange', updateActiveTab);
  updateActiveTab();
}

function updateActiveTab() {
  const currentPath = (window.location.hash.slice(1) || '/').split('?')[0];
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.path === currentPath);
  });
}

export function showNavbar() {
  document.getElementById('navbar').classList.remove('hidden');
}

export function hideNavbar() {
  document.getElementById('navbar').classList.add('hidden');
}
