/**
 * config.js — Static configuration
 *
 * Set OMDB_API_KEY here for a "single-source" key, or leave as empty string
 * to make the app prompt the user on first run (key is then stored in
 * LocalStorage). The runtime key (from LocalStorage) ALWAYS takes precedence
 * over this static value, so a user-provided key wins.
 */

export const OMDB_API_KEY = '';  // ← optional: bake-in your key here
export const OMDB_BASE_URL = 'https://www.omdbapi.com/';

// Tunable behavior
export const RESULTS_PER_PAGE = 10;        // OMDB always returns 10/page; documented for clarity
export const SEARCH_DEBOUNCE_MS = 350;
export const HISTORY_LIMIT = 12;
