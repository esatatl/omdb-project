/**
 * main.js — App orchestration
 *
 * Wires the DOM (ui.js) to the network (api.js) and to persistence
 * (storage.js). Owns the only mutable runtime state on the page —
 * `state` — which is the single source of truth for what's currently
 * displayed.
 *
 * URL strategy:
 *   The current search is mirrored to the query string (?q=&type=&year=&page=)
 *   so links are shareable, the back button is meaningful, and a refresh
 *   restores the view. LocalStorage is the fallback when there are no URL
 *   params (e.g., user typed in the bare app URL).
 */

import {
  searchMovies, getMovieById, isApiKeyValid, OmdbError,
} from './api.js';
import * as ui from './ui.js';
import {
  getApiKey, setApiKey,
  getLastState, setLastState,
  getHistory, addHistoryEntry, removeHistoryEntry, clearHistory,
} from './storage.js';

/* ---------- runtime state ---------- */
const state = {
  query: '',
  type:  '',
  year:  '',
  page:  1,
  total: 0,
  /** AbortController for the in-flight search, so a fast typer doesn't get stale results. */
  inflight: null,
};

/* ---------- URL <-> state sync ---------- */
function readURL() {
  const p = new URLSearchParams(location.search);
  return {
    query: p.get('q') || '',
    type:  p.get('type') || '',
    year:  p.get('year') || '',
    page:  Math.max(1, Number(p.get('page')) || 1),
  };
}

function writeURL({ query, type, year, page }, { replace = false } = {}) {
  const p = new URLSearchParams();
  if (query) p.set('q', query);
  if (type)  p.set('type', type);
  if (year)  p.set('year', year);
  if (page > 1) p.set('page', String(page));

  const newSearch = p.toString();
  const newURL = `${location.pathname}${newSearch ? '?' + newSearch : ''}`;
  if (newURL === location.pathname + location.search) return;
  if (replace) history.replaceState(null, '', newURL);
  else         history.pushState(null, '', newURL);
}

/* ---------- core: run a search ---------- */
async function runSearch({ updateURL = true, pushUrl = true } = {}) {
  const { query, type, year, page } = state;

  if (!query) {
    ui.showWelcome();
    return;
  }

  // Cancel any in-flight request — last one in wins
  state.inflight?.abort();
  state.inflight = new AbortController();

  ui.showLoading();
  if (updateURL) writeURL({ query, type, year, page }, { replace: !pushUrl });

  try {
    const { results, total } = await searchMovies({
      query, type, year, page, signal: state.inflight.signal,
    });

    state.total = total;
    ui.renderActiveSearch({ query, type, year, total, page });
    ui.renderResults(results, openDetail);
    ui.renderPagination({ page, total });

    // Persist the latest *successful* search state
    setLastState({ query, type, year, page });
    addHistoryEntry({ query, type, year });
  } catch (err) {
    if (err.name === 'AbortError') return; // superseded
    handleSearchError(err);
  }
}

function handleSearchError(err) {
  const code = err instanceof OmdbError ? err.code : '';
  if (code === 'NOT_FOUND') {
    ui.showError({
      title: 'No matches found',
      message: `Nothing on OMDB for “${state.query}”${state.year ? ` in ${state.year}` : ''}. Try a different title or clear filters.`,
    });
    return;
  }
  if (code === 'BAD_KEY' || code === 'NO_KEY') {
    ui.showError({
      title: 'API key issue',
      message: 'Your OMDB key is missing or invalid. Reopen the key dialog to update it.',
    });
    ui.openKeyModal();
    return;
  }
  if (code === 'NETWORK') {
    ui.showError({ title: 'You appear to be offline', message: 'Check your connection and try again.' });
    return;
  }
  ui.showError({ title: 'Something went wrong', message: err.message || 'Please try again.' });
}

/* ---------- detail modal ---------- */
let detailController;
async function openDetail(imdbId) {
  detailController?.abort();
  detailController = new AbortController();
  ui.renderDetailLoading();
  try {
    const movie = await getMovieById(imdbId, { signal: detailController.signal });
    ui.renderDetail(movie);
  } catch (err) {
    if (err.name === 'AbortError') return;
    ui.renderDetailError(err.message || 'Failed to load.');
  }
}

/* ---------- event wiring ---------- */
function wire() {
  // Form submit
  ui.els.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const { query, type, year } = ui.getFormValues();
    if (!query) return;
    Object.assign(state, { query, type, year, page: 1 });
    runSearch();
  });

  // Filter change → re-search if there's an active query
  for (const el of [ui.els.typeFilter, ui.els.yearFilter]) {
    el.addEventListener('change', () => {
      const { query, type, year } = ui.getFormValues();
      if (!query) return;
      Object.assign(state, { query, type, year, page: 1 });
      runSearch();
    });
  }

  // Clear filters
  ui.els.clearFilters.addEventListener('click', () => {
    ui.els.typeFilter.value = '';
    ui.els.yearFilter.value = '';
    if (state.query) {
      state.type = ''; state.year = ''; state.page = 1;
      runSearch();
    }
  });

  // Pagination
  ui.els.prevPage.addEventListener('click', () => {
    if (state.page > 1) { state.page--; runSearch(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  ui.els.nextPage.addEventListener('click', () => {
    state.page++; runSearch(); window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Detail modal close
  ui.els.modalClose.addEventListener('click', () => ui.closeDetail());
  // Click backdrop to close
  ui.els.detailModal.addEventListener('click', (e) => {
    if (e.target === ui.els.detailModal) ui.closeDetail();
  });

  // History modal — one helper, used by every action that mutates the list
  const refreshHistory = () => {
    ui.renderHistory(getHistory(), {
      onPick: (entry) => {
        ui.closeHistory();
        ui.setFormValues({ query: entry.query, type: entry.type, year: entry.year });
        Object.assign(state, { query: entry.query, type: entry.type, year: entry.year, page: 1 });
        runSearch();
      },
      onRemove: (idx) => {
        removeHistoryEntry(idx);
        refreshHistory();
      },
    });
  };
  ui.els.historyBtn.addEventListener('click', () => {
    refreshHistory();
    ui.openHistory();
  });
  ui.els.historyClose.addEventListener('click', () => ui.closeHistory());
  ui.els.historyModal.addEventListener('click', (e) => {
    if (e.target === ui.els.historyModal) ui.closeHistory();
  });
  ui.els.clearHistory.addEventListener('click', () => {
    clearHistory();
    refreshHistory();
    ui.toast('History cleared');
  });

  // API key modal
  ui.els.keyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const candidate = ui.els.keyInput.value.trim();
    if (!candidate) return;
    ui.els.keyInput.disabled = true;
    const valid = await isApiKeyValid(candidate);
    ui.els.keyInput.disabled = false;
    if (!valid) {
      ui.toast('That key didn\'t validate — please double-check.');
      return;
    }
    setApiKey(candidate);
    ui.closeKeyModal();
    ui.toast('API key saved');
    if (state.query) runSearch();
  });

  // Browser back/forward — re-read URL and run
  window.addEventListener('popstate', () => {
    const fromUrl = readURL();
    Object.assign(state, fromUrl);
    ui.setFormValues(fromUrl);
    if (fromUrl.query) runSearch({ updateURL: false });
    else ui.showWelcome();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ignore when typing in inputs (except for Esc, handled by <dialog>)
    const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
    if (e.key === '/' && !inField) {
      e.preventDefault();
      ui.focusSearch();
    } else if (e.key.toLowerCase() === 'h' && !inField && !e.metaKey && !e.ctrlKey) {
      ui.els.historyBtn.click();
    }
  });
}

/* ---------- bootstrap ---------- */
function init() {
  wire();

  // 1) URL takes priority — shareable links work
  // 2) Otherwise, last saved state restores the previous session
  const fromUrl  = readURL();
  const fromDisk = getLastState();
  const initial  = fromUrl.query ? fromUrl : (fromDisk || null);

  if (initial && initial.query) {
    Object.assign(state, initial);
    ui.setFormValues(initial);
    // Don't push a new history entry on first load; replace instead
    runSearch({ pushUrl: false });
  } else {
    ui.showWelcome();
  }

  // If we have no API key at all, ask before the user even tries
  if (!getApiKey()) {
    // Defer so welcome screen renders first
    setTimeout(() => ui.openKeyModal(), 200);
  }
}

document.addEventListener('DOMContentLoaded', init);
