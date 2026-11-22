/**
 * Session-expiry test: what the app does when a *protected* route answers 401.
 *
 *   node scripts/run.mjs scripts/test-session.mjs     (run.mjs sets SETU_API_URL,
 *                                                       which is what compiles the
 *                                                       app into real mode)
 *
 * PROVENANCE — read this before trusting the result. The app runs in real mode
 * (VITE_USE_MOCK=false) against a fetch stub defined in this file: the transport,
 * the status codes and the 401 itself are simulated here. Nothing in this suite
 * has ever talked to the C++ server — for that run `npm run test:live` against a
 * real origin. What *is* genuinely under test is everything on this side of fetch:
 * client.js's 401 branch and its listener set, AppContext's reaction to it, the
 * token in storage, and which screen is left mounted.
 */
import { JSDOM, VirtualConsole } from 'jsdom';

process.env.VITE_POLL_MS = '400';

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(`jsdom: ${e.message}`));
vc.on('error', (...a) => errors.push(`console.error: ${a.map(String).join(' ')}`));

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://studentsetu.local/',
  pretendToBeVisual: true,
  virtualConsole: vc,
});

global.window = dom.window;
global.document = dom.window.document;
// `navigator` is a read-only getter on globalThis in Node >= 21
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.getComputedStyle = dom.window.getComputedStyle;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
global.cancelAnimationFrame = clearTimeout;
global.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'localStorage', { value: dom.window.localStorage, writable: true, configurable: true });

let pass = 0;
let fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) {
    pass += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    fail += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${extra ? ` → ${String(extra).slice(0, 300)}` : ''}`);
  }
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

/* ------------------------------------------------------------------ transport */

const TOKEN = 't-session';
const LOGIN_LINE = 'Log in with your GEU email';
const ME = {
  id: 1,
  name: 'Gunmay',
  email: 'gunmay@geu.ac.in',
  branch: 'CSE',
  year: 3,
  teaches: 'C++, DBMS',
  wants: 'Python',
  verified: '1', // the server's own spelling: a string flag
  freeTime: '',
  itemsListed: 2,
  swapsDone: 1,
};

let expired = false; // flip it and every protected route answers 401
const calls = [];

const EMPTY = {
  items: [],
  listings: [],
  count: 0,
  categories: [],
  tutors: [],
  topTutors: [],
  swaps: [],
  oneWay: [],
  received: [],
  sent: [],
  newCount: 0,
  circles: [],
  requests: [],
  students: [],
  freeTime: '',
  commonFreeTime: '',
  waiting: [],
};

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

globalThis.fetch = async (input, init = {}) => {
  const u = new URL(String(input));
  const headers = init.headers || {};
  const rec = {
    method: init.method || 'GET',
    path: u.pathname,
    query: Object.fromEntries(u.searchParams),
    body: init.body ? JSON.parse(init.body) : null,
    auth: headers.Authorization || headers.authorization || '',
  };
  calls.push(rec);

  if (rec.path === '/api/login') {
    // the auth route answers a wrong password itself: it is exempt from the
    // expired-session path, so the form has to deal with it
    if (rec.body?.password !== 'secret123') return json(401, { ok: false, error: 'Wrong email or password.' });
    return json(200, { ok: true, token: TOKEN, user: ME });
  }
  if (expired || rec.auth !== `Bearer ${TOKEN}`) return json(401, { ok: false, error: 'Invalid or expired token' });
  if (rec.path === '/api/me') return json(200, { ok: true, ...ME });
  if (rec.method === 'POST') return json(200, { ok: true });
  if (rec.path.startsWith('/api/')) return json(200, { ok: true, ...EMPTY });
  return json(404, { ok: false, error: `no such route in this harness: ${rec.path}` });
};

/* ---------------------------------------------------------------------- mount */

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { default: App } = await import('../src/App.jsx');
const { AppProvider } = await import('../src/context/AppContext.jsx');
const api = (await import('../src/api')).default;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const body = () => document.body.textContent.replace(/\s+/g, ' ');
const all = (sel) => [...document.querySelectorAll(sel)];
const byText = (label, sel = 'button, a') =>
  all(sel).find((el) => el.textContent.replace(/\s+/g, ' ').trim().includes(label));

async function waitFor(test, { timeout = 9000 } = {}) {
  const started = Date.now();
  for (;;) {
    await act(async () => {
      await wait(120);
    });
    let hit = false;
    try {
      hit = typeof test === 'function' ? !!test() : body().includes(test);
    } catch {
      hit = false;
    }
    if (hit) return true;
    if (Date.now() - started > timeout) return false;
  }
}

const clickEl = async (el) => {
  await act(async () => {
    el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await wait(30);
  });
};
const tap = async (label) => {
  const el = byText(label);
  if (!el) {
    ok(`tap “${label}”`, false, `buttons: ${all('button').map((b) => b.textContent.trim()).slice(0, 24).join(' | ')}`);
    return false;
  }
  await clickEl(el);
  return true;
};
const type = async (id, value) => {
  const el = document.getElementById(id);
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

const root = createRoot(document.getElementById('root'));
await act(async () => {
  root.render(
    <AppProvider>
      <App />
    </AppProvider>
  );
});

/* ------------------------------------------------------------------------- boot */
section('A stale token at boot is a sign-in screen, not a stuck spinner');
await waitFor(LOGIN_LINE);
ok('the app landed on the sign-in form', body().includes(LOGIN_LINE), body().slice(0, 200));
ok('the boot read went to a protected route', calls.some((c) => c.path === '/api/me'), calls.map((c) => c.path).join(','));
ok('and nothing was remembered as signed in', dom.window.localStorage.getItem('setu.token') === null);

/* ------------------------------------------------------------- wrong password */
section('A wrong password stays on the form');
await type('login-email', 'gunmay@geu.ac.in');
await type('login-password', 'not-my-password');
await tap('Log in');
ok('the sentence the server gave is on the form', await waitFor('Wrong email or password'), body().slice(0, 200));
ok('the typed address is still in the field', document.getElementById('login-email').value === 'gunmay@geu.ac.in');
ok('no token was stored for a rejected login', dom.window.localStorage.getItem('setu.token') === null);
ok('the app is still on the sign-in form', body().includes(LOGIN_LINE));
ok('no demo hint leaked into a real-mode build', !body().includes('123456'));

/* ------------------------------------------------------------------- sign in */
section('Signing in works');
await type('login-password', 'secret123');
await tap('Log in');
ok('the app reached Home', await waitFor(() => all('nav[aria-label="Main"] button').length === 4), body().slice(0, 200));
ok('the token from the login reply is stored', dom.window.localStorage.getItem('setu.token') === TOKEN);
ok('protected reads carry it as a bearer', calls.some((c) => c.auth === `Bearer ${TOKEN}`), calls.map((c) => c.auth).join(','));
ok('Home is the active tab', all('nav[aria-label="Main"] button')[0]?.getAttribute('aria-current') === 'page');
ok('the signed-in person is on screen', body().includes('Hi, Gunmay'), body().slice(0, 200));

/* --------------------------------------------------------------- expiry, mid-session */
section('A protected route answering 401 mid-session');
await tap('Items');
await waitFor(() => calls.some((c) => c.path === '/api/items'));
ok('the browse screen really asked the server for listings', calls.some((c) => c.path === '/api/items' && c.auth === `Bearer ${TOKEN}`));
expired = true;
const mark = calls.length;
await tap('Activity'); // a tab change re-reads the server, exactly like the poll would
await waitFor(() => calls.length > mark);
ok('that read went out with the token that was about to die', calls.slice(mark).some((c) => c.auth === `Bearer ${TOKEN}`), calls.slice(mark).map((c) => c.path).join(','));
ok('the app stopped showing data', await waitFor(LOGIN_LINE), body().slice(0, 200));
ok('the dead token was dropped from storage', dom.window.localStorage.getItem('setu.token') === null, dom.window.localStorage.getItem('setu.token'));
ok('the sign-in screen replaced the protected one', body().includes(LOGIN_LINE), body().slice(0, 200));
ok('the bottom nav went with the session', all('nav[aria-label="Main"] button').length === 0, all('nav[aria-label="Main"] button').length);
ok('the cached person is off the screen', await waitFor(() => !body().includes('Gunmay') && !body().includes('Hi,')), body().slice(0, 200));
ok('the protected screen was unmounted, not left behind the form', document.getElementById('login-email') !== null && !body().includes('Hi,'), body().slice(0, 200));

const meReads = () => calls.filter((c) => c.path === '/api/me').length;
const beforeMeRead = meReads();
await act(async () => {
  await api.getMe().catch(() => {});
});
ok('the api asks again instead of reusing the person it remembered', meReads() > beforeMeRead, { beforeMeRead, after: meReads() });

/* ------------------------------------------------------------------- recovery */
section('Signing in again lands on Home, not where the session died');
expired = false;
await type('login-email', 'gunmay@geu.ac.in');
await type('login-password', 'secret123');
await tap('Log in');
ok('back on Home', await waitFor(() => all('nav[aria-label="Main"] button')[0]?.getAttribute('aria-current') === 'page'), body().slice(0, 200));
ok('with a fresh read of the person', await waitFor('Hi, Gunmay'), body().slice(0, 200));

ok('no console errors escaped the run', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m`);
console.log('  (real-mode client and screens against a stubbed transport — the C++ server was not involved)');
process.exit(fail ? 1 : 0);
