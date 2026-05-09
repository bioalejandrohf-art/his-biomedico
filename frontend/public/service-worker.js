// Service Worker minimalista — versión 3
// Solo se registra para que Chrome reconozca la PWA.
// NO interfiere con peticiones de red.

const CACHE_NAME = 'biomed-his-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.delete(n)))
      ),
      self.clients.claim()
    ])
  );
});

// NO interceptar fetch — dejar que el navegador maneje todo normalmente
// Esto evita errores y permite que la PWA siga siendo instalable