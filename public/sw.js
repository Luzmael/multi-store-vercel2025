const CACHE_NAME = 'mi-cache-v1';
const EXPIRATION_HOURS = 10;
const EXPIRATION_MS = EXPIRATION_HOURS * 60 * 60 * 1000;

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cachedResponse = await cache.match(event.request);
      const now = Date.now();

      if (cachedResponse) {
        const cachedTime = await getCachedTime(cache, url);
        if (cachedTime && now - cachedTime < EXPIRATION_MS) {
          return cachedResponse;
        } else {
          await cache.delete(event.request);
        }
      }

      const networkResponse = await fetch(event.request);
      cache.put(event.request, networkResponse.clone());
      await setCachedTime(cache, url, now);
      return networkResponse;
    })
  );
});

async function setCachedTime(cache, url, time) {
  const metadata = new Response(String(time), {
    headers: { 'Content-Type': 'text/plain' }
  });
  await cache.put(new Request(url + '_timestamp'), metadata);
}

async function getCachedTime(cache, url) {
  const response = await cache.match(url + '_timestamp');
  if (!response) return null;
  const text = await response.text();
  return parseInt(text, 10);
}
