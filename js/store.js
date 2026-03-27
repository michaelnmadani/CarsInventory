import { SEED_CARS } from './data.js';

const CUSTOM_KEY    = 'cars_custom_characters';
const OVERRIDES_KEY = 'cars_character_overrides';

function getCustom() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); }
  catch { return []; }
}

function getOverrides() {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}'); }
  catch { return {}; }
}

/** Return all characters: seed (with overrides applied) + custom */
export function getAllCharacters() {
  const overrides = getOverrides();
  const merged = SEED_CARS.map(c => {
    const ov = overrides[c.id];
    return ov ? { ...c, ...ov } : c;
  });
  return [...merged, ...getCustom()];
}

/** Single character by id */
export function getCharacter(id) {
  return getAllCharacters().find(c => c.id === id) || null;
}

/** Save a character.
 *  - Custom chars (isCustom:true) are stored in the custom list.
 *  - Seed chars have their fields stored as overrides.
 */
export function saveCharacter(char) {
  const isSeed = SEED_CARS.some(c => c.id === char.id);

  if (isSeed) {
    // Store only the editable fields as an override
    const overrides = getOverrides();
    const { id, ...fields } = char;
    overrides[id] = fields;
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } else {
    const customs = getCustom().filter(c => c.id !== char.id);
    customs.push({ ...char, isCustom: true });
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customs));
  }
}

/** Delete a custom character (seed chars cannot be deleted). */
export function deleteCharacter(id) {
  const isSeed = SEED_CARS.some(c => c.id === id);
  if (isSeed) return false;
  const customs = getCustom().filter(c => c.id !== id);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(customs));
  return true;
}

/** Generate a URL-safe slug from a name, avoiding collisions */
export function slugify(name) {
  let base = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const all = getAllCharacters().map(c => c.id);
  if (!all.includes(base)) return base;
  let i = 2;
  while (all.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/** Resolve the primary display image src for a character.
 *  Priority: first gallery image > legacy image field > null */
export function resolveImage(char) {
  // Check gallery images first (Supabase URLs)
  if (char.images && char.images.length > 0) return char.images[0];
  // Legacy single image field
  if (!char.image) return null;
  if (char.image.startsWith('data:') || char.image.startsWith('http')) return char.image;
  return `images/${char.image}`;
}

/** Return all gallery image URLs for a character (Supabase + legacy combined) */
export function resolveGallery(char) {
  const urls = [];
  // Add Supabase gallery images
  if (char.images && char.images.length > 0) {
    urls.push(...char.images);
  }
  // Add legacy image if it exists and isn't already in the gallery
  if (char.image) {
    const legacy = char.image.startsWith('data:') || char.image.startsWith('http')
      ? char.image
      : `images/${char.image}`;
    if (!urls.includes(legacy)) urls.push(legacy);
  }
  return urls;
}
