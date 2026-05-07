# Reel — Cinema Search

A fully responsive Single Page Application that consumes the [OMDB API](http://www.omdbapi.com/) to search and browse movies, series, and episodes.

Built with **vanilla HTML, CSS, and JavaScript** — no build step, no frameworks.

> Submitted for the i2i Systems web-development coding challenge.

---

## ✨ Features

### Required
- 🔎 **Search** by movie/series title with submit-on-enter
- 🎬 **Detail view** showing title, year, genre, director, poster — plus full plot, cast, ratings, runtime, country, awards, and box office
- ⚠️ **Clear error handling** for not-found, network failures, and invalid API keys
- 🔁 **Multiple searches** without page refresh
- 💾 **State persistence** — refresh the page and your last search restores (LocalStorage **and** URL params, so links are shareable too)
- 📱 **Fully responsive** — phones, tablets, desktops

### Bonus
- 🎛️ **Filters** for type (movie/series/episode) and release year — *à la* sahibinden.com
- 📑 **Pagination** with page count
- 🕘 **Search history** drawer (last 12 searches, deduped, individually removable)
- ⌨️ **Keyboard shortcuts**: `/` focuses the search box, `H` opens history, `Esc` closes dialogs
- 🦴 **Loading skeletons** instead of spinners
- ⚡ **In-memory caching** to avoid duplicate API calls when paginating back-and-forth
- 🛑 **Request cancellation** — fast typers don't get stale results
- 🎨 **Editorial cinema aesthetic** — Fraunces + Bricolage Grotesque, warm amber accents, subtle film-grain overlay
- ♿ Accessible: semantic HTML, `prefers-reduced-motion`, focus styles, ARIA labels, native `<dialog>`

---

## 🚀 Live demo

> 👉 **https://YOUR-USERNAME.github.io/i2i-systems-omdb-example/**

*(Update this URL after enabling GitHub Pages — see [Deployment](#-deployment) below.)*

---

## 🏃 Run locally

The app is a static site — no install, no build.

```bash
# 1. Clone
git clone https://github.com/YOUR-USERNAME/i2i-systems-omdb-example.git
cd i2i-systems-omdb-example

# 2. Serve (any static server works; pick one):
python3 -m http.server 8000
#   or
npx serve .
#   or
npx http-server -p 8000

# 3. Open http://localhost:8000
```

> ⚠️ **Don't** open `index.html` directly via `file://` — ES module imports need an HTTP origin to work.

### OMDB API key

You need a free OMDB key. Two ways to provide it:

1. **In-app prompt (recommended)** — on first load the app asks for your key and saves it to `localStorage`. Each visitor uses their own.
2. **Bake it in** — set `OMDB_API_KEY` in [`js/config.js`](js/config.js). The runtime key (LocalStorage) still wins, so users can override.

Get a key at <https://www.omdbapi.com/apikey.aspx> (it arrives in your inbox in seconds).

---

## 🚢 Deployment (GitHub Pages)

This project is a static site — perfect for GitHub Pages.

1. Push this repo to GitHub (created from the i2i template).
2. **Settings → Pages → Source:** "Deploy from a branch", choose `main` and `/ (root)`.
3. Wait ~30 seconds. Your site will be live at `https://YOUR-USERNAME.github.io/i2i-systems-omdb-example/`.

The repo includes a `.nojekyll` file so GitHub Pages doesn't try to process it as a Jekyll site (which would interfere with paths like `/js/`).

---

## 🗂️ Project structure

```
.
├── index.html              # Markup, dialog elements, font loading
├── css/
│   └── styles.css          # Design tokens, components, responsive rules
├── js/
│   ├── config.js           # Constants (API key, base URL, limits)
│   ├── api.js              # OMDB client + in-memory LRU cache + OmdbError
│   ├── storage.js          # LocalStorage wrapper (key, last state, history)
│   ├── ui.js               # Pure rendering — no business logic
│   └── main.js             # Orchestration, event wiring, URL <-> state sync
├── .nojekyll               # GitHub Pages: don't run Jekyll
└── README.md
```

### Architecture

The codebase splits responsibilities deliberately to stay maintainable:

- **`api.js`** owns the network. It throws a typed `OmdbError` (with `code`: `NOT_FOUND`, `BAD_KEY`, `NETWORK`, …) so the orchestrator can match on cause without parsing strings. It also memoizes responses for the page lifetime — you can paginate forward and back without re-hitting OMDB.

- **`storage.js`** is a tiny LocalStorage wrapper that swallows storage exceptions (private mode, quota) and returns safe defaults. Never throws.

- **`ui.js`** does only DOM — every export takes data as an argument and writes to the DOM. No state, no fetching. Easy to unit-test if we ever want to.

- **`main.js`** is the only file with mutable state (the `state` object). It mirrors `state` to both the URL (so links are shareable) and to LocalStorage (so a refresh without a URL still restores). It also handles the back/forward buttons via `popstate`.

### State persistence

| Source        | When used                             | Why                                   |
|---------------|---------------------------------------|---------------------------------------|
| URL params    | Always wins on load                   | Shareable links, working back button  |
| LocalStorage  | Fallback when URL is empty            | Survives a fresh visit to the bare URL |

When a search succeeds, both are updated. The URL also pushes a new `history` entry per search, so the browser back button takes you to the previous query.

---

## 📋 Requirements covered

| Requirement | Status |
|---|---|
| Fully responsive SPA | ✅ |
| HTML / CSS / JavaScript | ✅ — vanilla, no frameworks |
| Movie search input | ✅ |
| Title, Year, Genre, Director, Poster | ✅ — plus 7 more fields in the modal |
| Error handling for not-found and API errors | ✅ — typed errors per cause |
| Multiple searches without refresh | ✅ |
| Last search retained on refresh | ✅ — both URL params **and** LocalStorage |
| Avoid unnecessary repeated requests | ✅ — in-memory cache |
| Works across modern browsers | ✅ — uses ES modules, `<dialog>`, `URL`, all baseline-supported |
| Modular & well-documented code | ✅ — 5 ES modules, JSDoc on every public API |
| Deployed on GitHub Pages | ✅ — see [Deployment](#-deployment) |

---

## 📜 License

Code: MIT. Movie data via OMDB. Fonts via Google Fonts (Fraunces, Bricolage Grotesque).
