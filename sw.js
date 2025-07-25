const version = 19;
var oldVersion = version - 1;
// Change scope in index.html

const MAIN_CACHE = `ARK-cache-version: ${version}`;
const OLD_MAIN_CACHE = `ARK-cache-version: ${oldVersion}`;
const VERSION_CACHE = 'ARK-bibles';
var update = true;
var updateVar = true;

const urlsToCache = [
     'index.html',
     'manifest.json',
     'code/css/index.css',
     'code/css/lateload.css',
     'code/css/variables.css',
     'images/icons/favicon-16.png',
     'code/js/index.js',
     'code/js/lateload.js',
     'code/js/loadtables.js',
     'code/js/searcher.js',
     'code/js/utilities.js',
     'code/js/variables.js',
];

self.addEventListener('install', event => {
     event.waitUntil(
          (async () => {
               const cache = await caches.open(MAIN_CACHE);
               const oldCache = await caches.open(OLD_MAIN_CACHE);

               for (let url of urlsToCache) {
                    const headResponse = await fetch(url, { method: 'HEAD' });
                    const newETag = headResponse.headers.get('ETag');
                    let cachedResponse = await oldCache.match(url);
                    if (cachedResponse) {
                         const oldETag = cachedResponse.headers.get('ETag');
                         if (newETag && oldETag && newETag === oldETag) {
                              await cache.put(url, cachedResponse);
                         } else {
                              const newResponse = await fetch(url, { cache: 'reload' });
                              if (newResponse) { await cache.put(url, newResponse); };
                         };
                    } else {
                         const newResponse = await fetch(url, { cache: 'reload' });
                         if (newResponse) { await cache.put(url, newResponse); };
                    };
               };
               self.skipWaiting();
          })()
     );
});

self.addEventListener('activate', async (event) => {

     event.waitUntil(
          (async () => {
               await deleteCaches();
               await checkVerses();
               self.clients.claim();
          })()
     );
});

async function deleteCaches() {

     const cacheAllowList = [MAIN_CACHE, VERSION_CACHE];
     const keys = await caches.keys();
     await Promise.all(keys.map(async (key) => {
          if (!cacheAllowList.includes(key)) { await caches.delete(key); };
     }));
};

async function deleteCachedFile(fileName) {
     const cache = await caches.open(MAIN_CACHE);
     const keys = await cache.keys();

     for (const request of keys) {
          if (request.url.endsWith(fileName)) { await cache.delete(request); };
     };
     return Promise.resolve(true);
};

self.addEventListener('fetch', event => {

     event.respondWith(
          (async () => {

               const cache = await caches.open(MAIN_CACHE);
               const versionCache = await caches.open(VERSION_CACHE);
               var url = new URL(event.request.url);
               var filename = url.pathname.split('/').pop();
               url.search = '';

               // This can be removed after editing TWF is finished
                    if (navigator.onLine) {

                         if (filename === 'variables.js') {
                              if (updateVar) {
                                   const headResponse = await fetch(url, { method: 'HEAD' });
                                   const newETag = headResponse.headers.get('ETag');
                                   let cachedResponse = await cache.match(url);
                                   if (cachedResponse) {
                                        const oldETag = cachedResponse.headers.get('ETag');
                                        if (newETag && oldETag && newETag !== oldETag) {
                                             const newResponse = await fetchOnlineUpdate(url, filename);
                                             if (newResponse.ok) { await cache.put(url, newResponse); };
                                        };
                                        updateVar = false;
                                   };
                              };
                         };

                         if (filename === 'TWFVerses.json') {
                              if (update) {
                                   const headResponse = await fetch(url, { method: 'HEAD' });
                                   const newETag = headResponse.headers.get('ETag');
                                   let cachedResponse = await versionCache.match(url);
                                   if (cachedResponse) {
                                        const oldETag = cachedResponse.headers.get('ETag');
                                        if (newETag && oldETag && newETag !== oldETag) {
                                             const newResponse = await fetchOnlineUpdate(url, filename);
                                             if (newResponse.ok) { await versionCache.put(url, newResponse); };
                                        };
                                        update = false;
                                   };
                              };
                         };
                    };
               // End This can be removed after editing TWF is finished

               if (filename.endsWith('.json') && filename !== 'manifest.json') {

                    const cachedResponse = await versionCache.match(url);
                    if (cachedResponse) {
                         //! Start Here
                         //const cntEncode = cachedResponse.headers.get('Content-Encoding')
                         return cachedResponse;
                    };

                    const response = await fetchOnline(url, filename);
                    if (!response.ok) { return response; };
                    await versionCache.put(url, response.clone());
                    return response;
               } else {

                    const cachedResponse = await cache.match(url);
                    if (cachedResponse) { return cachedResponse; };

                    const response = await fetchOnline(url, filename);
                    if (!response.ok) { return response; };
                    await cache.put(url, response.clone());
                    return response;
               };
          })()
     );
});

async function fetchOnlineUpdate(url, filename) {

     if (navigator.onLine) {
          try {
               const response = await fetch(url, { cache: 'reload' });
               if (!response.ok) { return new Response(`${filename}Network fetch error: 500`, { status: 500 }); };
               return response;
          } catch (error) {
               return new Response(`${filename}Network fetch error: 500-1`, { status: 500 });
          };
     } else { return new Response(`${filename}: No internet connection error: 503-1`, { status: 503 }); };
};

async function fetchOnline(url, filename) {

     if (navigator.onLine) {
          try {
               const response = await fetch(url);
               if (!response.ok) { return new Response(`${filename}Network fetch error: 500`, { status: 500 }); };
               return response;
          } catch (error) {
               return new Response(`${filename}Network fetch error: 500-1`, { status: 500 });
          };
     } else { return new Response(`${filename}: No internet connection error: 503-1`, { status: 503 }); };
};

async function checkVerses() {

     caches.open(VERSION_CACHE).then(async (cache) => {
          const cachedRequests = await cache.keys();
          if (!cachedRequests.length) { return; };
          const updatePromises = cachedRequests.map(async (request) => {
               const url = request.url;
               try {
                    const headResponse = await fetch(url, { method: 'HEAD', cache: 'no-store' });
                    if (headResponse.status === 404) {
                         console.log(`Resource ${url} no longer exists on server (404). Deleting from cache.`);
                         await cache.delete(request);
                         return;
                    };

                    const newETag = headResponse.headers.get('ETag');
                    const cachedResponse = await cache.match(request);
                    if (cachedResponse) {
                         const cachedETag = cachedResponse.headers.get('ETag');
                         if (newETag && cachedETag && newETag !== cachedETag) {
                              const freshResponse = await fetch(url);
                              if (freshResponse.ok) {
                                   await cache.put(request, freshResponse.clone());
                              } else {
                                   console.warn(`Failed to fetch fresh version of ${url}: ${freshResponse.status}`);
                              }
                         } else {
                              console.log(`Resource ${url} is still fresh (ETag match or no ETag change).`);
                         }
                    } else {
                         // This case theoretically shouldn't happen if `cache.keys()` returns the request,
                         // but it's good for robustness. It means the item was in keys() but somehow
                         // not found by match(). Or it was added by another process and is being handled.
                         console.log(`Resource ${url} in cache keys but no direct match found, skipping ETag check for now.`);
                    }

               } catch (error) {
                    console.error(`Error processing ${url} for ETag check/update:`, error);
                    // Handle network errors gracefully. If offline, you can't check server.
                    // You might decide to keep the cached item if offline.
               }
          });
          return Promise.all(updatePromises);
     }).catch((error) => {
          console.error('Error opening cache or iterating items:', error);
     })
};