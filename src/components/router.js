const routes = {};
let currentView = null;

export function registerRoute(path, renderFn) {
  routes[path] = renderFn;
}

export function navigate(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return window.location.hash.slice(1) || '/';
}

async function handleRouteChange() {
  const path = getCurrentRoute();
  const container = document.getElementById('view-container');
  const renderFn = routes[path] || routes['/'];

  if (!renderFn) return;

  if (currentView && currentView.destroy) {
    currentView.destroy();
  }

  container.innerHTML = '';
  currentView = await renderFn(container);
}

export function initRouter() {
  window.addEventListener('hashchange', handleRouteChange);
  handleRouteChange();
}
