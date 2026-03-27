import { syncToRemote } from './sync.js';

const COLLECTION_KEY = 'cars_collection';

/**
 * Collection schema:
 * {
 *   "lightning-mcqueen": {
 *     items: [
 *       { id: "abc123", name: "Birthday McQueen", type: "large", photo: "https://..." },
 *       { id: "def456", name: "Mini #3", type: "mini", photo: "" },
 *     ]
 *   }
 * }
 */

export function getCollection() {
  try {
    const raw = JSON.parse(localStorage.getItem(COLLECTION_KEY) || '{}');
    // Migrate old format { large: N, mini: N } → new items[] format
    for (const id in raw) {
      if (!raw[id].items) {
        const old = raw[id];
        const items = [];
        for (let i = 0; i < (old.large || 0); i++) items.push({ id: genId(), name: `Large #${i+1}`, type: 'large', photo: '' });
        for (let i = 0; i < (old.mini || 0); i++)  items.push({ id: genId(), name: `Mini #${i+1}`, type: 'mini', photo: '' });
        raw[id] = { items };
      }
    }
    return raw;
  } catch { return {}; }
}

function save(col) {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(col));
  syncToRemote(COLLECTION_KEY);
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Get counts for a character — only owned items count toward totals */
export function getCarCount(carId) {
  const col = getCollection();
  const entry = col[carId];
  if (!entry || !entry.items) return { large: 0, mini: 0 };
  const owned = entry.items.filter(i => i.status !== 'unpurchased');
  return {
    large: owned.filter(i => i.type === 'large').length,
    mini:  owned.filter(i => i.type === 'mini').length,
  };
}

/** Get all tracked items across every character (for All Cars page) */
export function getAllItems() {
  const col = getCollection();
  const result = [];
  for (const carId in col) {
    const items = col[carId]?.items || [];
    for (const item of items) {
      result.push({ ...item, carId });
    }
  }
  return result;
}

/** Get all tracked items for a character */
export function getCarItems(carId) {
  const col = getCollection();
  return col[carId]?.items || [];
}

/** Add a new tracked item */
export function addCarItem(carId, name, type, photo = '', status = 'owned') {
  const col = getCollection();
  if (!col[carId]) col[carId] = { items: [] };
  col[carId].items.push({ id: genId(), name, type, photo, status });
  save(col);
}

/** Remove a tracked item by its unique id */
export function removeCarItem(carId, itemId) {
  const col = getCollection();
  if (!col[carId]) return;
  col[carId].items = col[carId].items.filter(i => i.id !== itemId);
  if (col[carId].items.length === 0) delete col[carId];
  save(col);
}

/** Update photo URL on an existing item */
export function updateItemPhoto(carId, itemId, photo) {
  const col = getCollection();
  if (!col[carId]) return;
  const item = col[carId].items.find(i => i.id === itemId);
  if (item) item.photo = photo;
  save(col);
}

/** Update the status of an existing item */
export function updateItemStatus(carId, itemId, status) {
  const col = getCollection();
  if (!col[carId]) return;
  const item = col[carId].items.find(i => i.id === itemId);
  if (item) item.status = status;
  save(col);
}

export function getStats(totalChars) {
  const col = getCollection();
  let totalLarge = 0, totalMini = 0, uniqueOwned = 0;
  for (const id in col) {
    const items = (col[id]?.items || []).filter(i => i.status !== 'unpurchased');
    const large = items.filter(i => i.type === 'large').length;
    const mini  = items.filter(i => i.type === 'mini').length;
    totalLarge += large;
    totalMini  += mini;
    if (large > 0 || mini > 0) uniqueOwned++;
  }
  const pct = totalChars > 0 ? Math.round((uniqueOwned / totalChars) * 100) : 0;
  return { totalLarge, totalMini, uniqueOwned, total: totalChars, pct };
}
