/**
 * ui.js — All DOM rendering & state-screen transitions
 *
 * Pure-ish: every function takes the data it needs and the elements
 * it should write to. No global state lives here — the orchestration
 * (what to render and when) is `main.js`'s job.
 */

import { RESULTS_PER_PAGE } from './config.js';

/* ---------- element refs (collected once at startup) ---------- */
export const els = {
  searchForm:    document.getElementById('searchForm'),
  searchInput:   document.getElementById('searchInput'),
  typeFilter:    document.getElementById('typeFilter'),
  yearFilter:    document.getElementById('yearFilter'),
  clearFilters:  document.getElementById('clearFilters'),

  stateStrip:    document.getElementById('stateStrip'),
  activeQuery:   document.getElementById('activeQuery'),
  activeMeta:    document.getElementById('activeMeta'),

  welcomeState:  document.getElementById('welcomeState'),
  loadingState:  document.getElementById('loadingState'),
  errorState:    document.getElementById('errorState'),
  errorTitle:    document.getElementById('errorTitle'),
  errorMessage:  document.getElementById('errorMessage'),

  resultsGrid:   document.getElementById('resultsGrid'),
  pagination:    document.getElementById('pagination'),
  prevPage:      document.getElementById('prevPage'),
  nextPage:      document.getElementById('nextPage'),
  pageInfo:      document.getElementById('pageInfo'),

  detailModal:   document.getElementById('detailModal'),
  modalBody:     document.getElementById('modalBody'),
  modalClose:    document.getElementById('modalClose'),

  historyBtn:    document.getElementById('historyBtn'),
  historyModal:  document.getElementById('historyModal'),
  historyList:   document.getElementById('historyList'),
  historyClose:  document.getElementById('historyClose'),
  clearHistory:  document.getElementById('clearHistory'),

  keyModal:      document.getElementById('keyModal'),
  keyForm:       document.getElementById('keyForm'),
  keyInput:      document.getElementById('keyInput'),

  toast:         document.getElementById('toast'),
};

/* ---------- helpers ---------- */
const VALID_POSTER = url => url && url !== 'N/A';

/** HTML-escape any string before injecting via innerHTML. */
function esc(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/** Render a poster <img> or a graceful fallback. */
function posterMarkup(poster, title, classes = 'card__poster') {
  if (VALID_POSTER(poster)) {
    return `<div class="${classes}"><img src="${esc(poster)}" alt="Poster of ${esc(title)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'${classes} ${classes}--empty',textContent:'?'}))" /></div>`;
  }
  return `<div class="${classes} ${classes}--empty" aria-hidden="true">?</div>`;
}

/* ---------- state-screen orchestration ---------- */

/** Hide every state region. The caller will then show exactly one. */
function hideAllStates() {
  els.welcomeState.hidden = true;
  els.loadingState.hidden = true;
  els.errorState.hidden = true;
  els.resultsGrid.hidden = true;
  els.pagination.hidden = true;
}

export function showWelcome() {
  hideAllStates();
  els.welcomeState.hidden = false;
  els.stateStrip.hidden = true;
}

export function showLoading() {
  hideAllStates();
  // Inject 10 skeleton cards on first call, reuse afterwards
  if (!els.loadingState.children.length) {
    els.loadingState.innerHTML = Array.from({ length: RESULTS_PER_PAGE }, () => `
      <div class="skeleton">
        <div class="skeleton__poster"></div>
        <div class="skeleton__line"></div>
        <div class="skeleton__line skeleton__line--short"></div>
      </div>
    `).join('');
  }
  els.loadingState.hidden = false;
}

export function showError({ title = 'Something went wrong', message = 'Please try again.' } = {}) {
  hideAllStates();
  els.errorTitle.textContent = title;
  els.errorMessage.textContent = message;
  els.errorState.hidden = false;
}

/* ---------- results & state-strip ---------- */

export function renderActiveSearch({ query, type, year, total, page }) {
  els.activeQuery.textContent = query;
  const parts = [];
  if (type)  parts.push(type[0].toUpperCase() + type.slice(1));
  if (year)  parts.push(year);
  if (total) parts.push(`${total.toLocaleString()} results`);
  if (page > 1) parts.push(`page ${page}`);
  els.activeMeta.textContent = parts.length ? `· ${parts.join(' · ')}` : '';
  els.stateStrip.hidden = false;
}

export function renderResults(items, onCardClick) {
  hideAllStates();
  els.resultsGrid.innerHTML = items.map(item => {
    const typeLabel = item.Type ? esc(item.Type) : '';
    return `
      <button class="card" type="button" data-id="${esc(item.imdbID)}">
        ${posterMarkup(item.Poster, item.Title)}
        ${typeLabel ? `<span class="card__type">${typeLabel}</span>` : ''}
        <div class="card__body">
          <h3 class="card__title">${esc(item.Title)}</h3>
          <p class="card__year">${esc(item.Year || '')}</p>
        </div>
      </button>
    `;
  }).join('');

  // Attach a single delegated listener
  els.resultsGrid.onclick = (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    onCardClick(card.dataset.id);
  };

  els.resultsGrid.hidden = false;
}

export function renderPagination({ page, total }) {
  const totalPages = Math.max(1, Math.ceil(total / RESULTS_PER_PAGE));
  if (totalPages <= 1) {
    els.pagination.hidden = true;
    return;
  }
  els.prevPage.disabled = page <= 1;
  els.nextPage.disabled = page >= totalPages;
  els.pageInfo.textContent = `Page ${page} of ${totalPages}`;
  els.pagination.hidden = false;
}

/* ---------- detail modal ---------- */

export function renderDetailLoading() {
  els.modalBody.innerHTML = `
    <div class="detail">
      <div class="skeleton__poster" style="border-radius: 0;"></div>
      <div class="detail__content">
        <div class="skeleton__line" style="margin-left:0;width:30%"></div>
        <div class="skeleton__line" style="margin-left:0;width:80%;height:24px"></div>
        <div class="skeleton__line" style="margin-left:0;width:50%"></div>
        <div class="skeleton__line" style="margin-left:0;width:100%"></div>
        <div class="skeleton__line" style="margin-left:0;width:90%"></div>
        <div class="skeleton__line" style="margin-left:0;width:70%"></div>
      </div>
    </div>
  `;
  if (!els.detailModal.open) els.detailModal.showModal();
}

export function renderDetail(movie) {
  const ratings = (movie.imdbRating && movie.imdbRating !== 'N/A')
    ? `<span class="detail__rating">★ ${esc(movie.imdbRating)}</span>` : '';

  // Sub-line builder (year · runtime · rated · type)
  const subItems = [
    movie.Year, movie.Runtime, movie.Rated,
    movie.Type ? movie.Type.charAt(0).toUpperCase() + movie.Type.slice(1) : null,
  ].filter(v => v && v !== 'N/A');
  const subHTML = subItems.map(esc).join('<span class="dot"></span>');

  // Meta grid (label/value pairs)
  const metaPairs = [
    ['Genre',    movie.Genre],
    ['Director', movie.Director],
    ['Writer',   movie.Writer],
    ['Cast',     movie.Actors],
    ['Released', movie.Released],
    ['Country',  movie.Country],
    ['Language', movie.Language],
    ['Awards',   movie.Awards],
    ['Box office', movie.BoxOffice],
  ].filter(([, v]) => v && v !== 'N/A');

  const metaHTML = metaPairs.map(([label, value]) => `
    <div class="meta-item">
      <dt>${esc(label)}</dt>
      <dd>${esc(value)}</dd>
    </div>
  `).join('');

  const posterHTML = VALID_POSTER(movie.Poster)
    ? `<div class="detail__poster"><img src="${esc(movie.Poster)}" alt="Poster of ${esc(movie.Title)}"/></div>`
    : `<div class="detail__poster detail__poster--empty">?</div>`;

  els.modalBody.innerHTML = `
    <div class="detail">
      ${posterHTML}
      <div class="detail__content">
        ${movie.Type ? `<span class="detail__type">${esc(movie.Type)}</span>` : ''}
        <h2 class="detail__title" id="modalTitle">${esc(movie.Title)}</h2>
        <p class="detail__sub">
          ${subHTML}
          ${ratings ? `<span class="dot"></span>${ratings}` : ''}
        </p>
        ${movie.Plot && movie.Plot !== 'N/A' ? `<p class="detail__plot">${esc(movie.Plot)}</p>` : ''}
        ${metaHTML ? `<dl class="detail__meta">${metaHTML}</dl>` : ''}
      </div>
    </div>
  `;
}

export function renderDetailError(message) {
  els.modalBody.innerHTML = `
    <div class="placeholder placeholder--error" style="padding: 60px 20px;">
      <div class="placeholder__icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
      </div>
      <h3>Couldn't load details</h3>
      <p>${esc(message)}</p>
    </div>
  `;
}

export function closeDetail() {
  if (els.detailModal.open) els.detailModal.close();
}

/* ---------- history modal ---------- */

export function renderHistory(history, { onPick, onRemove }) {
  if (!history.length) {
    els.historyList.innerHTML = `<li class="history-empty">No searches yet.</li>`;
    return;
  }
  els.historyList.innerHTML = history.map((entry, idx) => {
    const tags = [entry.type, entry.year].filter(Boolean).map(esc).join(' · ');
    return `
      <li class="history-item" data-idx="${idx}" data-action="pick">
        <span class="history-item__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        </span>
        <span class="history-item__info">
          <div class="history-item__query">${esc(entry.query)}</div>
          ${tags ? `<div class="history-item__meta">${tags}</div>` : ''}
        </span>
        <button class="history-item__remove" data-action="remove" aria-label="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </li>
    `;
  }).join('');

  els.historyList.onclick = (e) => {
    const removeBtn = e.target.closest('[data-action="remove"]');
    if (removeBtn) {
      const item = removeBtn.closest('.history-item');
      onRemove(Number(item.dataset.idx));
      e.stopPropagation();
      return;
    }
    const item = e.target.closest('.history-item');
    if (!item) return;
    onPick(history[Number(item.dataset.idx)]);
  };
}

export function openHistory()  { if (!els.historyModal.open) els.historyModal.showModal(); }
export function closeHistory() { if (els.historyModal.open)  els.historyModal.close(); }

/* ---------- API key modal ---------- */

export function openKeyModal()  { if (!els.keyModal.open) els.keyModal.showModal(); }
export function closeKeyModal() { if (els.keyModal.open)  els.keyModal.close(); }

/* ---------- toast ---------- */

let toastTimer;
export function toast(message, { duration = 2400 } = {}) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, duration);
}

/* ---------- form helpers ---------- */

export function setFormValues({ query = '', type = '', year = '' }) {
  els.searchInput.value = query;
  els.typeFilter.value = type;
  els.yearFilter.value = year;
}

export function getFormValues() {
  return {
    query: els.searchInput.value.trim(),
    type:  els.typeFilter.value,
    year:  els.yearFilter.value.trim(),
  };
}

export function focusSearch() {
  els.searchInput.focus();
  els.searchInput.select();
}
