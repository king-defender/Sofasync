// Minimal service worker - exists only to satisfy PWA installability
// criteria (a fetch handler is required). Deliberately does no caching:
// this app is realtime (Socket.IO, WebRTC), so serving stale cached
// responses would cause more problems than an offline shell is worth.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
