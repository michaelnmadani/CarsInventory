const COLLECTION_KEY = 'cars_collection';

export function getCollection() {
  try { return JSON.parse(localStorage.getItem(COLLECTION_KEY) || '{}'); }
  catch { return {}; }
}

export function getCarCount(carId) {
  const col = getCollection();
  return col[carId] || { large: 0, mini: 0 };
}

export function updateCarCount(carId, type, delta) {
  const col = getCollection();
  if (!col[carId]) col[carId] = { large: 0, mini: 0 };
  col[carId][type] = Math.max(0, (col[carId][type] || 0) + delta);
  if (col[carId].large === 0 && col[carId].mini === 0) delete col[carId];
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(col));
}

export function getStats(totalChars) {
  const col = getCollection();
  let totalLarge = 0, totalMini = 0, uniqueOwned = 0;
  for (const id in col) {
    const c = col[id];
    totalLarge += c.large || 0;
    totalMini  += c.mini  || 0;
    if ((c.large || 0) > 0 || (c.mini || 0) > 0) uniqueOwned++;
  }
  const pct = totalChars > 0 ? Math.round((uniqueOwned / totalChars) * 100) : 0;
  return { totalLarge, totalMini, uniqueOwned, total: totalChars, pct };
}
