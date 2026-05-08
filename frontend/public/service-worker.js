const CACHE_NAME = 'biomed-his-v1';

// Precarga mínima — solo lo esencial
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icono-192.png',
  '/icono-512.png',
];

// Instalación
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch(() => {
        // Si falla algún recurso, no rompe la instalación
        console.warn('Cache parcial');
      });
    })
  );
  self.skipWaiting();
});

// Activación: limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Estrategia: Network First para API, Cache First para estáticos
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No cachear llamadas a la API (siempre frescas)
  if (url.hostname.includes('railway.app') || url.hostname.includes('cloudinary.com')) {
    return; // dejar pasar al navegador
  }

  // Solo GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Solo cachear respuestas exitosas
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});