/**
 * calorAI service worker — hand-written, Turbopack-safe.
 *
 * Why hand-written: Next 16 builds with Turbopack by default, which ignores
 * webpack hooks, so @serwist/next's build-time precache injection cannot run
 * (its Turbopack "configurator mode" needs @serwist/cli + a package.json
 * build-script change). This file uses runtime caching strategies only —
 * no build-time manifest — so it survives every rebuild untouched.
 *
 * Strategies:
 *  - Navigations:        NetworkFirst (3s timeout) -> cache -> /~offline
 *  - Static assets:      CacheFirst (_next/static, images, fonts), capped
 *  - Same-origin GET API: NetworkFirst (3s timeout), capped
 *  - /api/auth/**, non-GET (server actions), cross-origin, Range,
 *    /sw.js itself: bypassed
 *
 * To invalidate all caches (e.g. after a breaking deploy), bump SW_VERSION.
 */

const SW_VERSION = "calorai-v1";
const STATIC_CACHE = `${SW_VERSION}-static`;
const PAGE_CACHE = `${SW_VERSION}-pages`;
const API_CACHE = `${SW_VERSION}-api`;
const OFFLINE_URL = "/~offline";

const NAV_TIMEOUT_MS = 3000;
const STATIC_MAX_ENTRIES = 64;
const STATIC_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PAGE_MAX_ENTRIES = 32;
const API_MAX_ENTRIES = 16;
const API_TIMEOUT_MS = 3000;
const STATIC_SWEEP_INTERVAL_MS = 60 * 60 * 1000; // age sweep at most hourly

/* --------------------------------- install -------------------------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Precache the offline fallback. A failure must reject install so the
      // browser discards this worker and retries on the next navigation —
      // the offline shell is a hard requirement, not best-effort.
      const res = await fetch(new Request(OFFLINE_URL, { cache: "reload" }));
      if (!res || !res.ok) {
        throw new Error(
          `calorAI SW: failed to precache ${OFFLINE_URL} (status ${
            res ? res.status : "no response"
          })`
        );
      }
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(OFFLINE_URL, res);
      await self.skipWaiting();
    })()
  );
});

/* -------------------------------- activate -------------------------------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE, API_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("calorai-") && !keep.has(name))
          .map((name) => caches.delete(name))
      );
      await expireStaticCache();
      await self.clients.claim();
    })()
  );
});

/** Drop static entries older than STATIC_MAX_AGE_MS (best effort, header-based). */
let lastStaticSweep = 0;

/** Age sweep, throttled so runtime requests don't pay for it every hit. */
function sweepStaticAgeIfDue() {
  const now = Date.now();
  if (now - lastStaticSweep < STATIC_SWEEP_INTERVAL_MS) {
    return Promise.resolve();
  }
  lastStaticSweep = now;
  return expireStaticCache().catch(() => {
    /* never let housekeeping break a request */
  });
}

async function expireStaticCache() {
  const cache = await caches.open(STATIC_CACHE);
  const keys = await cache.keys();
  const now = Date.now();
  await Promise.all(
    keys.map(async (key) => {
      try {
        const res = await cache.match(key);
        const dateHeader = res && res.headers.get("date");
        if (!dateHeader) return;
        if (now - new Date(dateHeader).getTime() > STATIC_MAX_AGE_MS) {
          await cache.delete(key);
        }
      } catch {
        // Leave the entry alone if it cannot be inspected.
      }
    })
  );
}

/* ---------------------------------- fetch --------------------------------- */

const STATIC_PATTERN =
  /^\/_next\/static\/|\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|css|js)$/i;

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch non-GET traffic: server actions, mutations, etc.
  if (request.method !== "GET") return;

  // Range requests (media seeking) must go straight to the network.
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Cross-origin: bypass entirely (simplest safe rule for this app).
  if (url.origin !== self.location.origin) return;

  // Auth endpoints are never intercepted or cached.
  if (url.pathname.startsWith("/api/auth/")) return;

  // Never intercept our own script: the browser manages its update lifecycle,
  // and next.config.ts serves /sw.js uncacheable so updates land promptly.
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE, API_MAX_ENTRIES, API_TIMEOUT_MS));
    return;
  }

  if (STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirstStatic(request));
  }
  // Anything else: fall through to the network, untouched.
});

/* ------------------------------- strategies ------------------------------- */

/**
 * Only cache complete, successful, non-redirected responses. Redirected
 * responses make cache.put()/respondWith throw in Chromium, and non-2xx
 * bodies would poison the caches.
 */
function cacheable(res) {
  return Boolean(res && res.ok && !res.redirected);
}

async function handleNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const res = await fetchWithTimeout(request, NAV_TIMEOUT_MS);
    if (cacheable(res) && res.type === "basic") {
      await cache.put(request, res.clone());
      trimCache(cache, PAGE_MAX_ENTRIES);
    }
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("You are offline.", {
      status: 503,
      statusText: "Offline",
      headers: { "Content-Type": "text/plain" },
    });
  }
}

async function cacheFirstStatic(request) {
  void sweepStaticAgeIfDue();
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (cacheable(res) && res.status !== 206) {
      await cache.put(request, res.clone());
      trimCache(cache, STATIC_MAX_ENTRIES);
    }
    return res;
  } catch {
    const stale = await cache.match(request);
    if (stale) return stale;
    throw new Error(`calorAI SW: offline and uncached: ${request.url}`);
  }
}

async function networkFirst(request, cacheName, maxEntries, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetchWithTimeout(request, timeoutMs);
    if (cacheable(res)) {
      await cache.put(request, res.clone());
      trimCache(cache, maxEntries);
    }
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error(`calorAI SW: offline and uncached: ${request.url}`);
  }
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  for (const key of keys.slice(0, keys.length - maxEntries)) {
    await cache.delete(key);
  }
}
