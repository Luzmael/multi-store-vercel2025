const CACHE_NAME = 'catalogo-cache-v1';
const SUPABASE_URL = 'https://bekzfacymgaytpgfqrzg.supabase.co/rest/v1/products';
const EXPIRATION_HOURS = 10;

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => clients.claim());

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.url.includes(SUPABASE_URL)) {
    event.respondWith(manejarProductos(request));
  }
});

async function manejarProductos(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const timestampResponse = await cache.match('timestamp');
  const now = Date.now();

  const vencido = timestampResponse
    ? (now - parseInt(await timestampResponse.text())) > EXPIRATION_HOURS * 60 * 60 * 1000
    : true;

  // 🧠 Verificar si el caché tiene productos válidos
  let cacheTieneProductos = false;
  if (cachedResponse) {
    try {
      const cachedData = await cachedResponse.clone().json();
      cacheTieneProductos = Array.isArray(cachedData) && cachedData.length > 0;
    } catch (e) {
      cacheTieneProductos = false;
    }
  }

  // 🔁 Si el caché es válido y tiene productos → úsalo
  if (cachedResponse && !vencido && cacheTieneProductos) {
    return cachedResponse;
  }

  // 🛰️ Si no hay caché válido o está vacío → pedir a Supabase
  try {
    const response = await fetch(request);
    const data = await response.clone().json();

    if (Array.isArray(data) && data.length > 0) {
      await cache.put(request, response.clone());
      await cache.put('timestamp', new Response(now.toString()));
      return response;
    } else {
      // Supabase respondió vacío → usar caché si existe
      return cachedResponse || fallbackResponse('Catálogo vacío');
    }
  } catch (err) {
    // Supabase no respondió → usar caché aunque esté vencido
    return cachedResponse || fallbackResponse('Error: sin conexión y sin datos');
  }
}

function fallbackResponse(mensaje) {
  const fallback = [{ id: 'fallback', name: mensaje, sizes: [] }];
  return new Response(JSON.stringify(fallback), {
    headers: { 'Content-Type': 'application/json' }
  });
}
