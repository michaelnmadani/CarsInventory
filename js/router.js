const handlers = {};
let currentHash = '';

export function onRoute(path, fn) {
  handlers[path] = fn;
}

export function navigate(hash) {
  window.location.hash = hash;
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const raw   = window.location.hash.slice(1) || '/dashboard';
  currentHash = raw;

  const appEl = document.getElementById('app');
  if (!appEl) return;

  // Parameterized routes
  const bioMatch  = raw.match(/^\/bio\/(.+)$/);
  const editMatch = raw.match(/^\/edit\/(.+)$/);

  if (bioMatch  && handlers['/bio/:id'])  { handlers['/bio/:id'](appEl, bioMatch[1]);   updateNav(raw); return; }
  if (editMatch && handlers['/edit/:id']) { handlers['/edit/:id'](appEl, editMatch[1]); updateNav(raw); return; }

  const fn = handlers[raw];
  if (fn) { fn(appEl); updateNav(raw); }
  else    { navigate('#/dashboard'); }
}

function updateNav(raw) {
  document.querySelectorAll('.nav-link[data-route]').forEach(el => {
    el.classList.toggle('active', raw.startsWith(el.dataset.route));
  });
}

export function currentRoute() { return currentHash; }
