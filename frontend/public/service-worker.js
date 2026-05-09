const CACHE_NAME = 'biomed-his-v2';

// Auto-actualizar inmediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Borrar TODOS los caches viejos
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.delete(n)))
      ),
      // Tomar control inmediatamente
      self.clients.claim()
    ])
  );
});

// Estrategia: SIEMPRE intentar red primero, solo usar caché si falla
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No interferir con APIs ni recursos de Cloudinary
  if (url.hostname.includes('railway.app') || url.hostname.includes('cloudinary.com')) {
    return;
  }

  // Solo manejar GET
  if (event.request.method !== 'GET') return;

  // Solo manejar mismo origen
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cachear sólo si la respuesta es exitosa
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar desde caché
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('/index.html');
        });
      })
  );
});