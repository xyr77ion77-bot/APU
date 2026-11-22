/* Service worker conservador del Visor CIV:
   - cache-first SOLO para estáticos inmutables (_next/static, iconos, logo)
   - todo lo demás (API, páginas) pasa a red sin cachear → los datos nunca quedan viejos */
const CACHE = 'civ-static-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return
  const esEstatico =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/logo.svg' ||
    url.pathname.startsWith('/icon-') ||
    url.pathname === '/apple-touch-icon.png'
  if (!esEstatico) return
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const hit = await cache.match(e.request)
      if (hit) return hit
      const res = await fetch(e.request)
      if (res.ok) cache.put(e.request, res.clone())
      return res
    }),
  )
})
