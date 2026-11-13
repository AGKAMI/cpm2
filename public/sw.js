// VANTA GARAGE — Service Worker for offline support
// Caches shell assets and API responses with stale-while-revalidate

const CACHE_NAME = "vanta-garage-v1";
const ASSETS = [
  "/",
  "/store/",
  "/store/categories",
  "/store/dashboard",
  "/store/orders",
  "/store/profile",
  "/store/wishlist",
  "/store/support",
  "/store/checkout/thank-you",
  "/og-image.svg",
  "/vanta-logo.svg",
  "/kami-lockup-gold.png",
];

// Install: cache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
});

// Fetch: stale-while-revalidate for API, cache-first for shell assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache-first for same-origin shell assets
  if (url.origin === self.location.origin && request.destination in {
    image: 1, style: 1, script: 1, font: 1,
  }) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return response;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for API calls
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: network first, fallback to cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
