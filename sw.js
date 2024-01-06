const CACHE_STATIC_NAME = 'static-v1'
const CACHE_DYNAMIC_NAME = 'dynamic-v1';

const STATIC_FILES = [
    '.',
    'index.html',
    'src/js/app.js',
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
    'src/images/mouseTrap.png',
    'src/images/sun.png',
    'src/images/weather/10.png',
    'src/images/weather/11.png',
    'src/images/weather/22.png',
    'src/images/weather/30.png'
]

self.addEventListener('install', function (event) {
    console.log('[Service Worker] Installing Service Worker ...', event);
    event.waitUntil(
        caches.open(CACHE_STATIC_NAME)
        .then(function (cache) {
            console.log('[Service Worker] Precaching App Shell');
            return cache.addAll(STATIC_FILES);
        })
    )
});

self.addEventListener('activate', function (event) {
    console.log('[Service Worker] Activating Service Worker ....', event);
    event.waitUntil(
        caches.keys()
        .then(function (keyList) {
            return Promise.all(keyList.map(function (key) {
                if (key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME) {
                    console.log('[Service Worker] Removing old cache.', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', function (event) {
    // console.log('Fetch event for ', event.request.url);
    event.respondWith(
        caches.match(event.request).then(function (response) {
            return response || fetch(event.request);
        })
    );
});

