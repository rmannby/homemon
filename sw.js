/**
 * Defines cache names and static files to precache. 
 * Registers service worker install, activate and fetch event handlers.
 * 
 * CACHE_STATIC_NAME - Name of the static file cache.
 * CACHE_DYNAMIC_NAME - Name of the dynamic cache. 
 * STATIC_FILES - List of static files to precache.
 * 
 * The install handler opens the static file cache and adds the static files. 
 * The activate handler deletes old caches.
 * The fetch handler serves cached responses first, falling back to the network.
*/
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

/**
 * Install event handler for the service worker. 
 * Logs a message, opens the static file cache, 
 * and adds the static files to the cache.
*/
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

/**
 * Activate event handler for the service worker. 
 * Logs a message, deletes old caches, and claims any open clients.
*/
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

/**
 * Installs a fetch event handler that responds to fetch requests 
 * by first checking the cache for a matching response, and if not found, 
 * fetching the request from the network. This allows pages to be served
 * from the cache when offline.  
*/
self.addEventListener('fetch', function (event) {
    // console.log('Fetch event for ', event.request.url);
    event.respondWith(
        caches.match(event.request).then(function (response) {
            return response || fetch(event.request);
        })
    );
});

