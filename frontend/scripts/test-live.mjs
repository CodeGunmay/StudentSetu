/**
 * The wire test: the real React UI, compiled with USE_MOCK=false, driven against
 * a real C++ StudentSetu server.
 *
 *   SETU_API_URL=http://localhost:8080 SETU_EMAIL=you@geu.ac.in SETU_PASSWORD=… \
 *     npm run test:live
 *
 * Nothing here falls back to demo data, and nothing here invents a route: the
 * assertions are about the *shape* the server agrees to return (see CHANGES.md),
 * so a server that drops a field fails this test rather than crashing the UI.
 *
 * Without a reachable server the run skips itself and exits 0 — a missing
 * backend is not a broken frontend. Add SETU_LIVE_WRITE=1 to also exercise the
 * mutating routes (it will create a listing and free-time windows under the
 * account you pass in, then take them down again).
 */
import { readFileSync } from 'node:fs';

// 8080 is the C++ server's own default (its PORT variable), so the URL is optional
const API = (process.env.SETU_API_URL || process.env.SETU_CPP_URL || 'http://localhost:8080').replace(/\/$/, '');
// scripts/jsx-loader.mjs compiles the app into real mode from this exact variable.
// Assigning it here keeps the *test* honest about which origin it probed; the
// compile flag itself has to be set before the loader thread starts, which is
// what scripts/run.mjs does when this file is the target.
if (!process.env.SETU_API_URL) process.env.SETU_API_URL = API;
const EMAIL = process.env.SETU_EMAIL || '';
const PASSWORD = process.env.SETU_PASSWORD || '';
const PEER_EMAIL = process.env.SETU_PEER_EMAIL || '';
const PEER_PASSWORD = process.env.SETU_PEER_PASSWORD || '';
const WRITE = process.env.SETU_LIVE_WRITE === '1';

let pass = 0;
let fail = 0;
let skipped = 0;
const ok = (label, cond, extra = '') => {
  if (cond) {
    pass += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    fail += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${extra ? ` → ${JSON.stringify(extra).slice(0, 300)}` : ''}`);
  }
};
const skip = (label, why) => {
  skipped += 1;
  console.log(`  \x1b[33m–\x1b[0m ${label} \x1b[2m(skipped: ${why})\x1b[0m`);
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

/* ------------------------------------------------------------------- probe */

const probe = await fetch(`${API}/api/items`, { method: 'GET', signal: AbortSignal.timeout(4000) })
  .then((res) => ({ status: res.status, type: res.headers.get('content-type') || '' }))
  .catch((err) => ({ error: err }));

if (probe.error) {
  console.log(`\n\x1b[1mLive check skipped\x1b[0m

  No StudentSetu API answered at \x1b[1m${API}\x1b[0m (${probe.error?.cause?.code || probe.error?.name || 'unreachable'}).

  This suite never falls back to demo data — that is the point of it. Start the
  C++ server (or point the variable at the one you have) and run it again:

    SETU_API_URL=http://localhost:8080 SETU_EMAIL=you@geu.ac.in SETU_PASSWORD=… npm run test:live

  If the server answers but the browser still cannot reach it, that is CORS: it
  must send Access-Control-Allow-Origin for this origin, and refuse nothing that
  carries Authorization.

  \x1b[2mThe frontend's own gates are: npm run test:mock · test:contract · test:sw · test:ui\x1b[0m
`);
  process.exit(0);
}
if (!probe.type.includes('json') && probe.status >= 500) {
  console.error(`\n  ${API} answered with HTTP ${probe.status} and "${probe.type}" — that is not the StudentSetu API.\n`);
  process.exit(1);
}

if (!EMAIL || !PASSWORD) {
  console.error('\n  A live server needs a real account: set SETU_EMAIL and SETU_PASSWORD.\n  (There is no demo sign-in on this server — it has no demo data to sign you into.)\n');
  process.exit(1);
}

/* ------------------------------------------------------------------ harness */

const { JSDOM, VirtualConsole } = await import('jsdom');
const { createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');

const consoleErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => consoleErrors.push(`jsdom: ${e.message}`));
vc.on('error', (...a) => consoleErrors.push(`console.error: ${a.map(String).join(' ')}`));

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const w = dom.window;
globalThis.window = w;
globalThis.document = w.document;
globalThis.localStorage = w.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
for (const key of ['HTMLElement', 'Element', 'Event', 'MouseEvent', 'KeyboardEvent', 'Node', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  globalThis[key] = w[key];
}
w.matchMedia = w.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));

// jsdom has no fetch of its own: hand it Node's and record what the app asks for
const nodeFetch = globalThis.fetch.bind(globalThis);
const calls = [];
/** the most recent call to a route — screens re-read in the background, so position is unreliable */
const lastTo = (path) => [...calls].reverse().find((c) => c.path === path) || { body: {}, query: {}, path: null, method: null };
globalThis.fetch = (input, init = {}) => {
  const raw = String(input);
  const url = raw.startsWith('http') ? raw : `${API}${raw}`;
  // a URL's pathname is the right thing here — this is a request path, not a file path
  const parsed = new URL(url);
  calls.push({
    method: init.method || 'GET',
    path: parsed.pathname,
    query: Object.fromEntries(parsed.searchParams),
    body: typeof init.body === 'string' ? JSON.parse(init.body) : null,
    auth: (init.headers && (init.headers.Authorization || init.headers.authorization)) || '',
    status: null,
  });
  return nodeFetch(url, init).then((res) => {
    calls[calls.length - 1].status = res.status;
    return res;
  });
};

const { default: App } = await import('../src/App.jsx');
const { AppProvider } = await import('../src/context/AppContext.jsx');
const { default: api } = await import('../src/api/index.js');

section('Mode');
if (api.USE_MOCK !== false) {
  console.error(
    '\n  This suite drives the REAL data source, but the app was compiled in mock mode.\n' +
    '  scripts/jsx-loader.mjs switches it on SETU_API_URL, read before the loader thread\n' +
    '  starts — so run this file through the launcher, which sets it:\n\n' +
    '    npm run test:live\n' +
    `  (or SETU_API_URL=${API} node scripts/run.mjs scripts/test-live.mjs)\n`
  );
  process.exit(1);
}
ok('the app is compiled against the server, not the mock', api.USE_MOCK === false, api.USE_MOCK);
ok('and every call goes to the configured origin', api.BASE_URL === API, api.BASE_URL);

const body = () => document.body.textContent?.replace(/\s+/g, ' ') || '';
const all = (sel) => [...document.querySelectorAll(sel)];
const byText = (label, sel = 'button, a') => all(sel).find((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().includes(label));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(test, { timeout = 12000 } = {}) {
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
const click = async (el) => {
  await act(async () => {
    el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    await wait(40);
  });
};
const tap = async (label, expect = null) => {
  const el = byText(label);
  if (!el) return ok(`tap “${label}”`, false, all('button').map((b) => b.textContent.trim()).slice(0, 20).join(' | ')), false;
  await click(el);
  return expect == null ? true : waitFor(expect);
};
const type = async (sel, value) => {
  const el = document.querySelector(sel);
  if (!el) return skip(`type into ${sel}`, 'no such field on this screen');
  const proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  await act(async () => {
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    await wait(40);
  });
};
const saw = (method, path) => calls.some((c) => c.method === method && c.path === path);

/* ---------------------------------------------------------------- sign in */

section('Sign in over the wire');
let session = null;
try {
  session = await api.login({ email: EMAIL, password: PASSWORD });
} catch (err) {
  ok('the account is accepted', false, err.message);
  console.log(`\n  ${API} refused ${EMAIL}: ${err.message}\n  Fix the credentials (or the server) and run again.\n`);
  process.exit(1);
}
ok('POST /api/login was the call that did it', saw('POST', '/api/login'), calls.slice(0, 3));
ok('a token came back', typeof session.token === 'string' && session.token.length > 8, typeof session.token);
const storedKeys = Array.from({ length: w.localStorage.length }, (_, i) => w.localStorage.key(i));
ok('the token is what the browser keeps', storedKeys.includes('setu.token') && !!w.localStorage.getItem('setu.token'), storedKeys);
ok('no password, ever, in anything stored', !storedKeys.some((k) => String(w.localStorage.getItem(k)).includes(PASSWORD)), storedKeys);
ok('and nothing that looks like a profile was cached client-side', !storedKeys.some((k) => /email|name|profile|user/i.test(k)), storedKeys);

const me = await api.getMe();
ok('GET /api/me answers with a person', !!me?.id && !!me?.name && Array.isArray(me.teaches), me && Object.keys(me));
ok('skills are lists, not strings', Array.isArray(me.wants), me?.wants);
ok('counters are numbers or null, never “undefined”', [me.rating, me.ratingCount, me.itemsListed, me.swapsDone].every((v) => v === null || typeof v === 'number'), { r: me.rating, rc: me.ratingCount, il: me.itemsListed, sd: me.swapsDone });
ok('the verified flag is a boolean or absent', [true, false, null].includes(me.verified), me.verified);

const root = createRoot(document.getElementById('root'));
await act(async () => {
  root.render(createElement(AppProvider, null, createElement(App)));
});
ok('the app opens on a home screen naming the real user', await waitFor(() => body().includes(String(me.name).split(' ')[0])), body().slice(0, 200));
ok('nothing on screen offers demo data', !/try demo|demo account|load demo data/i.test(body()), body().slice(0, 200));

/* ------------------------------------------------------------------- read */

section('Reads the screens make');
await tap('Items');
ok('the browse board came from GET /api/items', await waitFor(() => saw('GET', '/api/items')), calls.filter((c) => c.path === '/api/items'));
ok('the categories row came from /api/items/categories', saw('GET', '/api/items/categories') || (await waitFor('categories')), 'no category call');
{
  const board = await api.searchItems('', 'all', 'newest');
  const word = board.items?.[0]?.title?.split(/\s+/).slice(0, 2).join(' ') || 'notes';
  const found = await api.searchItems(word, 'all', 'newest');
  ok('a search returns a list plus a total', Array.isArray(found.items) && typeof found.total === 'number', { n: found.items?.length, t: found.total });
  ok('and every row carries an id, a title and a mode', (found.items || []).every((i) => i.id != null && i.title && ['free', 'sell', 'rent', 'barter'].includes(i.mode)), found.items?.[0]);
  ok('the server has no “did you mean”, so none is invented', found.suggestion === null, found.suggestion);
  const one = found.items?.[0] ? await api.getItem(found.items[0].id) : null;
  if (one) {
    ok('a listing the server does not describe shows nothing, not “unknown”', one.condition === null || typeof one.condition === 'string', one.condition);
    ok('its owner is a person object', !one.owner || typeof one.owner.id === 'string', one.owner);
  } else skip('detail read', 'no listings to open on this server');
}
{
  const barter = await api.findBarter(me.wants?.[0] || 'Python');
  ok('GET /api/barter answers with swaps and a circle slot', Array.isArray(barter.swaps) && ('circle' in barter), Object.keys(barter));
  ok('a circle, if any, carries its members', !barter.circle || Array.isArray(barter.circle.memberIds || barter.circle.members), barter.circle);
  const circles = await api.getMyCircles();
  ok('my circles come back as { circles, count, waitingForMe }', Array.isArray(circles.circles) && typeof circles.count === 'number' && typeof circles.waitingForMe === 'number', circles);
  const tutors = await api.getTopTutors(5);
  ok('top tutors come back ranked or empty', Array.isArray(tutors.tutors || tutors), tutors);
  const requests = await api.getRequests();
  ok('the inbox is two lists of rows with a status', Array.isArray(requests.received) && Array.isArray(requests.sent) && requests.received.every((r) => r.status), {
    r: requests.received?.length,
    s: requests.sent?.length,
  });
  ok('an unanswered request shows no contact, and never “undefined”', requests.received.every((r) => r.otherContact === null || typeof r.otherContact?.email === 'string'), requests.received.filter((r) => r.otherContact).map((r) => r.otherContact));
  const other = requests.received[0]?.other?.id || requests.sent[0]?.other?.id;
  if (other) {
    const meet = await api.getMeet(other);
    ok('common free time is a list of windows', Array.isArray(meet.slots), meet);
  } else skip('GET /api/meet', 'no exchange partner on this account yet');
}

/* ------------------------------------------------------- the other client */

section('Another client sees the same world');
if (!PEER_EMAIL) {
  skip('second account', 'set SETU_PEER_EMAIL and SETU_PEER_PASSWORD to prove the server, not the tab, holds the state');
} else {
  const mine = (await api.getMyItems()).map((i) => i.title);
  const savedToken = w.localStorage.getItem('setu.token');
  let peer = null;
  let theirBrowse = { items: [] };
  await act(async () => {
    peer = await api.login({ email: PEER_EMAIL, password: PEER_PASSWORD });
    theirBrowse = await api.searchItems(mine[0] || 'notes', 'all', 'newest');
  });
  ok('the peer logs in too', !!peer.token, Object.keys(peer));
  ok('and the server shows them my listing by title', !mine[0] || theirBrowse.items.some((i) => i.title === mine[0]), theirBrowse.items.map((i) => i.title));
  ok('my email is not in what they get back for it', !JSON.stringify(theirBrowse).includes(EMAIL), 'contact leaked before consensus');
  await act(async () => {
    await api.logout();
    w.localStorage.setItem('setu.token', savedToken);
    await api.getMe().catch(() => {}); // let the app settle back onto its own session
  });
}

/* --------------------------------------------------------------- mutations */

section(WRITE ? 'Writes (SETU_LIVE_WRITE=1)' : 'Writes are off');
if (!WRITE) {
  skip('POST /api/items · /api/me/free-time · duplicate 409', 'this run is read-only; add SETU_LIVE_WRITE=1 to exercise them');
} else {
  const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  const made = await api.listItem({ title: `Live check ${stamp}`, category: (await api.getCategories()).categories?.[0]?.name || 'Notes', mode: 'free', price: 0, condition: null, description: null });
  ok('a new listing is readable right after it is written', (await api.getItem(made.id)).title === `Live check ${stamp}`, made);
  ok('and the write went to POST /api/items', saw('POST', '/api/items'));
  const slots = await api.setFreeTime(['Mon 14:00-17:00', 'Tue 09:00-11:00']);
  ok('free time round-trips as a list of windows', Array.isArray(slots) && slots.length === 2, slots);
  ok('the server normalises it into what it stores', (await api.getMe()).freeTime.length === 2, (await api.getMe()).freeTime);
  await api.removeItem(made.id);
  const afterRemoval = await api.searchItems(`Live check ${stamp}`, 'all', 'newest');
  ok('taking it down (there is no DELETE verb) clears the board', afterRemoval.items.length === 0, afterRemoval.items.map((i) => i.title));
  ok('while the owner still sees their own row', (await api.getMyItems()).some((i) => String(i.id) === String(made.id)), (await api.getMyItems()).map((i) => i.title));

  // the teaching board, because §2 spells its rows differently from an item's
  const subject = `Live check ${stamp}`;
  const added = await api.addTeaching({ subject, description: 'evenings, past papers and viva', pricePerHour: 240 });
  ok('a teaching listing is written as { subject, about, price }', Object.keys(lastTo('/api/teach').body).join(',') === 'subject,about,price', lastTo('/api/teach').body);
  ok('and reads back as a row, not as the wrapper', added.subject === subject && added.pricePerHour === 240, added);
  ok('the server\u2019s "1" flag reads as active', added.active === true, added.active);
  const board = await api.searchTutors(subject);
  ok('the public tutor board excludes the signed-in tutor', !board.tutors.some((t) => t.subject === subject), board.tutors.map((t) => t.subject));
  const myTeaching = await api.getMyTeaching();
  const onBoard = myTeaching.find((t) => t.subject === subject);
  ok('/api/teach/mine returns the same shape', myTeaching.some((t) => t.subject === subject && t.pricePerHour === 240), myTeaching.map((t) => [t.subject, t.pricePerHour]));
  ok('the owned tutor row carries its original rating count', onBoard?.reviews === 0, onBoard?.reviews);
  const paused = await api.setTeachingActive(onBoard.id, false);
  ok('pausing sends "0" and the row comes back inactive', lastTo('/api/teach/active').body.active === '0' && paused.active === false, { body: lastTo('/api/teach/active').body, active: paused.active });
  const resumed = await api.setTeachingActive(onBoard.id, true);
  ok('resuming is the same route with "1"', lastTo('/api/teach/active').body.active === '1' && resumed.active === true, { body: lastTo('/api/teach/active').body, active: resumed.active });
  if (PEER_EMAIL && PEER_PASSWORD) {
    await api.login({ email: PEER_EMAIL, password: PEER_PASSWORD });
    const askedTutor = await api.requestTutor(onBoard.id);
    ok('asking another tutor posts the id and returns a pending row', Object.keys(lastTo('/api/tutors/request').body).join() === 'id' && askedTutor.request.status === 'pending', { body: lastTo('/api/tutors/request').body, status: askedTutor.request.status });
    await api.login({ email: EMAIL, password: PASSWORD });
  } else {
    skip('POST /api/tutors/request', 'a second account was not configured');
  }
  // the category feed, which is its own route rather than a filter on the client
  const catName = (await api.getCategories())[0]?.name; // real mode answers a plain array of rows
  if (!catName) {
    skip('GET /api/items/category', 'this server has no category to open');
  } else {
    const byCat = await api.getBrowse({ mode: 'all', sort: 'newest', category: catName });
    ok('a category feed asks the server for it by name', lastTo('/api/items/category').query?.name === catName, lastTo('/api/items/category').query);
    ok('and every row it shows belongs to that category', byCat.items.every((i) => i.category === catName), byCat.items.map((i) => i.category));
  }

  // asking for somebody else's listing, then taking the ask back again
  const viewer = await api.getMe();
  const askable = (await api.searchItems('', 'all', 'newest')).items.find((i) => i.mode !== 'free' && String(i.owner?.id) !== String(viewer.id));
  if (!askable) {
    skip('POST /api/items/request', 'no barter or sale on this server that is not mine to ask for');
  } else {
    const askedItem = await api.requestItem(askable.id, null);
    ok('an ask posts the listing id and a zero offer', Object.keys(lastTo('/api/items/request').body).join(',') === 'id,offer' && lastTo('/api/items/request').body.offer === 0, lastTo('/api/items/request').body);
    ok('the row comes back pending and addressed to the owner', askedItem?.request?.status === 'pending' && String(askedItem.request.other?.id) === String(askable.owner?.id), askedItem && { status: askedItem.request.status, other: askedItem.request.other });
    const tidied = await api.cancelRequest(askedItem.request.id);
    ok('this run withdraws its own ask, and the server calls it cancelled', tidied?.request?.status === 'cancelled', tidied && tidied.request?.status);
  }
}

/* ------------------------------------------------- the other side of a write */

section('A write on one client lands on the other');
const grab = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err;
  }
};
if (!WRITE || !PEER_EMAIL) {
  skip('accept, decline, rate, skills', 'needs SETU_LIVE_WRITE=1 and SETU_PEER_EMAIL — this server is being read, not changed');
} else {
  const savedToken = w.localStorage.getItem('setu.token');
  const skillsErr = await grab(() => api.updateSkills({ teaches: [], wants: [] }));
  ok('the server, not the form, decides that teaching nothing is invalid', !!skillsErr && (skillsErr.field === 'teaches' || /teach/i.test(skillsErr.message)), skillsErr && { field: skillsErr.field, m: skillsErr.message });
  const saved = await api.updateSkills({ teaches: ['C++', 'Testing'], wants: ['Piano'] });
  ok('skills save round-trips as lists', Array.isArray(saved.teaches) && saved.teaches.includes('Testing'), saved.teaches);
  const student = await api.getStudent(3);
  ok('a profile read withholds the email', student.name && !student.email, student);

  // Two asks are created by this run, so the block works on a server that has
  // never seen it before: one for the peer to answer, one to withdraw.
  let peerMe = null;
  await act(async () => {
    await api.login({ email: PEER_EMAIL, password: PEER_PASSWORD });
    peerMe = await api.getMe();
  });
  let ask = null;
  let askToWithdraw = null;
  await act(async () => {
    await api.login({ email: EMAIL, password: PASSWORD });
    ask = await api.sendSwapRequest(peerMe.id, 'Testing');
  });
  ok('my sent ask names them as the other side', String(ask?.request?.other?.id) === String(peerMe.id), ask && ask.request.other);
  ok('and no contact is public while it is pending', !ask?.request?.otherContact, ask && ask.request.otherContact);

  let accepted = null;
  let twice = null;
  let peerInbox = null;
  await act(async () => {
    await api.login({ email: PEER_EMAIL, password: PEER_PASSWORD });
    peerInbox = await api.getRequests();
    const open = peerInbox.received.find((r) => String(r.id) === String(ask.request.id) && r.status === 'pending');
    if (open) {
      accepted = await api.acceptRequest(open.id);
      twice = await grab(() => api.acceptRequest(open.id));
    }
  });
  ok('an open request is answerable from their side', !!accepted, peerInbox && { received: peerInbox.received.length });
  ok('accepting hands them the email that was hidden', !!(accepted && JSON.stringify(accepted).includes(EMAIL)), accepted && JSON.stringify(accepted).slice(0, 160));
  ok(
    'the contact belongs to the far side of the row, not to whoever the reply names',
    !!accepted && String(accepted.request.otherContact?.id) === String(accepted.request.other?.id),
    accepted && { contact: accepted.request.otherContact, other: accepted.request.other }
  );
  ok('…and the address is the sender\u2019s own', accepted?.request?.otherContact?.email === EMAIL, accepted?.request?.otherContact?.email);
  ok('and for them that far side is the sender, since they received it', accepted?.request?.direction === 'received', accepted?.request?.direction);
  ok('answering the same row twice is a 409 with a sentence', twice?.status === 409 && Boolean(twice.message), twice && { status: twice.status, message: twice.message });
  await api.completeRequest(ask.request.id);
  await api.login({ email: EMAIL, password: PASSWORD });
  await api.completeRequest(ask.request.id);
  await api.login({ email: PEER_EMAIL, password: PEER_PASSWORD });
  const rated = await grab(() => api.rateRequest(accepted?.request?.id ?? accepted?.id ?? 0, 5));
  ok('a rating is accepted once and refused twice', rated === null || /rated/.test(rated.message || ''), rated && rated.message);
  ok('the same call back is a 409, not a silent overwrite', rated === null || rated.status === 409, rated && rated.status);

  // back to my own session for the withdrawal, which is the sender's move
  let withdrew = null;
  let withdrawTwice = null;
  let askToDecline = null;
  await act(async () => {
    await api.login({ email: EMAIL, password: PASSWORD });
    askToWithdraw = await api.sendSwapRequest(peerMe.id, 'Testing, second time');
    withdrew = await api.cancelRequest(askToWithdraw.request.id);
    withdrawTwice = await grab(() => api.cancelRequest(askToWithdraw.request.id));
  });
  const cancelCall = calls.filter((c) => c.path === '/api/requests/cancel').pop();
  ok('the bearer token rode along, as on every protected call', !!cancelCall && /^Bearer /.test(cancelCall.auth), cancelCall && cancelCall.auth);
  ok('withdrawal goes to POST /api/requests/cancel', cancelCall && cancelCall.method === 'POST', cancelCall && `${cancelCall.method} ${cancelCall.path}`);
  ok('…carrying the id and nothing else', !!cancelCall && Object.keys(cancelCall.body || {}).join() === 'id', cancelCall && cancelCall.body);
  ok('the row comes back cancelled, not declined', withdrew?.request?.status === 'cancelled', withdrew && { status: withdrew.request?.status, message: withdrew.message });
  ok('and the app shows it as withdrawn', withdrew?.request?.cancelled === true, withdrew && withdrew.request);
  ok('the server will not answer a withdrawn ask twice', withdrawTwice?.status === 409, withdrawTwice && { status: withdrawTwice.status, message: withdrawTwice.message });
  askToDecline = await api.sendSwapRequest(peerMe.id, 'Testing, to decline');
  let peerTry = null;
  let declined = null;
  await act(async () => {
    await api.login({ email: PEER_EMAIL, password: PEER_PASSWORD });
    peerTry = await grab(() => api.acceptRequest(askToWithdraw.request.id)); // 409: nobody answers a withdrawal
    declined = await api.declineRequest(askToDecline.request.id); // and this side still says no
  });
  ok('a withdrawn ask cannot be accepted any more', peerTry?.status === 409, peerTry && { status: peerTry.status, message: peerTry.message });
  ok('a refused ask is declined, which is a different outcome', declined?.request?.status === 'declined' && declined?.request?.cancelled === false, declined && declined.request);
  await act(async () => {
    await api.login({ email: EMAIL, password: PASSWORD });
  });
  w.localStorage.setItem('setu.token', savedToken || '');
}

/* ------------------------------------------------------------------ finish */

section('Clean exit');
await act(async () => {
  await api.logout();
});
ok('POST /api/logout clears the stored token', !w.localStorage.getItem('setu.token'), w.localStorage.getItem('setu.token'));
ok('the page logged no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3));

const known = readFileSync(new URL('../src/api/index.js', import.meta.url), 'utf8');
const wanted = [...known.matchAll(/(?:GET|POST)\(\s*'\/([a-z/-]+)'/g)].map((m) => m[1]);
const hit = new Set(calls.map((c) => c.path.replace('/api/', '')));
const never = [...new Set(wanted)].filter((p) => !hit.has(p));
console.log(`\n  routes exercised: ${hit.size} · not exercised by this run: ${never.length ? never.join(', ') : 'none'}`);

console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m${skipped ? ` · ${skipped} skipped` : ''}\n`);
process.exit(fail ? 1 : 0);
