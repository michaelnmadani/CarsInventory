/**
 * Supabase Database sync for cross-device persistence.
 * Uses the app_data table as a key-value store.
 * localStorage acts as a fast local cache; Supabase is the source of truth.
 */

const SUPABASE_URL  = 'https://ihvakwzudtqemhdegakj.supabase.co';
const SUPABASE_ANON = 'sb_publishable_bdfyJOJNOHYiaPreNNAVsw_hlt06PP7';
const TABLE = 'app_data';

let _client = null;

function getClient() {
  if (_client) return _client;
  if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
    console.warn('Supabase SDK not loaded — sync disabled');
    return null;
  }
  _client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _client;
}

/**
 * Load all app data from Supabase into localStorage.
 * Call once at app startup before rendering.
 */
export async function initSync() {
  const client = getClient();
  if (!client) return;

  try {
    const { data, error } = await client
      .from(TABLE)
      .select('key, value');

    if (error) {
      console.error('Sync: failed to load remote data:', error.message);
      return;
    }

    if (data && data.length > 0) {
      for (const row of data) {
        const remoteVal = JSON.stringify(row.value);
        const localVal = localStorage.getItem(row.key);

        // Remote wins — overwrite local cache
        if (remoteVal !== localVal) {
          localStorage.setItem(row.key, remoteVal);
        }
      }
      console.log(`Sync: loaded ${data.length} keys from Supabase`);
    }
  } catch (err) {
    console.error('Sync: init error:', err);
  }
}

/**
 * Push a localStorage key's value to Supabase (upsert).
 * Called in the background after every local save.
 */
export function syncToRemote(key) {
  const client = getClient();
  if (!client) return;

  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : {};

    client
      .from(TABLE)
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .then(({ error }) => {
        if (error) console.error(`Sync: failed to push "${key}":`, error.message);
      });
  } catch (err) {
    console.error(`Sync: push error for "${key}":`, err);
  }
}
