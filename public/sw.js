const CACHE_NAME = 'mi-cache-v1';
const EXPIRATION_HOURS = 10;
const EXPIRATION_MS = EXPIRATION_HOURS * 60 * 60 * 1000;

// Instala el SW inmediatamente
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Toma control de las páginas abiertas
self.addEventListener('activate', event => {
  clients.claim();
});

// Intercepta todas las peticiones
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
          return fallbackCatalog(cache, event.request, url, now, 'Catálogo no disponible');
        }
      } catch (error) {
        if (isValidCache) {
          return cachedResponse;
        } else {
          return fallbackCatalog(cache, event.request, url, now, 'Sin conexión');
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

// Crea una respuesta de fallback segura
function fallbackCatalog(cache, request, url, now, mensaje) {
  const fallbackData = [
    { id: 'fallback', nombre: mensaje, sizes: [] }
  ];
  const fallbackResponse = new Response(JSON.stringify(fallbackData), {
    headers: { 'Content-Type': 'application/json' }
  });
  cache.put(request, fallbackResponse.clone());
  setCachedTime(cache, url, now);
  return fallbackResponse;
}

// Verifica si el catálogo está vacío y fuerza limpieza
self.addEventListener('message', event => {
  if (event.data === 'verificar-catalogo') {
    caches.open(CACHE_NAME).then(cache => {
      cache.match('/api/products').then(response => {
        if (!response) return;
        response.json().then(data => {
          if (!Array.isArray(data) || data.length === 0) {
            console.warn('Catálogo vacío, eliminando caché...');
            cache.delete('/api/products');
            cache.delete('/api/products_timestamp');
          }
        }).catch(err => {
          console.error('Error al leer productos del caché:', err);
          cache.delete('/api/products');
          cache.delete('/api/products_timestamp');
        });
      });
    });
  }
});
