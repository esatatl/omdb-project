/**
 * api.js — OMDB API client
 *
 * Two endpoints are used:
 *   - search: ?s=<query>&type=&y=&page=  → list of summaries + totalResults
 *   - byId:   ?i=<imdbID>&plot=full      → full details for the modal
 *
 * Notes:
 *   - OMDB returns HTTP 200 even for "not found"; the failure is signalled
 *     via { Response: 'False', Error: '...' }. We normalize that into a
 *     thrown OmdbError so callers can rely on plain try/catch.
 *   - Results are memoized in a small LRU-ish in-memory cache to avoid
 *     re-fetching when the user paginates back-and-forth or re-opens the
 *     same detail.
 */

import { OMDB_API_KEY, OMDB_BASE_URL } from './config.js';
import { getApiKey } from './storage.js';

/* ---------- custom error ---------- */
export class OmdbError extends Error {
  constructor(message, { code = 'OMDB_ERROR', cause } = {}) {
    super(message);
    this.name = 'OmdbError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

/* ---------- in-memory cache (per page-load) ---------- */
const CACHE_MAX = 60;
const cache = new Map();

function cacheGet(key) {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key);
  // refresh recency
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, value);
}

/* ---------- request helpers ---------- */
function resolveKey() {
  // runtime key wins over baked-in static key
  return getApiKey() || OMDB_API_KEY || '';
}

function buildUrl(params) {
  const url = new URL(OMDB_BASE_URL);
  url.searchParams.set('apikey', resolveKey());
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function fetchJson(url, { signal } = {}) {
  let response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new OmdbError('Network error — please check your connection.', { code: 'NETWORK', cause: err });
  }
  if (!response.ok) {
    throw new OmdbError(`HTTP ${response.status} — request failed.`, { code: 'HTTP' });
  }
  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new OmdbError('Bad response from server.', { code: 'PARSE', cause: err });
  }
  // OMDB error envelope
  if (data && data.Response === 'False') {
    const code = (data.Error || '').toLowerCase().includes('not found') ? 'NOT_FOUND'
               : (data.Error || '').toLowerCase().includes('invalid api key') ? 'BAD_KEY'
               : 'OMDB_ERROR';
    throw new OmdbError(data.Error || 'OMDB returned an error.', { code });
  }
  return data;
}

/* ---------- public API ---------- */

/**
 * Search OMDB for a query, optionally filtered by type and year.
 *
 * @param {object} opts
 * @param {string} opts.query  — required, the search term
 * @param {string} [opts.type] — '', 'movie', 'series', 'episode'
 * @param {string|number} [opts.year]
 * @param {number} [opts.page] — 1-based, OMDB caps to ~100
 * @param {AbortSignal} [opts.signal]
 *
 * @returns {Promise<{ results: Array, total: number, page: number }>}
 */
export async function searchMovies({ query, type = '', year = '', page = 1, signal } = {}) {
  if (!query || !query.trim()) {
    throw new OmdbError('Type something to search for.', { code: 'EMPTY' });
  }
  if (!resolveKey()) {
    throw new OmdbError('Missing OMDB API key.', { code: 'NO_KEY' });
  }

  const cacheKey = `s:${query.trim().toLowerCase()}|${type}|${year}|${page}`;
  const hit = cacheGet(cacheKey);
  if (hit) return hit;

  const url = buildUrl({ s: query.trim(), type, y: year, page });
  const data = await fetchJson(url, { signal });

  const result = {
    results: Array.isArray(data.Search) ? data.Search : [],
    total: Number(data.totalResults) || 0,
    page,
  };
  cacheSet(cacheKey, result);
  return result;
}

/**
 * Fetch full details for a single title by IMDb id.
 *
 * @param {string} imdbId
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]
 *
 * @returns {Promise<object>} the OMDB detail object
 */
export async function getMovieById(imdbId, { signal } = {}) {
  if (!imdbId) throw new OmdbError('Missing movie id.', { code: 'EMPTY' });
  if (!resolveKey()) throw new OmdbError('Missing OMDB API key.', { code: 'NO_KEY' });

  const cacheKey = `i:${imdbId}`;
  const hit = cacheGet(cacheKey);
  if (hit) return hit;

  const url = buildUrl({ i: imdbId, plot: 'full' });
  const data = await fetchJson(url, { signal });
  cacheSet(cacheKey, data);
  return data;
}

/** Used by the API-key prompt to verify a user-entered key. */
export async function isApiKeyValid(candidateKey) {
  try {
    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set('apikey', candidateKey);
    url.searchParams.set('s', 'matrix');
    const r = await fetch(url.toString());
    if (!r.ok) return false;
    const data = await r.json();
    // Either we got results, OR we got an error that is NOT "Invalid API key"
    if (data.Response === 'True') return true;
    return !(data.Error || '').toLowerCase().includes('invalid api key');
  } catch {
    return false;
  }
}
