/*
 * Glowtrace service worker: makes the app open and work offline.
 * - App pages: network first, falling back to the last copy cached on this device.
 * - Built assets (/assets/*, content-hashed): cache first, they never change.
 * - Only same-origin GET requests are touched. Nothing here sends data anywhere.
 * Bump CACHE_VERSION to retire old caches.
 */
const CACHE_VERSION = "glowtrace-v1";
// The face guide (about 18 MB) keeps its own cache so app updates do not re-download it.
const FACE_GUIDE_CACHE = "glowtrace-face-guide-1";
const SHELL = [
  "/app",
  "/scan",
  "/routine",
  "/progress",
  "/privacy",
  "/manifest.webmanifest",
  "/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      // One failed page must not block installing the rest.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION && key !== FACE_GUIDE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const putInCache = (request, response) => {
  if (response.ok && response.type === "basic") {
    const copy = response.clone();
    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache(request, response))
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          return cached || (await caches.match("/app")) || Response.error();
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/mediapipe/")) {
    event.respondWith(
      caches.open(FACE_GUIDE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (
    url.pathname.startsWith("/assets/") ||
    /\.(png|jpg|svg|webmanifest|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches
        .match(request)
        .then(
          (cached) => cached || fetch(request).then((response) => putInCache(request, response)),
        ),
    );
  }
});
