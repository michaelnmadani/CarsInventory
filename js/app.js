import { isLoggedIn, getAuth, clearAuth } from './auth.js';
import { onRoute, initRouter, navigate } from './router.js';
import { getAllCharacters, getCharacter, saveCharacter, deleteCharacter, slugify, resolveImage } from './store.js';
import { searchCars } from './search.js';
import { getCarCount, updateCarCount, getStats } from './tracker.js';

// ── Auth guard ────────────────────────────────────────────────
if (!isLoggedIn()) { window.location.href = 'index.html'; }

// ── Navbar ────────────────────────────────────────────────────
const navbarEl    = document.getElementById('navbar');
const mobileEl    = document.getElementById('mobileMenu');
let   mobileOpen  = false;

function renderNavbar() {
  const auth = getAuth();
  const logo = `<svg width="30" height="18" viewBox="0 0 60 36" fill="none"><rect x="4" y="10" width="52" height="18" rx="6" fill="#c1272d"/><rect x="14" y="4" width="28" height="14" rx="4" fill="#e8333a"/><circle cx="12" cy="28" r="6" fill="#1a1a2e" stroke="#f5c518" stroke-width="2"/><circle cx="48" cy="28" r="6" fill="#1a1a2e" stroke="#f5c518" stroke-width="2"/></svg>`;

  navbarEl.innerHTML = `
    <a class="navbar-brand" href="#/dashboard">${logo} Cars Tracker</a>
    <div class="navbar-nav">
      <a class="nav-link" href="#/dashboard" data-route="/dashboard">Dashboard</a>
      <a class="nav-link" href="#/database" data-route="/database">Database</a>
      <a class="nav-link" href="#/collection" data-route="/collection">Collection</a>
      <a class="nav-link" href="#/add" data-route="/add">+ Add Car</a>
    </div>
    <div class="navbar-actions">
      <span class="navbar-user">${auth ? auth.username : ''}</span>
      <button class="btn btn-sm btn-ghost" id="logoutBtn">Logout</button>
    </div>
    <button class="hamburger" id="hamburgerBtn" aria-label="Menu">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
    </button>`;

  mobileEl.innerHTML = `
    <a class="nav-link" href="#/dashboard" data-route="/dashboard">Dashboard</a>
    <a class="nav-link" href="#/database" data-route="/database">Database</a>
    <a class="nav-link" href="#/collection" data-route="/collection">Collection</a>
    <a class="nav-link" href="#/add" data-route="/add">+ Add Car</a>
    <div class="navbar-user">Signed in as <strong>${auth ? auth.username : ''}</strong></div>
    <button class="btn btn-sm btn-ghost" id="logoutBtnMobile" style="margin-top:8px">Logout</button>`;

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('logoutBtnMobile')?.addEventListener('click', logout);
  document.getElementById('hamburgerBtn').addEventListener('click', () => {
    mobileOpen = !mobileOpen;
    mobileEl.classList.toggle('open', mobileOpen);
  });

  // close mobile on nav
  mobileEl.querySelectorAll('.nav-link').forEach(l => {
    l.addEventListener('click', () => { mobileOpen = false; mobileEl.classList.remove('open'); });
  });
}

function logout() { clearAuth(); window.location.href = 'index.html'; }

// ── Helpers ───────────────────────────────────────────────────
function carImageHTML(char, cls = '') {
  const src = resolveImage(char);
  if (src) {
    return `<img src="${esc(src)}" alt="${esc(char.name)}" class="${cls}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="car-silhouette" style="--car-color:${esc(char.color || '#c1272d')};display:none">
              <div class="car-cabin"></div><div class="car-window"></div><div class="car-body"></div>
              <div class="car-wheel wheel-rear"></div><div class="car-wheel wheel-front"></div>
              <div class="car-number">${esc(char.number || '')}</div>
            </div>`;
  }
  return `<div class="car-silhouette" style="--car-color:${esc(char.color || '#c1272d')}">
            <div class="car-cabin"></div><div class="car-window"></div><div class="car-body"></div>
            <div class="car-wheel wheel-rear"></div><div class="car-wheel wheel-front"></div>
            <div class="car-number">${esc(char.number || '')}</div>
          </div>`;
}

function movieTagsHTML(movies) {
  return (movies || []).map(m => {
    const n = m === 'Cars' ? 1 : m === 'Cars 2' ? 2 : 3;
    return `<span class="movie-tag movie-tag-${n}">${esc(m)}</span>`;
  }).join('');
}

function trackerHTML(id, type, count) {
  return `<div class="tracker-controls">
    <button class="btn-icon btn-icon-sub" data-track="${id}" data-type="${type}" data-delta="-1">&minus;</button>
    <span class="tracker-count ${count > 0 ? 'has-items' : ''}">${count}</span>
    <button class="btn-icon btn-icon-add" data-track="${id}" data-type="${type}" data-delta="1">+</button>
  </div>`;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function wireTrackerButtons(el) {
  el.querySelectorAll('[data-track]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { track, type, delta } = btn.dataset;
      updateCarCount(track, type, parseInt(delta));
      // re-render view
      const hash = window.location.hash.slice(1) || '/dashboard';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  });
}

function sortCars(cars) {
  return [...cars].sort((a, b) => {
    const na = a.number ? parseInt(a.number) || 99999 : 99999;
    const nb = b.number ? parseInt(b.number) || 99999 : 99999;
    if (na !== nb) return na - nb;
    return a.name.localeCompare(b.name);
  });
}

// ── Dashboard View ────────────────────────────────────────────
function renderDashboard(appEl) {
  const chars = getAllCharacters();
  const stats = getStats(chars.length);
  const auth  = getAuth();

  appEl.innerHTML = `
    <div class="page">
      <div class="stripe-header">
        <h2>Welcome back, ${esc(auth ? auth.username : 'Racer')}!</h2>
        <p>Track your Cars Universe die-cast collection</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-value">${stats.uniqueOwned}</div>
          <div class="stat-card-label">Cars Owned</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${stats.total}</div>
          <div class="stat-card-label">Total Cars</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${stats.totalLarge}</div>
          <div class="stat-card-label">Large Die-casts</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-value">${stats.totalMini}</div>
          <div class="stat-card-label">Mini Die-casts</div>
        </div>
      </div>

      <div class="progress-section">
        <div class="progress-label">
          <span>Collection Progress</span>
          <span>${stats.pct}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${stats.pct}%"></div>
        </div>
      </div>

      <div class="quick-links">
        <a class="btn btn-primary" href="#/database">Browse Database</a>
        <a class="btn btn-secondary" href="#/collection">View Collection</a>
        <a class="btn btn-accent" href="#/add">+ Add Character</a>
      </div>
    </div>`;
}

// ── Database View ─────────────────────────────────────────────
let dbQuery = '';
let dbMovie = '';

function renderDatabase(appEl) {
  const allCars = getAllCharacters();
  const filtered = searchCars(allCars, dbQuery, dbMovie);

  const searchIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;

  appEl.innerHTML = `
    <div class="page">
      <div class="stripe-header">
        <h2>Cars Database</h2>
        <p>${allCars.length} characters from the Cars Universe</p>
      </div>

      <div class="search-bar-row">
        <div class="search-input-wrap">
          ${searchIcon}
          <input class="search-input" id="dbSearch" type="text" placeholder="Search by name, number, sponsor, or movie..." value="${esc(dbQuery)}">
        </div>
        <div class="filter-chips">
          <button class="filter-chip ${dbMovie === '' ? 'active' : ''}" data-movie="">All</button>
          <button class="filter-chip ${dbMovie === 'Cars' ? 'active' : ''}" data-movie="Cars">Cars</button>
          <button class="filter-chip ${dbMovie === 'Cars 2' ? 'active' : ''}" data-movie="Cars 2">Cars 2</button>
          <button class="filter-chip ${dbMovie === 'Cars 3' ? 'active' : ''}" data-movie="Cars 3">Cars 3</button>
        </div>
      </div>

      <div class="results-count">${filtered.length} result${filtered.length !== 1 ? 's' : ''}</div>

      <div class="cars-grid" id="carsGrid">
        ${filtered.map(car => {
          const cnt = getCarCount(car.id);
          return `
          <div class="car-card" data-id="${esc(car.id)}">
            <div class="car-card-image" data-nav="${esc(car.id)}">
              ${car.number ? `<span class="car-card-number">#${esc(car.number)}</span>` : ''}
              ${car.isCustom ? '<span class="badge badge-custom" style="position:absolute;top:8px;right:8px">Custom</span>' : ''}
              ${carImageHTML(car)}
            </div>
            <div class="car-card-body" data-nav="${esc(car.id)}">
              <div class="car-card-name">${esc(car.name)}</div>
              <div class="car-card-sponsor">${esc(car.sponsor || 'Unknown')}</div>
              <div class="movie-tags">${movieTagsHTML(car.movies)}</div>
            </div>
            <div class="car-card-tracker">
              <div class="tracker-row">
                <span class="tracker-label">Large</span>
                ${trackerHTML(car.id, 'large', cnt.large)}
              </div>
              <div class="tracker-row">
                <span class="tracker-label">Mini</span>
                ${trackerHTML(car.id, 'mini', cnt.mini)}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="m8 11h6"/></svg>
          <h3>No cars found</h3>
          <p>Try a different search or filter.</p>
        </div>` : ''}
    </div>`;

  // Wire search
  const searchInput = document.getElementById('dbSearch');
  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { dbQuery = searchInput.value; renderDatabase(appEl); }, 250);
  });
  searchInput.focus();

  // Wire movie filters
  appEl.querySelectorAll('.filter-chip[data-movie]').forEach(chip => {
    chip.addEventListener('click', () => {
      dbMovie = chip.dataset.movie;
      renderDatabase(appEl);
    });
  });

  // Wire card clicks
  appEl.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(`#/bio/${el.dataset.nav}`));
  });

  wireTrackerButtons(appEl);
}

// ── Bio View ──────────────────────────────────────────────────
function renderBio(appEl, id) {
  const char = getCharacter(id);
  if (!char) { navigate('#/database'); return; }

  const cnt = getCarCount(char.id);
  const allChars = getAllCharacters();

  appEl.innerHTML = `
    <div class="bio-page">
      <div style="margin-bottom:20px">
        <a href="#/database" class="btn btn-sm btn-ghost">&larr; Back to Database</a>
      </div>

      <div class="bio-header">
        <div class="bio-image-wrap">
          ${carImageHTML(char)}
        </div>
        <div class="bio-meta">
          ${char.number ? `<span class="bio-number-badge">#${esc(char.number)}</span>` : ''}
          ${char.isCustom ? ' <span class="badge badge-custom">Custom</span>' : ''}
          <h1 class="bio-name">${esc(char.name)}</h1>
          <div class="bio-sponsor">${esc(char.sponsor || 'Unknown')}</div>
          <div class="bio-movies movie-tags">${movieTagsHTML(char.movies)}</div>

          <div class="bio-tracker-box mt-2">
            <h4>My Collection</h4>
            <div class="bio-tracker-row">
              <span class="bio-tracker-label">Large Die-cast</span>
              <div class="bio-tracker-controls">
                <button class="btn-icon btn-icon-sub" data-track="${esc(char.id)}" data-type="large" data-delta="-1">&minus;</button>
                <span class="bio-tracker-count">${cnt.large}</span>
                <button class="btn-icon btn-icon-add" data-track="${esc(char.id)}" data-type="large" data-delta="1">+</button>
              </div>
            </div>
            <div class="bio-tracker-row">
              <span class="bio-tracker-label">Mini Die-cast</span>
              <div class="bio-tracker-controls">
                <button class="btn-icon btn-icon-sub" data-track="${esc(char.id)}" data-type="mini" data-delta="-1">&minus;</button>
                <span class="bio-tracker-count">${cnt.mini}</span>
                <button class="btn-icon btn-icon-add" data-track="${esc(char.id)}" data-type="mini" data-delta="1">+</button>
              </div>
            </div>
          </div>

          <a href="#/edit/${esc(char.id)}" class="btn btn-secondary btn-sm bio-edit-btn">Edit Character</a>
          ${char.isCustom ? `<button class="btn btn-danger btn-sm mt-1" id="deleteCharBtn" style="width:100%">Delete Character</button>` : ''}
        </div>
      </div>

      ${char.bio ? `
      <div class="bio-section">
        <h3>Background</h3>
        <p class="bio-text">${esc(char.bio)}</p>
      </div>` : ''}

      ${char.friends && char.friends.length > 0 ? `
      <div class="bio-section">
        <h3>Friends</h3>
        <div class="friends-list">
          ${char.friends.map(f => {
            const friend = allChars.find(c => c.name === f);
            if (friend) return `<a class="friend-chip" href="#/bio/${esc(friend.id)}">${esc(f)}</a>`;
            return `<span class="friend-chip">${esc(f)}</span>`;
          }).join('')}
        </div>
      </div>` : ''}

      ${char.quotes && char.quotes.length > 0 ? `
      <div class="bio-section">
        <h3>Famous Lines</h3>
        <div class="quotes-list">
          ${char.quotes.map(q => `<div class="quote-item">${esc(q)}</div>`).join('')}
        </div>
      </div>` : ''}
    </div>`;

  wireTrackerButtons(appEl);

  const delBtn = document.getElementById('deleteCharBtn');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      if (confirm(`Delete "${char.name}"? This cannot be undone.`)) {
        deleteCharacter(char.id);
        navigate('#/database');
      }
    });
  }
}

// ── Collection View ───────────────────────────────────────────
let collShowAll = true;

function renderCollection(appEl) {
  const allCars = sortCars(getAllCharacters());
  const display = collShowAll ? allCars : allCars.filter(c => {
    const cnt = getCarCount(c.id);
    return cnt.large > 0 || cnt.mini > 0;
  });
  const stats = getStats(allCars.length);

  appEl.innerHTML = `
    <div class="page">
      <div class="stripe-header">
        <h2>My Collection</h2>
        <p>All cars sorted by number, then name</p>
      </div>

      <div class="collection-controls">
        <button class="btn btn-sm ${collShowAll ? 'btn-primary' : 'btn-ghost'}" id="showAll">Show All</button>
        <button class="btn btn-sm ${!collShowAll ? 'btn-primary' : 'btn-ghost'}" id="showOwned">Owned Only</button>
        <span class="text-muted" style="margin-left:auto;font-size:0.85rem">${stats.uniqueOwned} of ${stats.total} owned</span>
      </div>

      <div class="collection-table-wrap">
        <table class="collection-table">
          <thead>
            <tr>
              <th class="col-thumb"></th>
              <th class="col-number">#</th>
              <th>Name</th>
              <th>Sponsor</th>
              <th class="col-count">Large</th>
              <th class="col-count">Mini</th>
            </tr>
          </thead>
          <tbody>
            ${display.map(car => {
              const cnt = getCarCount(car.id);
              const owned = cnt.large > 0 || cnt.mini > 0;
              const src = resolveImage(car);
              return `
              <tr class="${owned ? 'owned' : ''}" data-nav="${esc(car.id)}">
                <td class="col-thumb">
                  ${src ? `<img class="thumb-img" src="${esc(src)}" alt="" onerror="this.style.display='none'">` :
                    `<div style="width:48px;height:36px;background:${esc(car.color || '#ccc')};border-radius:4px"></div>`}
                </td>
                <td class="col-number">${esc(car.number || 'N/A')}</td>
                <td><strong>${esc(car.name)}</strong></td>
                <td class="text-muted">${esc(car.sponsor || '')}</td>
                <td class="col-count"><span class="count-badge ${cnt.large > 0 ? 'has-items' : ''}">${cnt.large}</span></td>
                <td class="col-count"><span class="count-badge ${cnt.mini > 0 ? 'has-items' : ''}">${cnt.mini}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="collection-footer">
          <div>Total Large: <span>${stats.totalLarge}</span></div>
          <div>Total Mini: <span>${stats.totalMini}</span></div>
          <div>Unique Owned: <span>${stats.uniqueOwned} / ${stats.total}</span></div>
        </div>
      </div>
    </div>`;

  document.getElementById('showAll').addEventListener('click', () => { collShowAll = true; renderCollection(appEl); });
  document.getElementById('showOwned').addEventListener('click', () => { collShowAll = false; renderCollection(appEl); });

  appEl.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(`#/bio/${el.dataset.nav}`));
  });
}

// ── Add / Edit View ───────────────────────────────────────────
function renderAddEdit(appEl, editId) {
  const isEdit = !!editId;
  const char = isEdit ? getCharacter(editId) : null;
  if (isEdit && !char) { navigate('#/database'); return; }

  const f = char || { name: '', number: '', sponsor: '', movies: [], bio: '', friends: [], quotes: [], color: '#c1272d', image: '' };
  const imgSrc = char ? resolveImage(char) : null;

  appEl.innerHTML = `
    <div class="form-page">
      <div style="margin-bottom:20px">
        <a href="${isEdit ? `#/bio/${esc(editId)}` : '#/database'}" class="btn btn-sm btn-ghost">&larr; ${isEdit ? 'Back to Bio' : 'Back to Database'}</a>
      </div>

      <div class="stripe-header">
        <h2>${isEdit ? 'Edit' : 'Add New'} Character</h2>
      </div>

      <form id="charForm">
        <div class="form-group">
          <label for="fName">Name *</label>
          <input class="form-control" id="fName" type="text" value="${esc(f.name)}" required placeholder="e.g. Lightning McQueen">
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group">
            <label for="fNumber">Racing Number</label>
            <input class="form-control" id="fNumber" type="text" value="${esc(f.number || '')}" placeholder="e.g. 95">
          </div>
          <div class="form-group">
            <label for="fSponsor">Sponsor / Team</label>
            <input class="form-control" id="fSponsor" type="text" value="${esc(f.sponsor || '')}" placeholder="e.g. Rust-eze">
          </div>
        </div>

        <div class="form-group">
          <label>Movies</label>
          <div class="checkbox-group">
            <label class="checkbox-label"><input type="checkbox" name="movies" value="Cars" ${f.movies.includes('Cars') ? 'checked' : ''}> Cars</label>
            <label class="checkbox-label"><input type="checkbox" name="movies" value="Cars 2" ${f.movies.includes('Cars 2') ? 'checked' : ''}> Cars 2</label>
            <label class="checkbox-label"><input type="checkbox" name="movies" value="Cars 3" ${f.movies.includes('Cars 3') ? 'checked' : ''}> Cars 3</label>
          </div>
        </div>

        <div class="form-group">
          <label for="fBio">Bio / Background</label>
          <textarea class="form-control" id="fBio" rows="4" placeholder="Tell us about this character...">${esc(f.bio || '')}</textarea>
        </div>

        <div class="form-group">
          <label for="fFriends">Friends</label>
          <input class="form-control" id="fFriends" type="text" value="${esc((f.friends || []).join(', '))}" placeholder="Comma separated: Mater, Sally Carrera">
          <div class="form-hint">Separate names with commas</div>
        </div>

        <div class="form-group">
          <label for="fQuotes">Famous Lines</label>
          <textarea class="form-control" id="fQuotes" rows="3" placeholder="One quote per line">${esc((f.quotes || []).join('\n'))}</textarea>
          <div class="form-hint">One quote per line</div>
        </div>

        <div class="form-group">
          <label>Color</label>
          <div class="color-input-row">
            <input type="color" id="fColor" value="${f.color || '#c1272d'}">
            <span class="text-muted" id="fColorHex">${f.color || '#c1272d'}</span>
          </div>
        </div>

        <div class="form-group">
          <label>Character Image</label>
          <div class="image-upload-area" id="uploadArea">
            ${imgSrc ? `<img class="upload-preview" id="imgPreview" src="${esc(imgSrc)}" alt="Preview">` : '<img class="upload-preview" id="imgPreview" style="display:none" alt="Preview">'}
            <div class="upload-icon" id="uploadIcon" ${imgSrc ? 'style="display:none"' : ''}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div class="upload-text" id="uploadText">${imgSrc ? 'Click or drag to replace image' : 'Click or drag an image here'}</div>
            <input type="file" accept="image/*" id="fImage">
          </div>
        </div>

        <div class="form-actions">
          <a href="${isEdit ? `#/bio/${esc(editId)}` : '#/database'}" class="btn btn-ghost">Cancel</a>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Character'}</button>
        </div>
      </form>
    </div>`;

  // Color picker sync
  const colorInput = document.getElementById('fColor');
  const colorHex   = document.getElementById('fColorHex');
  colorInput.addEventListener('input', () => { colorHex.textContent = colorInput.value; });

  // Image upload
  let imageData = (char && char.image && char.image.startsWith('data:')) ? char.image : '';
  const fileInput  = document.getElementById('fImage');
  const preview    = document.getElementById('imgPreview');
  const uploadIcon = document.getElementById('uploadIcon');
  const uploadText = document.getElementById('uploadText');

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      imageData = e.target.result;
      preview.src = imageData;
      preview.style.display = 'block';
      uploadIcon.style.display = 'none';
      uploadText.textContent = 'Click or drag to replace image';
    };
    reader.readAsDataURL(file);
  });

  // Form submit
  document.getElementById('charForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const name    = document.getElementById('fName').value.trim();
    const number  = document.getElementById('fNumber').value.trim();
    const sponsor = document.getElementById('fSponsor').value.trim();
    const bio     = document.getElementById('fBio').value.trim();
    const friends = document.getElementById('fFriends').value.split(',').map(s => s.trim()).filter(Boolean);
    const quotes  = document.getElementById('fQuotes').value.split('\n').map(s => s.trim()).filter(Boolean);
    const color   = document.getElementById('fColor').value;
    const movies  = [...document.querySelectorAll('input[name="movies"]:checked')].map(cb => cb.value);

    if (!name) { alert('Name is required.'); return; }

    const id = isEdit ? editId : slugify(name);

    const charData = {
      id,
      number,
      name,
      sponsor,
      movies,
      bio,
      friends,
      quotes,
      color,
      image: imageData || (isEdit && char.image && !char.image.startsWith('data:') ? char.image : ''),
      isCustom: isEdit ? (char.isCustom || false) : true,
    };

    saveCharacter(charData);
    navigate(`#/bio/${id}`);
  });
}

// ── Register Routes ───────────────────────────────────────────
onRoute('/dashboard',  renderDashboard);
onRoute('/database',   renderDatabase);
onRoute('/bio/:id',    renderBio);
onRoute('/collection', renderCollection);
onRoute('/add',        (appEl) => renderAddEdit(appEl, null));
onRoute('/edit/:id',   renderAddEdit);

// ── Boot ──────────────────────────────────────────────────────
renderNavbar();
initRouter();
