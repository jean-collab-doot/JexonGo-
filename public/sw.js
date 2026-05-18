// ── JEXONGO SERVICE WORKER ────────────────────────────────────────────────────
// Strategy:
//   INSTALL  — pre-cache the critical shell + game assets
//   FETCH    — cache-first for all assets; network-first for HTML/JS
//   ACTIVATE — delete old caches so stale files never linger

const CACHE_VERSION = 'jexongo-v1';

// Critical assets cached immediately on first visit
const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/retropix.otf',
  // Backgrounds
  '/assets/bg/ocean/bg.png',
  '/assets/bg/desert/bg.png',
  '/assets/bg/city/bg.png',
  '/assets/bg/arctic/bg.png',
  '/assets/bg/space/bg.png',
  // Player ships
  '/assets/ships/player/t6.png',
  '/assets/ships/player/pc21.png',
  '/assets/ships/player/c130.png',
  '/assets/ships/player/a10.png',
  '/assets/ships/player/f16.png',
  '/assets/ships/player/f18.png',
  '/assets/ships/player/f22.png',
  '/assets/ships/player/f35.png',
  '/assets/ships/player/b2.png',
  '/assets/ships/player/sr71.png',
  // Enemies
  '/assets/enemies/planes/f15.png',
  '/assets/enemies/planes/t38.png',
  '/assets/enemies/planes/f117.png',
  '/assets/enemies/enemy-explosion.png',
  // FX
  '/assets/fx/rocket.png',
  '/assets/fx/explosion-a.png',
  '/assets/fx/fire-ball.png',
  '/assets/fx/heart-full.png',
  // Music
  '/assets/music/music-menu.mp3',
  '/assets/music/music-game.mp3',
  '/assets/music/music-shop.mp3',
  '/assets/music/music-arena.mp3',
  '/assets/music/music-ranked.mp3',
  // SFX
  '/assets/music/click.mp3',
  '/assets/music/correct.mp3',
  '/assets/music/wrong.mp3',
  '/assets/music/explosion.mp3',
  '/assets/music/shot.mp3',
  '/assets/music/win.mp3',
  '/assets/music/gameover.mp3',
  // Menu
  '/assets/menu/lobby-bg.png',
];

// ── INSTALL ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      // Precache best-effort — a missing file won't block install
      Promise.allSettled(PRECACHE.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests; skip cross-origin (Google Fonts, GSI, etc.)
  if (url.origin !== self.location.origin) return;

  // Skip non-GET requests (POST to EmailJS, etc.)
  if (request.method !== 'GET') return;

  // Skip range requests — browsers use these for audio/video seeking.
  // Cache API rejects 206 Partial Content responses with a TypeError.
  if (request.headers.get('range')) return;

  const isAsset = url.pathname.startsWith('/assets/');
  const isFont  = url.pathname.endsWith('.otf') || url.pathname.endsWith('.woff2');

  if (isAsset || isFont) {
    // Cache-first: serve from cache instantly; populate on first miss
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(c => c.put(request, clone));
          }
          return response;
        });
      })
    );
  } else {
    // Network-first for HTML/JS: pick up updates, fall back to cache offline
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
