/**
 * Supabase Storage integration for Cars Universe Collection Tracker.
 * Uses the Supabase JS SDK loaded via CDN in app.html.
 */

const SUPABASE_URL  = 'https://ihvakwzudtqemhdegakj.supabase.co';
const SUPABASE_ANON = 'sb_publishable_bdfyJOJNOHYiaPreNNAVsw_hlt06PP7';
const BUCKET        = 'car-images';

let _client = null;

/** Get or create the Supabase client */
function getClient() {
  if (_client) return _client;
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.warn('Supabase SDK not loaded — image upload/gallery disabled');
    return null;
  }
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _client;
}

/**
 * Upload a compressed image blob to Supabase Storage.
 * @param {string} characterId - Character slug (used as folder name)
 * @param {Blob} blob - Compressed image blob
 * @param {string} ext - File extension (webp, jpg, png)
 * @returns {Promise<string|null>} Public URL of the uploaded image, or null on failure
 */
export async function uploadImage(characterId, blob, ext = 'webp') {
  const client = getClient();
  if (!client) return null;

  const timestamp = Date.now();
  const random    = Math.random().toString(36).slice(2, 8);
  const path      = `${characterId}/${timestamp}-${random}.${ext}`;

  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: blob.type || 'image/webp',
      cacheControl: '31536000',  // 1 year cache
      upsert: false,
    });

  if (error) {
    console.error('Supabase upload error:', error.message);
    return null;
  }

  return getPublicUrl(path);
}

/**
 * List all images for a character.
 * @param {string} characterId - Character slug
 * @returns {Promise<string[]>} Array of public URLs
 */
export async function listImages(characterId) {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client.storage
    .from(BUCKET)
    .list(characterId, { sortBy: { column: 'created_at', order: 'asc' } });

  if (error) {
    console.error('Supabase list error:', error.message);
    return [];
  }

  return (data || [])
    .filter(f => f.name && !f.name.startsWith('.'))
    .map(f => getPublicUrl(`${characterId}/${f.name}`));
}

/**
 * Delete a specific image from storage.
 * @param {string} fullUrl - The public URL of the image
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteImage(fullUrl) {
  const client = getClient();
  if (!client) return false;

  // Extract the storage path from the public URL
  const path = extractPath(fullUrl);
  if (!path) return false;

  const { error } = await client.storage
    .from(BUCKET)
    .remove([path]);

  if (error) {
    console.error('Supabase delete error:', error.message);
    return false;
  }
  return true;
}

/**
 * Get the public URL for a storage path.
 * @param {string} path - Storage path (e.g., "lightning-mcqueen/123456-abc.webp")
 * @returns {string} Full public URL
 */
export function getPublicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

/**
 * Extract the storage path from a full public URL.
 * @param {string} url - Full public URL
 * @returns {string|null} Storage path or null if not a Supabase URL
 */
function extractPath(url) {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
  if (url && url.startsWith(prefix)) {
    return url.slice(prefix.length);
  }
  return null;
}

/** Check if the Supabase SDK is available */
export function isSupabaseReady() {
  return getClient() !== null;
}

/**
 * List all image files across all character folders.
 * @returns {Promise<{path: string, url: string}[]>} Array of {path, url}
 */
export async function listAllImages() {
  const client = getClient();
  if (!client) return [];

  // List top-level folders
  const { data: folders, error: fErr } = await client.storage
    .from(BUCKET)
    .list('', { limit: 1000 });

  if (fErr || !folders) return [];

  const results = [];
  for (const folder of folders) {
    if (!folder.id && folder.name) {
      // It's a folder — list its contents
      const { data: files } = await client.storage
        .from(BUCKET)
        .list(folder.name, { limit: 1000 });

      if (files) {
        for (const f of files) {
          if (f.name && !f.name.startsWith('.')) {
            const path = `${folder.name}/${f.name}`;
            results.push({ path, url: getPublicUrl(path) });
          }
        }
      }
    }
  }
  return results;
}

/**
 * Upload a blob to a specific storage path (overwrite).
 * @param {string} path - Storage path
 * @param {Blob} blob - Image blob
 * @returns {Promise<boolean>} Success
 */
export async function uploadToPath(path, blob) {
  const client = getClient();
  if (!client) return false;

  const { error } = await client.storage
    .from(BUCKET)
    .update(path, blob, {
      contentType: blob.type || 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    });

  if (error) {
    console.error('Supabase overwrite error:', error.message);
    return false;
  }
  return true;
}
