const CACHE_NAME = 'mi-cache-v1';
const EXPIRATION_HOURS = 10;
const EXPIRATION_MS = EXPIRATION_HOURS * 60 * 60 * 1000;

self.addEventListener('install', event => {
  self.skipWaiting(); // Activa el SW inmediatamente
});

self.addEventListener('activate', event => {
  clients.claim(); // Toma control de las páginas abiertas
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const now = Date.now();
      const cachedResponse = await cache.match(event.request);
      const cachedTime = await getCachedTime(cache, url);
      const isValidCache = cachedResponse && cachedTime && (now - cachedTime < EXPIRATION_MS);

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
          await setCachedTime(cache, url, now);
          return networkResponse;
        } else if (isValidCache) {
          return cachedResponse;
        } else {
          // Reescribe caché con estructura segura si la respuesta no es válida
          const fallbackData = [
            {
              id: 'fallback',
              nombre: 'Catálogo no disponible',
              sizes: []
            }
          ];
          const fallbackResponse = new Response(JSON.stringify(fallbackData), {
            headers: { 'Content-Type': 'application/json' }
          });
          cache.put(event.request, fallbackResponse.clone());
          await setCachedTime(cache, url, now);
          return fallbackResponse;
        }
      } catch (error) {
        if (isValidCache) {
          return cachedResponse;
        } else {
          // Reescribe caché con estructura segura si no hay conexión
          const fallbackData = [
            {
              id: 'offline',
              nombre: 'Sin conexión',
              sizes: []
            }
          ];
          const fallbackResponse = new Response(JSON.stringify(fallbackData), {
            headers: { 'Content-Type': 'application/json' }
          });
          cache.put(event.request, fallbackResponse.clone());
          await setCachedTime(cache, url, now);
          return fallbackResponse;
        }
      }
    })
  );
});

// Guarda el timestamp de la caché
async function setCachedTime(cache, url, time) {
  const metadata = new Response(String(time), {
    headers: { 'Content-Type': 'text/plain' }
  });
  await cache.put(new Request(url + '_timestamp'), metadata);
}

// Recupera el timestamp de la caché
async function getCachedTime(cache, url) {
  const response = await cache.match(url + '_timestamp');
  if (!response) return null;
  const text = await response.text();
  return parseInt(text, 10);
}

// Detecta si la caché está vacía y fuerza actualización
self.addEventListener('message', event => {
  if (event.data === 'verificar-catalogo') {
    caches.open(CACHE_NAME).then(cache => {
      cache.keys().then(keys => {
        if (keys.length === 0) {
          self.skipWaiting(); // Fuerza actualización del SW
        }
      });
    });
  }
});
