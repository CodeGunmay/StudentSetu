/* StudentSetu — app-shell service worker.
 *
 * Registered only in production builds (see src/main.jsx).
 *
 * The hard rule in here: an API response must never enter a cache. The app
 * reads and writes `/api/...` on the same origin, so a service worker that
 * network-firsts everything would happily serve someone else's stale inbox, a
 * 401 from a dead token, or a listing that was already handed over — and, worst
 * of all, it would keep that copy on a shared device after logout.
 *
 *   • /api/* and any request carrying Authorization  -> untouched (browser handles it)
 *   • navigation requests                             -> network, offline fallback to the shell
 *   • every other same-origin GET                     -> network-first, cached copy for offline
 *   • other origins                                   -> untouched
 *
 * v2: the cache name is bumped and the activate handler deletes every other
 * cache, which includes studentsetu-v1 — that one may still hold API responses
 * from before this rule existed, so they are thrown away rather than migrated.
 */
var CACHE = 'studentsetu-v2';
var API_PREFIX = '/api';
var SHELL_KEYS = ['/index.html', '/'];

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (name) {
              return name !== CACHE;
            })
            .map(function (name) {
              return caches.delete(name);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

/** True for anything that must stay out of the cache: API calls, or anything authenticated. */
function isApiRequest(request, url) {
  var path = url && url.pathname ? url.pathname : '';
  if (path === API_PREFIX || path.indexOf(API_PREFIX + '/') === 0) return true;
  if (request && request.headers && typeof request.headers.has === 'function') {
    if (request.headers.has('authorization')) return true;
  }
  return false;
}

/** Only immutable, unauthenticated, same-origin static files get stored. */
function isShellAsset(request, url) {
  if (!url || url.origin !== self.location.origin) return false;
  if (request.method !== 'GET') return false;
  if (isApiRequest(request, url)) return false;
  if (request.headers && typeof request.headers.has === 'function' && request.headers.has('cookie')) return false;
  return url.pathname === '/' || /\.(html|css|js|mjs|svg|png|jpg|jpeg|gif|webp|ico|woff2?|webmanifest)$/i.test(url.pathname);
}

function putInCache(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return Promise.resolve(false);
  var url;
  try {
    url = new URL(response.url || request.url);
  } catch (err) {
    return Promise.resolve(false);
  }
  if (!isShellAsset(request, url)) return Promise.resolve(false);
  return caches.open(CACHE).then(
    function (cache) {
      var jobs = [cache.put(request, response)];
      // the shell is reachable under either spelling, so store both keys
      if (url.pathname === '/index.html' || url.pathname === '/') {
        jobs.push(caches.match('/index.html').then(function (hit) {
          return hit ? null : cache.put('/index.html', response);
        }));
      }
      return Promise.all(jobs).then(
        function () {
          return true;
        },
        function () {
          return false;
        }
      );
    },
    function () {
      return false;
    }
  );
}

/** Shown when the network is gone and even the shell was never fetched. */
function offlineShell() {
  return caches.match('/index.html').then(function (hit) {
    if (hit) return hit;
    return caches.match('/');
  });
}

var OFFLINE_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>StudentSetu — offline</title><style>body{margin:0;height:100vh;display:grid;place-items:' +
  'center;background:#4F46E5;color:#fff;font:600 15px/1.6 system-ui,sans-serif;text-align:center}' +
  'div{padding:24px}h1{font-size:22px;margin:0 0 6px}p{opacity:.8;margin:0}</style></head>' +
  '<body><div><h1>StudentSetu</h1><p>You are offline. Reconnect and pull to refresh — ' +
  'nothing was lost, the data lives on the campus server.</p></div></body></html>';

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (!request || request.method !== 'GET') return;

  var url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }

  // different origin (font CDNs, mailto bridges): not ours to intercept
  if (url.origin !== self.location.origin) return;

  // THE rule: API traffic is never served from a cache and never stored in one.
  // Returning without respondWith() lets the browser do exactly what it would
  // have done with no service worker at all — including showing its own network
  // error, which is what the app's ErrorState then reports.
  if (isApiRequest(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(
        function (response) {
          putInCache(request, response);
          return response;
        },
        function () {
          // offline fallback applies to page navigation only
          return offlineShell().then(function (hit) {
            return hit || new Response(OFFLINE_HTML, { status: 200, headers: { 'Content-Type': 'text/html' } });
          });
        }
      )
    );
    return;
  }

  // static asset: network first so a redeploy lands, cache only as an offline copy.
  // A miss resolves to a network error — never to the app shell, which would make
  // a missing .css come back as HTML.
  event.respondWith(
    fetch(request).then(
      function (response) {
        putInCache(request, response);
        return response;
      },
      function () {
        return caches.match(request).then(function (hit) {
          if (hit) return hit;
          return Promise.reject(new Error('offline'));
        });
      }
    )
  );
});
