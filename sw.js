self.addEventListener('install', function (event) {
    console.log('[SW] Installing service worker ...', event)
      event.waitUntil(
          caches.open('static')
          .then(function (cache) {
              console.log('[SW] Precaching App Shell')
              cache.addAll([
                //   '/',
                  'index.html',
                  'src/js/app.js',
                //   'src/js/weather.js',
                //   'src/js/pubnub-gateway.js',
                  'src/css/style.css',
                  'src/images/homemon-48x48.png',
                  'src/images/homemon-96x96.png',
                  'src/images/homemon-144x144.png',
                  'src/images/homemon-192x192.png',
                  'src/images/homemon-256x256.png',
                  'src/images/homemon-384x384.png',
                  'src/images/homemon-512x512.png',
                  'src/images/temperatureOutside.png',
                  'src/images/temperatureInside.png',
                  'src/images/swimmingPool.png',
                  'src/images/sun.png',
                  'src/images/weather/10.svg',
                  'src/images/weather/11.svg',
                  'src/images/weather/22.svg',
                  'src/images/weather/30.svg'
              ])
          })
      )
})

self.addEventListener('activate', function (event) {
    console.log('[SW] Activating service worker ...', event)
    return self.clients.claim()
})

self.addEventListener('fetch', function (event) {
    event.respondWith(
        caches.match(event.request)
        .then(function (response) {
            if (response) {
                return response;
            } else {
                return fetch(event.request)
            }
        })
    )
})