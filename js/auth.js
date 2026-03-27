const AUTH_KEY = 'cars_auth';

export function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setAuth(username) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ username, loggedIn: true }));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function isLoggedIn() {
  const a = getAuth();
  return !!(a && a.loggedIn);
}

// ── Login page bootstrap ──────────────────────────────────────
if (document.getElementById('loginForm')) {
  // Already logged in? Go straight to app.
  if (isLoggedIn()) {
    window.location.href = 'app.html#/dashboard';
  }

  const form  = document.getElementById('loginForm');
  const err   = document.getElementById('loginError');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
      err.hidden = false;
      err.textContent = 'Please enter a username and password.';
      return;
    }

    if (username !== 'Rosie' || password !== 'Jasper') {
      err.hidden = false;
      err.textContent = 'Invalid username or password.';
      return;
    }

    err.hidden = true;
    setAuth(username);
    window.location.href = 'app.html#/dashboard';
  });
}
