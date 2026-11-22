/**
 * Does the offline worker keep its hands off the API?
 *
 * Runs the REAL public/sw.js inside a small fake ServiceWorkerGlobalScope (a vm
 * context with fake `self`, `caches` and `fetch`) and drives its event handlers.
 * No re-implementation of the worker's logic — the assertions are about what the
 * shipped file actually does with the events a browser would hand it.
 *
 * Run: node scripts/test-sw.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) {
    pass += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    fail += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${extra ? ` → ${String(extra).slice(0, 200)}` : ''}`);
  }
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

const ORIGIN = 'https://app.test';

/* ------------------------------------------------------------------ fakes */

const makeResponse = (body, { status = 200, contentType = 'text/plain', url = '' } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  type: status === 200 ? 'basic' : 'default',
  url,
  body,
  headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
});

const keyOf = (value) => {
  const raw = typeof value === 'string' ? value : value?.url || value?.pathname || '';
  try {
    return new URL(raw, ORIGIN).pathname;
  } catch {
    return String(raw);
  }
};

const handlersFlag = (worker) => worker.flags.skipWaiting === true;

function makeWorker({ offline = false } = {}) {
  const store = new Map(); // cache name -> Map(pathname -> response)
  const fetchLog = [];
  let fetcher = offline ? () => Promise.reject(new TypeError('Failed to fetch')) : (request) => Promise.resolve(makeResponse(`served:${keyOf(request)}`, { url: ORIGIN + keyOf(request) }));

  const caches = {
    open: async (name) => {
      if (!store.has(name)) store.set(name, new Map());
      const map = store.get(name);
      return {
        put: async (request, response) => {
          map.set(keyOf(request), response);
          if (response?.url) map.set(keyOf(response), response);
        },
        match: async (request) => map.get(keyOf(request)),
      };
    },
    keys: async () => [...store.keys()],
    delete: async (name) => store.delete(name),
    match: async (request) => {
      for (const map of store.values()) {
        const hit = map.get(keyOf(request));
        if (hit) return hit;
      }
      return undefined;
    },
  };

  const handlers = {};
  const flags = {};
  const self = {
    location: { origin: ORIGIN },
    skipWaiting: () => {
      flags.skipWaiting = true;
    },
    clients: { claim: () => Promise.resolve() },
    addEventListener: (name, fn) => {
      (handlers[name] = handlers[name] || []).push(fn);
    },
  };

  // A tiny Response stand-in, so the assertions can read `.body` as text
  // (the platform Response exposes it as a stream).
  class ShimResponse {
    constructor(body, init = {}) {
      this.body = body;
      this.status = init.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.type = 'basic';
      this.url = '';
      const headers = init.headers || {};
      this.headers = { get: (k) => headers[k] ?? headers[String(k).toLowerCase()] ?? null };
    }
  }

  const context = vm.createContext({
    self,
    caches,
    fetch: (req) => fetcher(req),
    URL,
    Response: ShimResponse,
    Promise,
    console,
    TypeError,
    String,
    Number,
    Object,
    Array,
    JSON,
    RegExp,
    Math,
  });
  const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'sw.js' });

  return {
    self,
    flags,
    store,
    fetchLog,
    setFetch(fn) {
      fetcher = fn;
    },
    async fire(name, event) {
      for (const fn of handlers[name] || []) await fn(event);
      return event;
    },
    cacheKeys: async () => {
      const keys = [];
      for (const [name, map] of store) for (const k of map.keys()) keys.push(`${name}:${k}`);
      return keys;
    },
  };
}

const makeRequest = (path, { method = 'GET', mode, headers = {} } = {}) => ({
  method,
  mode,
  url: ORIGIN + path,
  headers: { has: (k) => Object.keys(headers).some((name) => name.toLowerCase() === String(k).toLowerCase()) },
});

const makeEvent = (request) => {
  const event = { request, _response: undefined, respondWith(p) { this._response = p; } };
  return event;
};

/* ------------------------------------------------------------------- run */

section('install + activate: v1 goes away');
{
  const worker = makeWorker();
  await worker.fire('install', {});
  ok('install claims an immediate activation', handlersFlag(worker), 'no skipWaiting() call');
  ok('and it pre-caches nothing, so no API reply can sneak in', worker.store.size === 0, [...worker.store.keys()]);

  // a v1 cache that still holds API responses from before this rule existed
  await (await worker.store).size;
  const v1 = new Map([
    ['/api/items', makeResponse('{"ok":true,"items":[]}')],
    ['/index.html', makeResponse('shell')],
  ]);
  worker.store.set('studentsetu-v1', v1);
  worker.store.set('studentsetu-v2', new Map());

  const activateEvent = { waitUntil: (p) => Promise.resolve(p) };
  await worker.fire('activate', activateEvent);
  await activateEvent.waitUntil(Promise.resolve());
  ok('the stale studentsetu-v1 cache is deleted', !worker.store.has('studentsetu-v1'), [...worker.store.keys()]);
  ok('the current cache survives', worker.store.has('studentsetu-v2'), [...worker.store.keys()]);
  ok('so no cached API response is left behind', ![...worker.store.values()].some((m) => m.has('/api/items')));
}

section('API traffic is never intercepted');
{
  const worker = makeWorker();
  const apiEvent = makeEvent(makeRequest('/api/items?mode=free', { headers: { Authorization: 'Bearer t1' } }));
  await worker.fire('fetch', apiEvent);
  ok('an authenticated /api GET is left to the browser', apiEvent._response === undefined);

  const openApi = makeEvent(makeRequest('/api/top-tutors?k=3'));
  await worker.fire('fetch', openApi);
  ok('even an unauthenticated /api GET is not answered by the worker', openApi._response === undefined);

  const posted = makeEvent(makeRequest('/api/items/handoff', { method: 'POST' }));
  await worker.fire('fetch', posted);
  ok('a POST is never touched', posted._response === undefined);

  const keys = await worker.cacheKeys();
  ok('nothing from /api was written to any cache', keys.every((k) => !k.includes('/api/')), keys.join(' '));

  // an authenticated page request is also off-limits: no shared-device copies
  const authPage = makeEvent(makeRequest('/some/file.css', { headers: { Authorization: 'Bearer t1' } }));
  await worker.fire('fetch', authPage);
  ok('any request carrying Authorization is skipped, path aside', authPage._response === undefined);
}

section('Offline fallback is for navigation only');
{
  const worker = makeWorker();
  const nav = makeEvent(makeRequest('/', { mode: 'navigate' }));
  await worker.fire('fetch', nav);
  const res = await nav._response;
  ok('online navigation is served from the network', (await res.body) === 'served:/');

  const keys = await worker.cacheKeys();
  ok('the shell is stored under /index.html too', keys.includes('studentsetu-v2:/index.html'), keys.join(' '));

  // same worker, network now dead: the shell it already saw is what comes back
  worker.setFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  const nav2 = makeEvent(makeRequest('/items', { mode: 'navigate' }));
  await worker.fire('fetch', nav2);
  const shell = await nav2._response;
  ok('offline navigation falls back to the cached app shell', String(shell?.body ?? '').includes('served:/'), String(shell?.body).slice(0, 60));

  const empty = makeWorker({ offline: true });
  const nav3 = makeEvent(makeRequest('/skills', { mode: 'navigate' }));
  await empty.fire('fetch', nav3);
  const inline = await nav3._response;
  ok('with no shell cached at all, an offline page is still returned', String(inline?.body ?? '').includes('You are offline'), String(inline?.body).slice(0, 60));
  ok('and it is marked as html', inline?.headers?.get('Content-Type') === 'text/html', inline?.headers?.get('Content-Type'));

  // the important half: an API call must NOT get the shell
  const apiOffline = makeEvent(makeRequest('/api/items', { headers: { Authorization: 'Bearer t1' } }));
  await empty.fire('fetch', apiOffline);
  ok('an offline API call is not answered with the app shell', apiOffline._response === undefined);

  // a missing asset must not come back as HTML either
  const asset = makeEvent(makeRequest('/assets/missing.js'));
  await empty.fire('fetch', asset);
  let rejected = false;
  try {
    await asset._response;
  } catch {
    rejected = true;
  }
  ok('a missing asset offline rejects instead of returning HTML', rejected || asset._response === undefined);
}

section('Static assets still cache for offline use');
{
  const worker = makeWorker();
  const css = makeEvent(makeRequest('/assets/index-abc123.css'));
  await worker.fire('fetch', css);
  await css._response;
  const keys = await worker.cacheKeys();
  ok('a same-origin stylesheet is kept for offline', keys.includes('studentsetu-v2:/assets/index-abc123.css'), keys.join(' '));

  const remoteRequest = { url: 'https://fonts.gstatic.com/s/font.woff2', method: 'GET', headers: { has: () => false } };
  const remoteEvent = makeEvent(remoteRequest);
  await worker.fire('fetch', remoteEvent);
  ok('a cross-origin font request is left alone', remoteEvent._response === undefined);
}

console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m`);
process.exit(fail ? 1 : 0);
