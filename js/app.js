import { isLoggedIn, getAuth, clearAuth } from './auth.js';
import { onRoute, initRouter, navigate } from './router.js';
import { getAllCharacters, getCharacter, saveCharacter, deleteCharacter, slugify, resolveImage, resolveGallery } from './store.js';
import { searchCars } from './search.js';
import { getCarCount, getCarItems, addCarItem, removeCarItem, updateItemPhoto, updateItemStatus, getStats, getAllItems } from './tracker.js';
import { compressImage, blobExtension } from './imageUtils.js';
import { uploadImage, listImages, deleteImage as deleteRemoteImage, isSupabaseReady } from './supabase.js';
import { initSync } from './sync.js';

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
      <a class="nav-link" href="#/mycars" data-route="/mycars">All Cars</a>
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
    <a class="nav-link" href="#/mycars" data-route="/mycars">All Cars</a>
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
    const n = m === 'Cars' ? 1 : m === 'Cars 2' ? 2 : m === 'Cars 3' ? 3 : 4;
    return `<span class="movie-tag movie-tag-${n}">${esc(m)}</span>`;
  }).join('');
}

function trackerHTML(id, type, count) {
  return `<div class="tracker-controls">
    <span class="tracker-count ${count > 0 ? 'has-items' : ''}">${count}</span>
    <button class="btn-icon btn-icon-add" data-add-car="${id}" data-add-type="${type}">+</button>
  </div>`;
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function wireAddCarButtons(el) {
  el.querySelectorAll('[data-add-car]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const charId = btn.dataset.addCar;
      const type   = btn.dataset.addType;
      openAddItemModal(charId, type);
    });
  });
}

// ── Add Item Modal ────────────────────────────────────────────
function openAddItemModal(charId, type) {
  const existing = document.getElementById('addItemModal');
  if (existing) existing.remove();

  const typeLabel = type === 'large' ? 'Large' : 'Mini';
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'addItemModal';
  modal.innerHTML = `
    <div class="modal-card">
      <h3>Add ${typeLabel} Die-cast</h3>
      <div class="form-group">
        <label for="itemName">Name *</label>
        <input class="form-control" id="itemName" type="text" placeholder="e.g. Birthday McQueen" required autofocus>
      </div>
      <div class="form-group">
        <label>Status</label>
        <div class="status-toggle">
          <button type="button" class="status-btn active" id="statusOwned" data-status="owned">&#10003; Owned</button>
          <button type="button" class="status-btn" id="statusUnpurchased" data-status="unpurchased">&#9733; Wishlist</button>
        </div>
      </div>
      <div class="modal-photo-row">
        <span class="text-muted" style="font-size:0.85rem">Want to add a photo?</span>
        <div class="flex-gap">
          <button type="button" class="btn btn-sm btn-primary" id="modalUploadBtn">${uploadIconSVG} Upload</button>
          <button type="button" class="btn btn-sm btn-accent" id="modalCameraBtn">${cameraIconSVG} Camera</button>
        </div>
        <input type="file" accept="image/*" id="modalFileInput" hidden>
        <input type="file" accept="image/*" capture="environment" id="modalCameraInput" hidden>
      </div>
      <div id="modalPhotoPreview" class="modal-photo-preview" style="display:none">
        <img id="modalPreviewImg" src="" alt="Preview">
        <button type="button" class="btn btn-sm btn-ghost" id="modalRemovePhoto">Remove</button>
      </div>
      <div class="form-actions" style="border:none;padding-top:16px;margin-top:8px">
        <button type="button" class="btn btn-ghost" id="modalCancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="modalSave">Save</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  let selectedFile = null;
  let selectedStatus = 'owned';

  const nameInput     = document.getElementById('itemName');
  const fileInput     = document.getElementById('modalFileInput');
  const cameraInput   = document.getElementById('modalCameraInput');
  const previewWrap   = document.getElementById('modalPhotoPreview');
  const previewImg    = document.getElementById('modalPreviewImg');

  // Status toggle
  modal.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedStatus = btn.dataset.status;
      modal.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.getElementById('modalUploadBtn').addEventListener('click', () => fileInput.click());
  document.getElementById('modalCameraBtn').addEventListener('click', () => cameraInput.click());

  function onFile(file) {
    selectedFile = file;
    previewImg.src = URL.createObjectURL(file);
    previewWrap.style.display = 'flex';
  }

  fileInput.addEventListener('change', () => { if (fileInput.files[0]) onFile(fileInput.files[0]); });
  cameraInput.addEventListener('change', () => { if (cameraInput.files[0]) onFile(cameraInput.files[0]); });

  document.getElementById('modalRemovePhoto').addEventListener('click', () => {
    selectedFile = null;
    previewWrap.style.display = 'none';
    previewImg.src = '';
  });

  document.getElementById('modalCancel').addEventListener('click', closeAddItemModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeAddItemModal(); });

  document.getElementById('modalSave').addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); nameInput.style.borderColor = 'var(--color-danger)'; return; }

    let photoUrl = '';
    if (selectedFile) {
      photoUrl = await handlePhotoUpload(selectedFile, charId);
      if (photoUrl) {
        const char = getCharacter(charId);
        if (char) {
          if (!char.images) char.images = [];
          char.images.push(photoUrl);
          saveCharacter(char);
        }
      }
    }

    addCarItem(charId, name, type, photoUrl, selectedStatus);
    closeAddItemModal();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('modalSave').click();
  });
}

function closeAddItemModal() {
  document.getElementById('addItemModal')?.remove();
}

function sortCars(cars) {
  return [...cars].sort((a, b) => {
    const na = a.number ? parseInt(a.number) || 99999 : 99999;
    const nb = b.number ? parseInt(b.number) || 99999 : 99999;
    if (na !== nb) return na - nb;
    return a.name.localeCompare(b.name);
  });
}

// ── Lightbox ──────────────────────────────────────────────────
let lightboxImages = [];
let lightboxIndex  = 0;

function openLightbox(images, startIndex = 0) {
  lightboxImages = images;
  lightboxIndex  = startIndex;

  const existing = document.getElementById('lightbox');
  if (existing) existing.remove();

  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.id = 'lightbox';
  lb.innerHTML = `
    <button class="lightbox-close">&times;</button>
    <button class="lightbox-prev">&larr;</button>
    <img class="lightbox-img" id="lightboxImg" src="${esc(images[startIndex])}">
    <button class="lightbox-next">&rarr;</button>
    <span class="lightbox-counter" id="lightboxCounter">${startIndex + 1} / ${images.length}</span>`;
  document.body.appendChild(lb);

  const img     = document.getElementById('lightboxImg');
  const counter = document.getElementById('lightboxCounter');

  function show(i) {
    lightboxIndex = (i + images.length) % images.length;
    img.src = images[lightboxIndex];
    counter.textContent = `${lightboxIndex + 1} / ${images.length}`;
  }

  lb.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  lb.querySelector('.lightbox-prev').addEventListener('click', () => show(lightboxIndex - 1));
  lb.querySelector('.lightbox-next').addEventListener('click', () => show(lightboxIndex + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });

  document.addEventListener('keydown', lightboxKeyHandler);
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.remove();
  document.removeEventListener('keydown', lightboxKeyHandler);
}

function lightboxKeyHandler(e) {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft')  { lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length; document.getElementById('lightboxImg').src = lightboxImages[lightboxIndex]; document.getElementById('lightboxCounter').textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`; }
  if (e.key === 'ArrowRight') { lightboxIndex = (lightboxIndex + 1) % lightboxImages.length; document.getElementById('lightboxImg').src = lightboxImages[lightboxIndex]; document.getElementById('lightboxCounter').textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`; }
}

// ── Upload spinner ────────────────────────────────────────────
function showSpinner(msg = 'Uploading...') {
  const el = document.createElement('div');
  el.className = 'upload-spinner';
  el.id = 'uploadSpinner';
  el.innerHTML = `<div class="spinner"></div><span>${esc(msg)}</span>`;
  document.body.appendChild(el);
}
function hideSpinner() { document.getElementById('uploadSpinner')?.remove(); }

// ── Photo upload helper ───────────────────────────────────────
async function handlePhotoUpload(file, characterId) {
  if (!file) return null;
  showSpinner('Compressing & uploading...');
  try {
    const blob = await compressImage(file, 800, 0.7);
    const ext  = blobExtension(blob);
    const url  = await uploadImage(characterId, blob, ext);
    if (!url) throw new Error('Upload failed');
    return url;
  } catch (err) {
    console.error('Photo upload error:', err);
    alert('Failed to upload image. Please try again.');
    return null;
  } finally {
    hideSpinner();
  }
}

// Camera icon SVG
const cameraIconSVG = `<svg class="camera-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
const uploadIconSVG = `<svg class="camera-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;

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

  const searchIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;

  // Only build the full shell once; subsequent calls just update the grid
  if (!appEl.querySelector('#dbSearch')) {
    appEl.innerHTML = `
      <div class="page">
        <div class="stripe-header">
          <h2>Cars Database</h2>
          <p id="dbCharCount">${allCars.length} characters from the Cars Universe</p>
        </div>

        <div class="search-bar-row">
          <div class="search-input-wrap">
            ${searchIcon}
            <input class="search-input" id="dbSearch" type="text" placeholder="Search by name, number, sponsor, or movie..." value="${esc(dbQuery)}">
          </div>
          <div class="filter-chips" id="dbFilterChips">
            <button class="filter-chip ${dbMovie === '' ? 'active' : ''}" data-movie="">All</button>
            <button class="filter-chip ${dbMovie === 'Cars' ? 'active' : ''}" data-movie="Cars">Cars</button>
            <button class="filter-chip ${dbMovie === 'Cars 2' ? 'active' : ''}" data-movie="Cars 2">Cars 2</button>
            <button class="filter-chip ${dbMovie === 'Cars 3' ? 'active' : ''}" data-movie="Cars 3">Cars 3</button>
            <button class="filter-chip ${dbMovie === 'COTR' ? 'active' : ''}" data-movie="COTR">COTR</button>
          </div>
        </div>

        <div class="results-count" id="dbResultsCount"></div>
        <div id="dbGridContainer"></div>
      </div>`;

    // Wire search — only once
    const searchInput = document.getElementById('dbSearch');
    let debounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        dbQuery = searchInput.value;
        updateDatabaseGrid(appEl);
      }, 250);
    });

    // Wire movie filters — only once
    document.getElementById('dbFilterChips').addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip[data-movie]');
      if (!chip) return;
      dbMovie = chip.dataset.movie;
      // Update active state
      document.querySelectorAll('#dbFilterChips .filter-chip').forEach(c => c.classList.toggle('active', c.dataset.movie === dbMovie));
      updateDatabaseGrid(appEl);
    });
  }

  updateDatabaseGrid(appEl);
}

function updateDatabaseGrid(appEl) {
  const allCars  = getAllCharacters();
  const filtered = searchCars(allCars, dbQuery, dbMovie);

  const countEl     = document.getElementById('dbResultsCount');
  const containerEl = document.getElementById('dbGridContainer');
  if (!countEl || !containerEl) return;

  countEl.textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;

  containerEl.innerHTML = `
    <div class="cars-grid" id="carsGrid">
      ${filtered.map(car => {
        const cnt = getCarCount(car.id);
        return `
        <div class="car-card" data-id="${esc(car.id)}">
          <div class="car-card-image" data-nav="${esc(car.id)}">
            ${car.number ? `<span class="car-card-number">#${esc(car.number)}</span>` : ''}
            ${carImageHTML(car)}
          </div>
          <div class="car-card-body" data-nav="${esc(car.id)}">
            <div class="car-card-name">${esc(car.name)}</div>
            ${car.sponsor ? `<div class="car-card-sponsor">${esc(car.sponsor)}</div>` : ''}
            <div class="movie-tags">${movieTagsHTML(car.movies)}</div>
          </div>
          <div class="car-card-tracker">
            <span class="tracker-inline ${cnt.large > 0 ? 'has-items' : ''}">L: ${cnt.large}</span>
            <span class="tracker-inline ${cnt.mini > 0 ? 'has-items' : ''}">M: ${cnt.mini}</span>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${filtered.length === 0 ? `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="m8 11h6"/></svg>
        <h3>No cars found</h3>
        <p>Try a different search or filter.</p>
      </div>` : ''}`;

  // Wire card clicks
  containerEl.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(`#/bio/${el.dataset.nav}`));
  });

  wireAddCarButtons(containerEl);
}

// ── Bio View ──────────────────────────────────────────────────
async function renderBio(appEl, id) {
  const char = getCharacter(id);
  if (!char) { navigate('#/database'); return; }

  const cnt = getCarCount(char.id);
  const allChars = getAllCharacters();

  // Build gallery: Supabase remote images + local legacy images
  let galleryUrls = resolveGallery(char);

  // Also fetch any images from Supabase that aren't in the character data yet
  if (isSupabaseReady()) {
    try {
      const remoteUrls = await listImages(char.id);
      for (const url of remoteUrls) {
        if (!galleryUrls.includes(url)) galleryUrls.push(url);
      }
    } catch (e) { console.warn('Could not fetch remote gallery:', e); }
  }

  const hasGallery = galleryUrls.length > 0;

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
          <h1 class="bio-name">${esc(char.name)}</h1>
          ${char.sponsor ? `<div class="bio-sponsor">${esc(char.sponsor)}</div>` : ''}
          <div class="bio-movies-select">
            ${['Cars','Cars 2','Cars 3','COTR'].map(m => {
              const active = (char.movies || []).includes(m);
              const n = m === 'Cars' ? 1 : m === 'Cars 2' ? 2 : m === 'Cars 3' ? 3 : 4;
              return `<button class="movie-chip movie-tag-${n} ${active ? 'active' : ''}" data-movie="${esc(m)}">${esc(m)}</button>`;
            }).join('')}
          </div>

          <div class="bio-tracker-box mt-2">
            <h4>My Collection</h4>
            <div class="bio-tracker-row">
              <span class="bio-tracker-label">Large Die-cast</span>
              <div class="tracker-controls">
                <span class="tracker-count ${cnt.large > 0 ? 'has-items' : ''}">${cnt.large}</span>
                <button class="btn-icon btn-icon-add" data-add-car="${esc(char.id)}" data-add-type="large">+</button>
              </div>
            </div>
            <div class="bio-tracker-row">
              <span class="bio-tracker-label">Mini Die-cast</span>
              <div class="tracker-controls">
                <span class="tracker-count ${cnt.mini > 0 ? 'has-items' : ''}">${cnt.mini}</span>
                <button class="btn-icon btn-icon-add" data-add-car="${esc(char.id)}" data-add-type="mini">+</button>
              </div>
            </div>
          </div>

          <a href="#/edit/${esc(char.id)}" class="btn btn-secondary btn-sm bio-edit-btn">Edit Character</a>
          ${char.isCustom ? `<button class="btn btn-danger btn-sm mt-1" id="deleteCharBtn" style="width:100%">Delete Character</button>` : ''}
        </div>
      </div>

      <div class="bio-section">
        <h3>Photo Gallery</h3>
        <div class="gallery-grid" id="galleryGrid">
          ${hasGallery ? galleryUrls.map((url, i) => {
            const isProfile = resolveImage(char) === url;
            return `
            <div class="gallery-item ${isProfile ? 'is-profile' : ''}" data-gallery-idx="${i}">
              <img src="${esc(url)}" alt="" loading="lazy">
              ${isProfile ? '<span class="gallery-profile-badge">Profile</span>' : ''}
              <div class="gallery-item-actions">
                ${!isProfile ? `<button class="gallery-set-profile" data-gallery-url="${esc(url)}" title="Set as profile picture">&#9733;</button>` : ''}
                <button class="gallery-delete" data-gallery-url="${esc(url)}" title="Delete photo">&times;</button>
              </div>
            </div>`;
          }).join('') : '<div class="gallery-empty">No photos yet. Add one below!</div>'}
        </div>
        <div class="gallery-actions">
          <button class="btn btn-sm btn-primary" id="bioUploadBtn">${uploadIconSVG} Upload Photo</button>
          <button class="btn btn-sm btn-accent" id="bioCameraBtn">${cameraIconSVG} Take Photo</button>
          <input type="file" accept="image/*" id="bioFileInput" hidden>
          <input type="file" accept="image/*" capture="environment" id="bioCameraInput" hidden>
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

      ${(() => {
        const items = getCarItems(char.id);
        const largeItems = items.filter(i => i.type === 'large');
        const miniItems  = items.filter(i => i.type === 'mini');
        if (items.length === 0) return '';

        const ownedLarge = largeItems.filter(i => i.status !== 'unpurchased').length;
        const ownedMini  = miniItems.filter(i => i.status !== 'unpurchased').length;

        function modelRowHTML(item, charId) {
          const isWish = item.status === 'unpurchased';
          return `
          <div class="model-row ${isWish ? 'model-row-wish' : ''}">
            <div class="model-row-photo-wrap">
              ${item.photo
                ? `<img class="model-row-photo" src="${esc(item.photo)}" alt="">`
                : `<div class="model-row-no-photo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`}
              <button class="model-row-change-photo" data-car-id="${esc(charId)}" data-item-id="${esc(item.id)}" title="Change photo">&#128247;</button>
              <input type="file" accept="image/*" class="model-row-file-input" hidden>
              <input type="file" accept="image/*" capture="environment" class="model-row-camera-input" hidden>
            </div>
            <div class="model-row-info">
              <span class="model-row-name">${esc(item.name)}</span>
              <span class="model-row-status ${isWish ? 'status-wish' : 'status-owned'}">${isWish ? 'Wishlist' : 'Owned'}</span>
            </div>
            <div class="model-row-actions">
              ${isWish
                ? `<button class="model-row-mark-owned" data-car-id="${esc(charId)}" data-item-id="${esc(item.id)}" title="Mark as owned">&#10003; Own it</button>`
                : `<button class="model-row-mark-wish" data-car-id="${esc(charId)}" data-item-id="${esc(item.id)}" title="Move to wishlist">&#9733; Wishlist</button>`}
              <button class="model-row-delete" data-car-id="${esc(charId)}" data-item-id="${esc(item.id)}" title="Delete">&times;</button>
            </div>
          </div>`;
        }

        return `
      <div class="bio-section">
        <h3>Tracked Models</h3>
        ${largeItems.length > 0 ? `
        <div class="model-group-header">
          <span>Large Die-casts</span>
          <span class="model-group-count">${ownedLarge} owned${largeItems.length > ownedLarge ? ` · ${largeItems.length - ownedLarge} wishlist` : ''}</span>
        </div>
        <div class="model-list">
          ${largeItems.map(item => modelRowHTML(item, char.id)).join('')}
        </div>` : ''}
        ${miniItems.length > 0 ? `
        <div class="model-group-header" style="${largeItems.length > 0 ? 'margin-top:16px' : ''}">
          <span>Mini Die-casts</span>
          <span class="model-group-count">${ownedMini} owned${miniItems.length > ownedMini ? ` · ${miniItems.length - ownedMini} wishlist` : ''}</span>
        </div>
        <div class="model-list">
          ${miniItems.map(item => modelRowHTML(item, char.id)).join('')}
        </div>` : ''}
      </div>`;
      })()}
    </div>`;

  wireAddCarButtons(appEl);

  // Movie selection chips
  appEl.querySelectorAll('.movie-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const movie = btn.dataset.movie;
      const updated = getCharacter(id);
      if (!updated.movies) updated.movies = [];
      if (updated.movies.includes(movie)) {
        updated.movies = updated.movies.filter(m => m !== movie);
      } else {
        updated.movies.push(movie);
      }
      saveCharacter(updated);
      btn.classList.toggle('active');
    });
  });

  // Remove tracked items (old tile style, kept for safety)
  appEl.querySelectorAll('.tracked-tile-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const carId  = btn.dataset.removeCar;
      const itemId = btn.dataset.removeId;
      if (confirm('Remove this car from your collection?')) {
        removeCarItem(carId, itemId);
        renderBio(appEl, id);
      }
    });
  });

  // Delete model row
  appEl.querySelectorAll('.model-row-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Remove this die-cast?')) {
        removeCarItem(btn.dataset.carId, btn.dataset.itemId);
        renderBio(appEl, id);
      }
    });
  });

  // Mark wishlist → owned
  appEl.querySelectorAll('.model-row-mark-owned').forEach(btn => {
    btn.addEventListener('click', () => {
      updateItemStatus(btn.dataset.carId, btn.dataset.itemId, 'owned');
      renderBio(appEl, id);
    });
  });

  // Mark owned → wishlist
  appEl.querySelectorAll('.model-row-mark-wish').forEach(btn => {
    btn.addEventListener('click', () => {
      updateItemStatus(btn.dataset.carId, btn.dataset.itemId, 'unpurchased');
      renderBio(appEl, id);
    });
  });

  // Change photo on a model row
  appEl.querySelectorAll('.model-row-change-photo').forEach(btn => {
    const row       = btn.closest('.model-row');
    const fileInput = row.querySelector('.model-row-file-input');
    const camInput  = row.querySelector('.model-row-camera-input');
    const carId     = btn.dataset.carId;
    const itemId    = btn.dataset.itemId;

    // Show a small popover with upload/camera options
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Remove any existing popover
      document.querySelectorAll('.photo-popover').forEach(p => p.remove());
      const pop = document.createElement('div');
      pop.className = 'photo-popover';
      pop.innerHTML = `
        <button class="photo-pop-btn" id="popUpload">&#128190; Upload</button>
        <button class="photo-pop-btn" id="popCamera">&#128247; Camera</button>`;
      btn.after(pop);
      pop.querySelector('#popUpload').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); pop.remove(); });
      pop.querySelector('#popCamera').addEventListener('click', (e) => { e.stopPropagation(); camInput.click(); pop.remove(); });
      // Close on outside click
      setTimeout(() => document.addEventListener('click', () => pop.remove(), { once: true }), 0);
    });

    async function onPhotoFile(file) {
      showSpinner('Uploading...');
      const url = await handlePhotoUpload(file, carId);
      if (url) {
        updateItemPhoto(carId, itemId, url);
        // Also add to character gallery
        const updated = getCharacter(carId);
        if (updated) {
          if (!updated.images) updated.images = [];
          if (!updated.images.includes(url)) updated.images.push(url);
          saveCharacter(updated);
        }
      }
      hideSpinner();
      renderBio(appEl, id);
    }

    fileInput.addEventListener('change', () => { if (fileInput.files[0]) onPhotoFile(fileInput.files[0]); });
    camInput.addEventListener('change',  () => { if (camInput.files[0])  onPhotoFile(camInput.files[0]); });
  });

  // Gallery lightbox
  appEl.querySelectorAll('.gallery-item[data-gallery-idx]').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.gallery-delete')) return;
      openLightbox(galleryUrls, parseInt(item.dataset.galleryIdx));
    });
  });

  // Set as profile picture
  appEl.querySelectorAll('.gallery-set-profile').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.galleryUrl;
      const updated = getCharacter(id);
      updated.profileImage = url;
      saveCharacter(updated);
      renderBio(appEl, id);
    });
  });

  // Gallery delete
  appEl.querySelectorAll('.gallery-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const url = btn.dataset.galleryUrl;
      if (!confirm('Delete this photo?')) return;
      showSpinner('Deleting...');
      await deleteRemoteImage(url);
      // Also remove from character's images array and clear profile if needed
      const updated = getCharacter(id);
      if (updated.images && updated.images.includes(url)) {
        updated.images = updated.images.filter(u => u !== url);
      }
      if (updated.profileImage === url) {
        updated.profileImage = '';
      }
      saveCharacter(updated);
      hideSpinner();
      renderBio(appEl, id);
    });
  });

  // Upload photo button
  const bioFileInput   = document.getElementById('bioFileInput');
  const bioCameraInput = document.getElementById('bioCameraInput');

  document.getElementById('bioUploadBtn').addEventListener('click', () => bioFileInput.click());
  document.getElementById('bioCameraBtn').addEventListener('click', () => bioCameraInput.click());

  async function onBioPhotoSelected(file) {
    const url = await handlePhotoUpload(file, char.id);
    if (url) {
      // Save URL to character's images array
      const updated = getCharacter(char.id);
      if (!updated.images) updated.images = [];
      updated.images.push(url);
      saveCharacter(updated);
      renderBio(appEl, id);
    }
  }

  bioFileInput.addEventListener('change', () => { if (bioFileInput.files[0]) onBioPhotoSelected(bioFileInput.files[0]); });
  bioCameraInput.addEventListener('change', () => { if (bioCameraInput.files[0]) onBioPhotoSelected(bioCameraInput.files[0]); });

  // Delete character
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
            <label class="checkbox-label"><input type="checkbox" name="movies" value="COTR" ${f.movies.includes('COTR') ? 'checked' : ''}> COTR</label>
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
          <div style="display:flex;gap:8px;margin-top:10px">
            <button type="button" class="btn btn-sm btn-accent" id="formCameraBtn">${cameraIconSVG} Take Photo</button>
            <input type="file" accept="image/*" capture="environment" id="fCamera" hidden>
          </div>
          <div class="form-hint">Images are compressed and uploaded to cloud storage.</div>
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
  let pendingFile = null;
  const fileInput   = document.getElementById('fImage');
  const cameraInput = document.getElementById('fCamera');
  const preview     = document.getElementById('imgPreview');
  const uploadIcon  = document.getElementById('uploadIcon');
  const uploadText  = document.getElementById('uploadText');

  function showPreview(file) {
    pendingFile = file;
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.style.display = 'block';
    uploadIcon.style.display = 'none';
    uploadText.textContent = 'Image selected — will upload on save';
  }

  fileInput.addEventListener('change', () => { if (fileInput.files[0]) showPreview(fileInput.files[0]); });
  cameraInput.addEventListener('change', () => { if (cameraInput.files[0]) showPreview(cameraInput.files[0]); });
  document.getElementById('formCameraBtn').addEventListener('click', () => cameraInput.click());

  // Form submit
  document.getElementById('charForm').addEventListener('submit', async (e) => {
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

    // Upload image to Supabase if a new file was selected
    let imageUrl = isEdit && char.image ? char.image : '';
    let imagesArr = isEdit && char.images ? [...char.images] : [];

    if (pendingFile) {
      const url = await handlePhotoUpload(pendingFile, id);
      if (url) {
        imagesArr.push(url);
        imageUrl = ''; // No longer need legacy image field
      }
    }

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
      image: imageUrl,
      images: imagesArr,
      isCustom: isEdit ? (char.isCustom || false) : true,
    };

    saveCharacter(charData);
    navigate(`#/bio/${id}`);
  });
}

// ── My Cars View (global) ─────────────────────────────────────
let acStatusFilter = 'all'; // all | owned | wishlist
let acTypeFilter   = 'all'; // all | large | mini
let acSearch       = '';

function renderMyCars(appEl) {
  const allChars = getAllCharacters();
  const charMap = {};
  for (const c of allChars) charMap[c.id] = c;

  // Gather all tracked items across all characters
  let items = getAllItems().map(item => ({
    ...item,
    charName: charMap[item.carId]?.name || item.carId,
    charImg:  charMap[item.carId] ? resolveImage(charMap[item.carId]) : null,
  }));

  // Apply filters
  if (acStatusFilter === 'owned')    items = items.filter(i => i.status !== 'unpurchased');
  if (acStatusFilter === 'wishlist') items = items.filter(i => i.status === 'unpurchased');
  if (acTypeFilter === 'large')      items = items.filter(i => i.type === 'large');
  if (acTypeFilter === 'mini')       items = items.filter(i => i.type === 'mini');
  if (acSearch) {
    const q = acSearch.toLowerCase();
    items = items.filter(i => i.name.toLowerCase().includes(q) || i.charName.toLowerCase().includes(q));
  }

  // Sort: owned first, then type, then character name
  items.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'unpurchased' ? 1 : -1;
    if (a.type !== b.type) return a.type === 'large' ? -1 : 1;
    return a.charName.localeCompare(b.charName);
  });

  const allItems = getAllItems();
  const totalOwned = allItems.filter(i => i.status !== 'unpurchased').length;
  const totalWish  = allItems.filter(i => i.status === 'unpurchased').length;

  function itemTileHTML(item) {
    const isWish = item.status === 'unpurchased';
    return `
    <div class="allcars-tile ${isWish ? 'allcars-tile-wish' : ''}" data-nav="${esc(item.carId)}">
      ${item.photo
        ? `<img class="allcars-tile-photo" src="${esc(item.photo)}" alt="">`
        : item.charImg
          ? `<img class="allcars-tile-photo" src="${esc(item.charImg)}" alt="">`
          : `<div class="allcars-tile-no-photo"></div>`}
      <div class="allcars-tile-info">
        <div class="allcars-tile-name">${esc(item.name)}</div>
        <div class="allcars-tile-char">${esc(item.charName)}</div>
        <div class="allcars-tile-badges">
          <span class="allcars-type-badge">${esc(item.type)}</span>
          <span class="allcars-status-badge ${isWish ? 'wish' : 'owned'}">${isWish ? 'Wishlist' : 'Owned'}</span>
        </div>
      </div>
    </div>`;
  }

  appEl.innerHTML = `
    <div class="page">
      <div class="stripe-header">
        <h2>All Cars</h2>
        <p>${totalOwned} owned · ${totalWish} wishlist</p>
      </div>

      <div class="allcars-filters">
        <input class="allcars-search" id="acSearchInput" type="text" placeholder="Search..." value="${esc(acSearch)}">
        <select class="allcars-select" id="acStatusFilter">
          <option value="all" ${acStatusFilter === 'all' ? 'selected' : ''}>All Status</option>
          <option value="owned" ${acStatusFilter === 'owned' ? 'selected' : ''}>Owned</option>
          <option value="wishlist" ${acStatusFilter === 'wishlist' ? 'selected' : ''}>Wishlist</option>
        </select>
        <select class="allcars-select" id="acTypeFilter">
          <option value="all" ${acTypeFilter === 'all' ? 'selected' : ''}>All Types</option>
          <option value="large" ${acTypeFilter === 'large' ? 'selected' : ''}>Large</option>
          <option value="mini" ${acTypeFilter === 'mini' ? 'selected' : ''}>Mini</option>
        </select>
        <span class="allcars-count">${items.length} result${items.length !== 1 ? 's' : ''}</span>
      </div>

      ${items.length === 0 ? `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
          <h3>No die-casts here</h3>
          <p>Add die-casts from any character's profile page.</p>
        </div>` :
        `<div class="allcars-grid">
          ${items.map(itemTileHTML).join('')}
        </div>`}
    </div>`;

  // Search input
  let acDebounce;
  document.getElementById('acSearchInput').addEventListener('input', (e) => {
    acSearch = e.target.value;
    clearTimeout(acDebounce);
    acDebounce = setTimeout(() => renderMyCars(appEl), 200);
  });

  // Dropdown filters
  document.getElementById('acStatusFilter').addEventListener('change', (e) => {
    acStatusFilter = e.target.value;
    renderMyCars(appEl);
  });
  document.getElementById('acTypeFilter').addEventListener('change', (e) => {
    acTypeFilter = e.target.value;
    renderMyCars(appEl);
  });

  // Navigate to character bio on tile click
  appEl.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(`#/bio/${el.dataset.nav}`));
  });
}

// ── Register Routes ───────────────────────────────────────────
onRoute('/dashboard',  renderDashboard);
onRoute('/database',   renderDatabase);
onRoute('/bio/:id',    renderBio);
onRoute('/collection', renderCollection);
onRoute('/mycars',     renderMyCars);
onRoute('/add',        (appEl) => renderAddEdit(appEl, null));
onRoute('/edit/:id',   renderAddEdit);

// ── Boot ──────────────────────────────────────────────────────
renderNavbar();

// Load remote data before first render, then start router
initSync().then(() => {
  initRouter();
});
