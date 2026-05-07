/**
 * storage.js — Thin LocalStorage wrapper
 *
 * Persists:
 *   - the user's OMDB API key (so we don't ask twice)
 *   - the last search state (query + filters + page) so a refresh
 *     restores the previous view
 *   - a short search history for the History drawer
 *
 * All accessors return safe defaults if storage is unavailable or
 * corrupt, so the UI never has to handle a `try/catch`.
 */

import { HISTORY_LIMIT } from './config.js';

const KEYS = {
  apiKey:    'reel.apiKey',
  lastState: 'reel.lastState',
  history:   'reel.history',
};

/* ---------- low-level helpers ---------- */
function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded, private mode, etc. — degrade gracefully
    return false;
  }
}

function safeRemove(key) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

/* ---------- API key ---------- */
export function getApiKey()      { return safeGet(KEYS.apiKey) ?? ''; }
export function setApiKey(value) { return safeSet(KEYS.apiKey, value); }
export function clearApiKey()    { safeRemove(KEYS.apiKey); }

/* ---------- Last search state ----------
 * Shape: { query, type, year, page }
 */
export function getLastState() {
  const s = safeGet(KEYS.lastState);
  if (!s || typeof s !== 'object' || !s.query) return null;
  return {
    query: String(s.query),
    type:  s.type  || '',
    year:  s.year  || '',
    page:  Number(s.page) || 1,
  };
}

export function setLastState(state) {
  if (!state || !state.query) return;
  safeSet(KEYS.lastState, state);
}

export function clearLastState() { safeRemove(KEYS.lastState); }

/* ---------- Search history ----------
 * Shape: Array<{ query, type, year, ts }>
 *
 * Latest first, deduped by (query|type|year), capped at HISTORY_LIMIT.
 */
export function getHistory() {
  const list = safeGet(KEYS.history);
  return Array.isArray(list) ? list : [];
}

export function addHistoryEntry({ query, type = '', year = '' }) {
  if (!query) return;
  const key = `${query}|${type}|${year}`.toLowerCase();
  const list = getHistory().filter(e => `${e.query}|${e.type}|${e.year}`.toLowerCase() !== key);
  list.unshift({ query, type, year, ts: Date.now() });
  if (list.length > HISTORY_LIMIT) list.length = HISTORY_LIMIT;
  safeSet(KEYS.history, list);
}

export function removeHistoryEntry(index) {
  const list = getHistory();
  if (index < 0 || index >= list.length) return;
  list.splice(index, 1);
  safeSet(KEYS.history, list);
}

export function clearHistory() { safeRemove(KEYS.history); }
