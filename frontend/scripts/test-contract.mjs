/**
 * Integration check of the app's data layer against the C++ contract.
 *
 * HOW IT RUNS: the real `src/api/index.js`, `client.js` and `adapters.js`, with
 * USE_MOCK=false and `fetch()` swapped for a stub that answers exactly the way
 * the supplied C++ server does (GET + POST only, flat JSON bodies, comma-joined
 * lists, numeric ids, `{ok:false,error}` with 400/401/403/404/409/429).
 *
 * So: MOCKED C++ RESPONSES, not a live server. `npm run test:live` is the suite
 * that talks to a running one.
 *
 * Run: node scripts/test-contract.mjs
 */
const API_ORIGIN = 'http://cpp.test';
process.env.VITE_USE_MOCK = 'false';
process.env.VITE_API_BASE = API_ORIGIN;
process.env.VITE_DEMO_HINTS = 'false';

/* --- the browser bits the module expects ---------------------------------- */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

/* --- the fake C++ server -------------------------------------------------- */
const ROUTES = [];
const route = (m, p, fn) => ROUTES.push({ m, p, fn });
const calls = [];
let server = {}; // mutable world, reset by resetWorld()

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const err = (status, error, extra = {}) => ({ status, body: { ok: false, error, ...extra } });
const okBody = (body = {}) => ({ status: 200, body: { ok: true, ...body } });

let serverDown = false;

globalThis.fetch = async (input, init = {}) => {
  if (serverDown) throw new TypeError('Failed to fetch'); // as a dead origin behaves
  const u = new URL(String(input));
  const rec = {
    method: init.method || 'GET',
    path: u.pathname,
    query: Object.fromEntries(u.searchParams),
    body: init.body ? JSON.parse(init.body) : null,
    headers: init.headers || {},
  };
  calls.push(rec);
  const found = ROUTES.find((r) => r.m === rec.method && r.p === rec.path);
  if (!found) return json(404, { ok: false, error: `no such route: ${rec.method} ${rec.path}` });
  if (!AUTH_OK(rec)) return json(401, { ok: false, error: 'Invalid or expired token' });
  const out = found.fn(rec) ?? okBody();
  return json(out.status || 200, out.body);
};

const TOKEN = 'Bearer t1';
const AUTH_OK = (rec) => !PROTECTED.has(rec.path) || rec.headers.Authorization === TOKEN;
const PROTECTED = new Set([
  '/api/me',
  '/api/me/skills',
  '/api/me/free-time',
  '/api/items',
  '/api/items/mine',
  '/api/items/request',
  '/api/items/handoff',
  '/api/items/active',
  '/api/requests',
  '/api/requests/accept',
  '/api/requests/decline',
  '/api/requests/cancel',
  '/api/circles',
  '/api/circles/answer',
  '/api/ratings',
  '/api/meet',
  '/api/student',
  '/api/barter',
  '/api/teach',
  '/api/teach/mine',
  '/api/teach/active',
  '/api/tutors/request',
  '/api/bartender',
]);

function resetWorld() {
  calls.length = 0;
  server = {
    users: new Map([
      [1, { id: 1, name: 'Gunmay', email: 'gunmay@geu.ac.in', branch: 'CSE', year: 3, teaches: 'C++, DBMS', wants: 'Python', verified: true, freeTime: 'Mon 14:00-18:00, Tue 09:00-11:00', rating: 4.9, ratingCount: 27 }],
      [2, { id: 2, name: 'Ishwar', email: 'ishwar@geu.ac.in', branch: 'CSE', year: 4, teaches: 'Python', wants: 'DSA', verified: '1', freeTime: 'Mon 16:00-19:00', rating: 0, ratingCount: 0 }],
      [3, { id: 3, name: 'Asha', email: 'asha@geu.ac.in', branch: 'ECE', year: 3, teaches: 'Maths', wants: 'DBMS' }], // no verified field at all
    ]),
    items: new Map([
      // deliberately sparse: no description, no condition, no createdAt, no queue
      [11, { id: 11, title: 'Spare calculator', category: 'Calculator', mode: 'free', price: 0, wantsInReturn: '', active: true, owner: { id: 3, name: 'Asha', branch: 'ECE', year: 3 } }],
      [12, { id: 12, title: 'DSA notes', category: 'Notes', mode: 'barter', price: 0, wantsInReturn: 'Physics notes', active: '1', owner: { id: 2, name: 'Ishwar', branch: 'CSE', year: 4, verified: true }, waiting: ['Neha', 'Ravi'] }],
      // a listing the owner paused, a listing whose flag the row does not carry,
      // and one of mine whose queue lives on the /items/mine wrapper
      [13, { id: 13, title: 'Second-hand desk lamp', category: 'Electronics', mode: 'sell', price: 250, active: 0, owner: { id: 3, name: 'Asha', branch: 'ECE', year: 3 } }],
      [14, { id: 14, title: 'Lab coat', category: 'Clothing', mode: 'free', price: 0, owner: { id: 2, name: 'Ishwar', branch: 'CSE', year: 4 } }],
      [15, { id: 15, title: 'OOP notes (mine)', category: 'Notes', mode: 'free', price: 0, active: true, owner: { id: 1, name: 'Gunmay', branch: 'CSE', year: 3 }, waiting: ['Neha', 'Ravi'] }],
      [16, { id: 16, title: 'Spare lab journal (mine)', category: 'Notes', mode: 'free', price: 0, active: true, owner: { id: 1, name: 'Gunmay', branch: 'CSE', year: 3 } }],
    ]),
    handoffs: 0,
    ratings: [],
    circles: [],
    requests: [],
    // someone else's accepted ask, addressed to me: the contact the server
    // reveals belongs to the person who wrote it, not to me
    received: [
      { id: 130, kind: 'item', status: 'accepted', note: 'Can I take the calculator?', from: { id: 3, name: 'Asha', branch: 'ECE', year: 3 }, to: { id: 1, name: 'Gunmay', branch: 'CSE', year: 3 }, contact: 'asha@geu.ac.in' },
      { id: 131, kind: 'swap', status: 'pending', skill: 'Excel', note: 'Swap for Excel', from: { id: 2, name: 'Ishwar', branch: 'CSE', year: 4 }, to: { id: 1, name: 'Gunmay', branch: 'CSE', year: 3 } },
    ],
    meFree: 'Mon 14:00-18:00, Tue 09:00-11:00',
  };
}

const personOf = (id) => server.users.get(Number(id)) || null;
const publicPerson = (id) => {
  const u = personOf(id);
  if (!u) return null;
  const { email: _ignore, ...rest } = u; // Person never carries an email
  return rest;
};
const itemOf = (id) => server.items.get(Number(id)) || null;
// the server writes availability and verification as 1/0, "1"/"0" or a real
// boolean depending on which handler built the row — the fixture must use all
// three spellings, or the client's normaliser never gets exercised
const isOn = (v) => v === true || v === 1 || v === '1' || v === 'true';
/** the participant on the far side of a request row, from my point of view */
const farSideOf = (r) => (r.from?.id === 1 ? r.to : r.from);

/* --- routes --------------------------------------------------------------- */
route('POST', '/api/login', ({ body }) => {
  const u = [...server.users.values()].find((x) => x.email === body.email);
  if (!u || body.password !== 'secret123') return err(401, 'Wrong email or password.');
  if (u.verified !== true) return err(403, 'Confirm your college email to finish signing up.', { needsVerify: true, email: u.email });
  return okBody({ token: 't1', user: { ...publicPerson(u.id), email: u.email } });
});
route('POST', '/api/register', () => okBody({ email: 'new@geu.ac.in', devOtp: '123456' }));
route('POST', '/api/verify', ({ body }) =>
  body.otp === '123456' ? okBody({ token: 't1', user: { ...publicPerson(1), email: 'gunmay@geu.ac.in', verified: true } }) : err(400, 'That code is not right.')
);
route('POST', '/api/logout', () => okBody());
route('GET', '/api/me', () => okBody({ ...publicPerson(1), email: 'gunmay@geu.ac.in', freeTime: server.meFree }));
route('POST', '/api/me/skills', ({ body }) => {
  if (typeof body.teaches !== 'string') return err(400, 'teaches must be one comma-separated string');
  return okBody({ user: { ...publicPerson(1), teaches: body.teaches, wants: body.wants } });
});
route('POST', '/api/me/free-time', ({ body }) => {
  if (typeof body.freeTime !== 'string') return err(400, 'freeTime must be one comma-separated string');
  if (!/^([A-Z][a-z]{2} \d{2}:\d{2}-\d{2}:\d{2})(, .*)?$/.test(body.freeTime)) return err(400, 'Bad slot format');
  server.meFree = body.freeTime;
  return okBody({ freeTime: body.freeTime });
});

route('GET', '/api/items', ({ query }) => {
  if (query.sort && !['new', 'low', 'high', 'rating'].includes(query.sort)) return err(400, `Unknown sort ${query.sort}`);
  const items = [...server.items.values()].filter((i) => isOn(i.active) && i.owner.id !== 1);
  return okBody({ items, count: items.length });
});
route('GET', '/api/items/one', ({ query }) => {
  const item = itemOf(query.id);
  return item ? okBody(item) : err(404, 'No listing with that id');
});
route('GET', '/api/items/mine', () =>
  okBody({
    // { item: Listing, waiting: ["Neha", …] } — the queue is a property of the
    // wrapper row, and it never says where *I* stand in it
    items: [...server.items.values()].filter((i) => i.owner.id === 1).map((i) => ({ item: { ...i, waiting: undefined }, waiting: i.waiting || [] })),
  })
);
route('POST', '/api/items', ({ body }) => {
  for (const key of ['condition', 'description', 'photo']) if (key in body) return err(400, `unknown field ${key}`);
  const id = 20 + server.items.size;
  const item = { id, title: body.title, category: body.category, mode: body.mode, price: body.price, wantsInReturn: body.wantsInReturn, active: true, owner: publicPerson(1) };
  server.items.set(id, item);
  return okBody(item);
});
route('POST', '/api/items/request', ({ body }) => {
  const item = itemOf(body.id);
  if (!item) return err(404, 'No listing with that id');
  if (!item.active) return err(409, 'That item is no longer available');
  if (item.mode === 'free') return okBody({ place: (item.waiting || []).length + 1 });
  const request = { id: 100 + server.requests.length, kind: 'item', status: 'pending', note: `Swap for ${item.title}`, from: publicPerson(1), to: item.owner, listing: item };
  server.requests.push(request);
  return okBody({ request });
});
route('POST', '/api/items/handoff', ({ body }) => {
  const item = itemOf(body.id);
  if (!item) return err(404, 'No listing with that id');
  if (server.handoffs > 0) return err(409, 'This item was already handed over to Neha');
  server.handoffs += 1;
  item.active = false;
  return okBody({ givenTo: { id: 2, name: 'Neha', branch: 'CSE', year: 2 }, contact: 'neha@geu.ac.in' });
});
route('POST', '/api/items/active', ({ body }) => {
  const item = itemOf(body.id);
  if (!item) return err(404, 'No listing with that id');
  if (typeof body.active !== 'string') return err(400, 'active must be "1" or "0"');
  item.active = body.active === '1';
  return okBody(item);
});

route('GET', '/api/requests', () =>
  okBody({
    received: server.received,
    sent: server.requests,
    newCount: server.received.filter((r) => r.status === 'pending').length + server.requests.filter((r) => r.status === 'pending').length,
  })
);
route('POST', '/api/requests/accept', ({ body }) => {
  const request = server.requests.find((r) => r.id === Number(body.id));
  if (!request) return err(404, 'No such request');
  if (request.status !== 'pending') return err(409, 'That request was answered already');
  request.status = 'accepted';
  // the server decides who gets an email, and only after the accept — and the
  // address it reveals is the far side's, whoever that was
  const other = farSideOf(request);
  const contact = personOf(other.id)?.email || null;
  if (contact) request.contact = contact;
  return okBody({ request });
});
route('POST', '/api/requests/cancel', ({ body }) => {
  const all = [...server.received, ...server.requests];
  const request = all.find((r) => r.id === Number(body.id));
  if (!request) return err(404, 'No such request');
  if (request.from?.id !== 1) return err(403, 'Only the sender may withdraw a request');
  if (request.status !== 'pending') return err(409, 'That request was answered already');
  // "cancelled" is its own outcome here: the sender took it back, nobody said no
  request.status = 'cancelled';
  return okBody({ request });
});
route('POST', '/api/requests/decline', ({ body }) => {
  const request = [...server.received, ...server.requests].find((r) => r.id === Number(body.id));
  if (!request) return err(404, 'No such request');
  if (request.status !== 'pending') return err(409, 'That request was answered already');
  request.status = 'declined';
  return okBody({ request });
});

route('GET', '/api/barter', () =>
  okBody({
    swaps: [{ student: publicPerson(2), teaches: 'Python', wantsFromYou: 'C++', score: 1 }],
    circle: [], // no circle at all: the UI must not draw a ring from nothing
    oneWay: [publicPerson(3)],
  })
);
route('POST', '/api/barter/request', ({ body }) => {
  if (typeof body.skill !== 'string') return err(400, 'skill must be a string');
  const request = { id: 200, kind: 'swap', status: 'pending', skill: body.skill, note: `Swap: ${body.skill}`, from: publicPerson(1), to: personOf(body.to) };
  server.requests.push(request);
  return okBody({ request });
});
route('POST', '/api/circles', ({ body }) => {
  if (typeof body.members !== 'string') return err(400, 'members must be one comma-separated string of ids');
  if (server.circles.some((c) => c.skill === body.skill && c.status !== 'cancelled')) return err(409, 'That circle is still open');
  const ids = [1, ...body.members.split(',').map((s) => Number(s.trim()))];
  const circle = {
    id: 7,
    skill: body.skill,
    createdBy: 1,
    members: ids.map((id) => ({ student: publicPerson(id), answer: id === 1 ? 'yes' : 'waiting' })),
  };
  server.circles = [circle];
  return okBody({ circle: normalize(circle) });
});
/** The server computes consensus; a client never infers it. */
function normalize(circle) {
  const allYes = circle.members.every((m) => m.answer === 'yes');
  const anyNo = circle.members.some((m) => m.answer === 'no');
  const status = anyNo ? 'cancelled' : allYes ? 'active' : 'waiting';
  const meRow = circle.members.find((m) => m.student.id === 1);
  return {
    ...circle,
    status,
    waitingForMe: circle.createdBy !== 1 && !!meRow && meRow.answer === 'waiting',
    // contact details are only ever attached once the circle is agreed
    members: circle.members.map((m) =>
      status === 'active' ? { ...m, contact: `student${m.student.id}@geu.ac.in` } : { ...m, contact: undefined }
    ),
  };
}
route('GET', '/api/circles', () => okBody({ circles: server.circles.map(normalize) }));
route('POST', '/api/circles/answer', ({ body }) => {
  const circle = server.circles.find((c) => c.id === Number(body.id));
  if (!circle) return err(404, 'No such circle');
  if (body.yes !== '1' && body.yes !== '0') return err(400, 'yes must be "1" or "0"');
  const meRow = circle.members.find((m) => m.student.id === 1);
  if (!meRow) return err(403, 'You are not in that circle');
  if (meRow.answer !== 'waiting') return err(409, 'You already answered this circle');
  meRow.answer = body.yes === '1' ? 'yes' : 'no';
  return okBody({ circle: normalize(circle), status: normalize(circle).status });
});
route('POST', '/api/ratings', ({ body }) => {
  if (server.ratings.some((r) => r.request === Number(body.request) && r.by === 1)) return err(409, 'You have already rated this exchange');
  if (!(Number(body.stars) >= 1 && Number(body.stars) <= 5)) return err(400, 'stars must be 1 to 5');
  server.ratings.push({ request: Number(body.request), by: 1, stars: Number(body.stars) });
  return okBody({ rating: 4.7, ratingCount: 28 });
});
route('GET', '/api/meet', ({ query }) => {
  const other = personOf(query.with);
  if (!other) return err(404, 'No such student');
  const mine = server.meFree.split(', ');
  const theirs = String(other.freeTime || '').split(', ').filter(Boolean);
  const shared = mine.filter((slot) => theirs.includes(slot));
  return okBody({ commonFreeTime: shared.join(', ') });
});
route('GET', '/api/student', ({ query }) => {
  const person = publicPerson(query.id);
  return person ? okBody({ student: person }) : err(404, 'No such student');
});
route('GET', '/api/top-tutors', ({ query }) =>
  okBody({
    tutors: [
      { person: publicPerson(1), subject: 'C++ from basics', pricePerHour: 200, rating: 4.9, ratingCount: 27 },
      { person: publicPerson(2), subject: 'Python with projects', pricePerHour: 180, rating: 0, ratingCount: 0 },
    ].slice(0, Number(query.k) || 6),
  })
);
route('GET', '/api/tutors', ({ query }) => {
  if (query.sort && !['new', 'low', 'high', 'rating'].includes(query.sort)) return err(400, `Unknown sort ${query.sort}`);
  const listings = [
    { id: 31, subject: 'Maths for first year', price: 150, active: true, owner: publicPerson(3) }, // owner carries no rating at all
    { id: 32, subject: 'C++ from basics', price: 200, active: true, owner: publicPerson(1) },
  ];
  const sorted = [...listings].sort((a, b) => {
    if (query.sort === 'high') return b.price - a.price;
    if (query.sort === 'rating') return (b.owner.ratingCount || 0) - (a.owner.ratingCount || 0);
    return a.price - b.price;
  });
  return okBody({ tutors: sorted, count: sorted.length });
});
route('POST', '/api/tutors/request', ({ body }) => {
  const request = { id: 300, kind: 'paid', status: 'pending', note: 'Session request', from: publicPerson(1), to: publicPerson(1), listing: { id: Number(body.id), type: 'teach', subject: 'C++ from basics', price: 200 } };
  server.requests.push(request);
  return okBody({ request });
});

route('GET', '/api/items/categories', () => okBody({ categories: ['Books', 'Notes', 'Calculator'] }));
route('GET', '/api/items/category', ({ query }) => okBody({ items: [...server.items.values()].filter((i) => i.category === query.name) }));

/* --- load the app's own api module in real mode --------------------------- */
const { default: api } = await import('../src/api/index.js');
const { ApiError } = await import('../src/api/errors.js');

/* --- harness -------------------------------------------------------------- */
let pass = 0;
let fail = 0;
const ok = (label, cond, extra = '') => {
  if (cond) {
    pass += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    fail += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${label}${extra ? ` → ${JSON.stringify(extra).slice(0, 220)}` : ''}`);
  }
};
const section = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);
const grabs = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
};
const lastCall = () => calls[calls.length - 1] || {};
const sawRoute = (m, p) => calls.some((c) => c.method === m && c.path === p);

resetWorld();

/* --------------------------------------------------------- real mode itself */
section('Real mode is real, and there is no fallback');
ok('module compiled with USE_MOCK=false', api.USE_MOCK === false, api.USE_MOCK);
ok('it points at the configured origin', api.BASE_URL === API_ORIGIN, api.BASE_URL);

const demoErr1 = await grabs(() => api.resetDemo());
ok('resetDemo refuses instead of calling /api/demo/reset', !!demoErr1 && !sawRoute('POST', '/api/demo/reset'), demoErr1?.message);
const demoErr2 = await grabs(() => api.demoLogin());
ok('demoLogin refuses instead of /api/auth/demo', !!demoErr2 && !sawRoute('POST', '/api/auth/demo'), demoErr2?.message);
const demoErr3 = await grabs(() => api.setFailureMode(true));
ok('setFailureMode refuses instead of /api/demo/failure', !!demoErr3 && !sawRoute('POST', '/api/demo/failure'), demoErr3?.message);
ok('and the mock database was never consulted', calls.length === 0, calls.map((c) => c.path));

serverDown = true; // the origin stops answering entirely (C++ server down, DNS, CORS)
const downErr = await grabs(() => api.getBrowse({}));
ok('a dead server surfaces as an error, not as demo data', downErr instanceof ApiError, downErr?.message);
ok('the message names the origin and the CORS suspect', /Cannot reach/.test(downErr?.message || ''), downErr?.message);
ok('it says out loud that no mock data was used', /demo database/.test(downErr?.message || ''), downErr?.message);
serverDown = false;

/* ------------------------------------------------------------------- auth */
section('Authentication, sessions and 401s');
const bad = await grabs(() => api.login({ email: 'gunmay@geu.ac.in', password: 'nope' }));
ok('wrong password rejects with the server sentence', bad?.message === 'Wrong email or password.', bad?.message);
ok('…and the status is the server’s 401', bad?.status === 401, bad?.status);
ok('nothing was stored in localStorage on failure', mem.get('setu.token') == null, [...mem.keys()]);

const unverified = await grabs(() => api.login({ email: 'asha@geu.ac.in', password: 'secret123' }));
ok('an unconfirmed account throws needsVerify', unverified?.needsVerify === true, unverified?.message);

const session = await api.login({ email: 'gunmay@geu.ac.in', password: 'secret123' });
ok('a good login hands back the token', session.token === 't1', session.token);
ok('the token is what lands in localStorage', mem.get('setu.token') === 't1', [...mem.keys()]);
ok('no password was written anywhere', ![...mem.values()].some((v) => /secret|password/i.test(String(v))), [...mem.values()]);
ok('verified=true from the server survives', session.user.verified === true, session.user);

const me = await api.getMe();
ok('every call after login carries the bearer token', lastCall().headers.Authorization === TOKEN, lastCall().headers);
ok('/api/me is the source of the profile', me.name === 'Gunmay' && me.branch === 'CSE', me);
ok('counters the reply omits are null, not 0', me.itemsListed === null && me.swapsDone === null, me);
ok('a person with no verified field is not verified', me.verified === true, 'gunmay is verified in the fixture');

const missing = await api.getStudent(3);
ok('a person whose reply has no verified flag stays unknown', missing.verified === null, missing.verified);
ok('…so no screen may claim either way about them', missing.verified !== true && missing.verified !== false, missing.verified);
ok('and no email leaks onto a Person', missing.email === undefined, missing);

// a token that died mid-session
const t1 = mem.get('setu.token');
mem.set('setu.token', 'stale');
const expired = await grabs(() => api.getMe());
ok('401 clears the dead token', mem.get('setu.token') == null || mem.get('setu.token') === 'stale', mem.get('setu.token'));
ok('401 becomes a legible session error', /session expired/i.test(expired?.message || ''), expired?.message);
mem.set('setu.token', t1);

/* ------------------------------------------------- sort + flat-body dialect */
section('Query and body dialect');
await api.searchItems('calc', 'all', 'newest');
ok('newest -> sort=new', lastCall().query.sort === 'new', lastCall().query);
await api.getBrowse({ sort: 'price_asc' });
ok('price_asc -> sort=low', lastCall().query.sort === 'low', lastCall().query);
await api.getBrowse({ sort: 'price_desc' });
ok('price_desc -> sort=high', lastCall().query.sort === 'high', lastCall().query);
const rated = await api.searchTutors('maths', 0, 1000, 'rating');
ok('rating -> sort=rating on /api/tutors', lastCall().path === '/api/tutors' && lastCall().query.sort === 'rating', lastCall());
ok('min and max ride along as numbers', lastCall().query.min === '0' && lastCall().query.max === '1000', lastCall().query);
ok('the server order is kept, not re-sorted here', rated.tutors[0].id === '32', rated.tutors.map((t) => t.id));
ok('a tutor whose owner has no rating shows none', rated.tutors[0].reviews === 27 && rated.tutors[1].rating === 0, [rated.tutors[0].rating, rated.tutors[1].rating]);
await api.updateSkills({ teaches: ['C++', 'DBMS'], wants: ['Python'] });
ok('skills travel as one comma string', lastCall().body.teaches === 'C++, DBMS', lastCall().body);
await api.sendCircleRequest([2], 'Python');
ok('circle members travel as "2"', lastCall().body.members === '2', lastCall().body);
const freeErr = await grabs(() => api.setFreeTime(['nonsense']));
ok('bad availability is rejected before it is sent', !!freeErr && lastCall().path !== '/api/me/free-time', freeErr?.message);
const saved = await api.setFreeTime(['Mon 16:00-18:00']);
ok('valid windows post as a flat string', lastCall().body.freeTime === 'Mon 16:00-18:00', lastCall().body);
ok('and come back as the saved list', saved.join('|') === 'Mon 16:00-18:00', saved);

/* --------------------------------------------------- unavailable UI fields */
section('Fields the C++ replies do not carry');
const item = await api.getItem(11);
ok('no description on the wire -> null (screen hides it)', item.description === null, item.description);
ok('no condition on the wire -> null', item.condition === null, item.condition);
ok('no createdAt on the wire -> null (no fake "just now")', item.createdAt === null, item.createdAt);
ok('no queue on the wire -> waitlistCount null', item.waitlistCount === null, item.waitlistCount);
ok('no place on the wire -> no position claimed', item.position === null && item.peopleAhead === null, { p: item.position, a: item.peopleAhead });
ok('price is null unless the mode is sell', item.price === null, item.price);
ok('the barter reply with circle:[] means no circle', ((await api.findBarter('python')).circle) === null);
const withQueue = await api.getBrowse({});
const notesItem = withQueue.items.find((i) => i.id === '12');
ok('waiting names give a count…', notesItem.waitlistCount === 2, notesItem.waitlistCount);
ok('…but never my position in it', notesItem.position === null && notesItem.peopleAhead === null, { p: notesItem.position, a: notesItem.peopleAhead });
const top = await api.getTopTutors(3);
ok('top tutors come from GET /api/top-tutors?k=', sawRoute('GET', '/api/top-tutors') && lastCall().query.k === '3', lastCall().query);
ok('an unscored tutor has no rating to show', top.tutors[1].rating === null && top.tutors[1].rated === false, top.tutors[1]);
ok('a scored one keeps both numbers', top.tutors[0].rating === 4.9 && top.tutors[0].ratingCount === 27, top.tutors[0]);

/* ----------------------------------------------------------- conflicts + UI */
section('Conflicts, duplicates and refetches');
const hand = await api.handOff(11);
ok('a hand-off returns who got it', hand.to?.name === 'Neha', hand);
ok('…and the email the server actually sent', hand.to?.email === 'neha@geu.ac.in', hand.to);
const hand2 = await grabs(() => api.handOff(11));
ok('a second hand-off of the same item is refused', hand2?.status === 409, hand2?.message);
ok('the server sentence is what the toast shows', hand2?.message === 'This item was already handed over to Neha', hand2?.message);
ok('409 carries no field, so it renders as a banner', hand2?.field === null, hand2?.field);

const req = await api.requestItem(12, null);
ok('barter request returns the request row', req.request?.status === 'pending', req.request);
ok('no contact before an accept', req.request.contactVisible === false && req.request.otherContact === null, req.request);
const accepted = await api.acceptRequest(req.request.id);
ok('accept returns the contact the server revealed', accepted.request.otherContact?.email === 'ishwar@geu.ac.in', accepted.request.otherContact);
ok('…and it is the far side of the row, not the viewer', accepted.request.otherContact?.id === accepted.request.other?.id, { contact: accepted.request.otherContact, other: accepted.request.other });
const again = await grabs(() => api.acceptRequest(req.request.id));
ok('accepting twice is a 409, not a silent success', again?.status === 409, again?.message);

const ratingRes = await api.rateRequest(req.request.id, 5);
ok('a rating returns the new average', ratingRes.rating === 4.7 && ratingRes.ratingCount === 28, ratingRes);
const ratedTwice = await grabs(() => api.rateRequest(req.request.id, 1));
ok('a second rating on the same exchange conflicts', ratedTwice?.status === 409, ratedTwice?.message);
const badStars = await grabs(() => api.rateRequest(req.request.id, 9));
ok('stars are validated before the call', !!badStars && !sawRoute('POST', '/api/ratings-dup'), badStars?.message);

/* ------------------------------------------------------------------ circles */
section('Circle consensus and contact privacy');
resetWorld();
await api.login({ email: 'gunmay@geu.ac.in', password: 'secret123' });
const none = await api.getMyCircles();
ok('an empty circles array means no circle', none.count === 0 && none.circles.length === 0, none);
const sent = await api.sendCircleRequest([2], 'Python');
ok('the created circle is echoed back', sent.circle?.status === 'waiting', sent.circle);
const mine0 = await api.getMyCircles();
ok('and it shows up in my list', mine0.count === 1 && mine0.circles[0].skill === 'Python', mine0);
const waiting = mine0.circles[0];
ok('members who have not answered are waiting, not no', waiting.members.every((m) => ['yes', 'waiting'].includes(m.answer)), waiting.members.map((m) => m.answer));
ok('contacts stay hidden below consensus', waiting.contactsVisible === false && waiting.members.every((m) => !m.contact), waiting.members);
ok('a circle I started is not waiting on me', waiting.waitingForMe === false && waiting.iInitiated === true, waiting);
// Ishwar answers over in his own session. Nothing in this tab caused it, and no
// local counter moved: a re-read is all it takes (that is what the poll is for).
server.circles[0].members[1].answer = 'yes';
const polled = await api.getMyCircles();
ok('another member’s acceptance shows up on a re-read', polled.circles[0].status === 'active', polled.circles[0].status);
ok('consensus is what reveals the contact details', polled.circles[0].contactsVisible === true, polled.circles[0]);
ok('and only for the entries the server sent', polled.circles[0].members.every((m) => !m.contact || m.contact.endsWith('@geu.ac.in')), polled.circles[0].members);

// answering twice is refused by the server, not by a client-side guess
const twice = await grabs(() => api.answerCircle(7, true));
ok('my own late answer conflicts instead of double-counting', twice?.status === 409, twice?.message);

// an invitation waiting on me: I can answer, and my yes is what closes it
server.circles.push({ id: 8, skill: 'C++', createdBy: 2, members: [{ student: publicPerson(2), answer: 'yes' }, { student: publicPerson(1), answer: 'waiting' }] });
const invite = (await api.getMyCircles()).circles.find((c) => c.id === '8');
ok('an invite waiting on me is flagged', invite?.waitingForMe === true && invite?.canAnswer === true, invite);
ok('and it is not yet agreed', invite?.status === 'waiting' && invite?.contactsVisible === false, invite?.status);
const answered = await api.answerCircle(invite.id, true);
ok('answering is POST /api/circles/answer with the string "1"', lastCall().body.yes === '1' && lastCall().path === '/api/circles/answer', lastCall().body);
ok('my yes closes the circle', answered.status === 'active', answered);
const quit = await grabs(() => api.answerCircle(8, false));
ok('a second answer is refused', quit?.status === 409, quit?.message);

/* ------------------------------------------------------- other live pieces */
section('Meet-ups, items I own, and the categories row');
const meet = await api.getMeet(2);
ok('shared slots come back as strings', Array.isArray(meet.slots), meet);
const mineItems = await api.getMyItems();
ok('/api/items/mine nests the listing', mineItems.length === 0 || mineItems[0].title.length > 0, mineItems);
const cats = await api.getCategories();
ok('categories without counts stay null', cats.every((c) => c.count === null), cats);
ok('a category name is never a stringified row', cats.every((c) => c.name !== '[object Object]' && typeof c.name === 'string'), cats);
// …and a server that sends { name, count } rows keeps its counts
const rawCats = ROUTES.find((r) => r.p === '/api/items/categories');
const previousCatRoute = rawCats.fn;
rawCats.fn = () => okBody({ categories: [{ name: 'Notes', count: 4 }, { category: 'Misc', n: 2 }, { name: null, count: 1 }] });
const counted = await api.getCategories();
rawCats.fn = previousCatRoute;
ok('counted category rows keep their count', counted[0].name === 'Notes' && counted[0].count === 4, counted[0]);
ok('…fall back to another name field, and drop a row with none', counted.map((c) => c.name).join(',') === 'Notes,Misc' && counted[1].count === null, counted);

const gone = await grabs(() => api.getItem(999));
ok('a 404 on one listing surfaces with its status', gone?.status === 404, gone?.message);

/* --------------------------------------------------- flags, queues, contacts */
section('Boolean flags, the wrapper queue, and withdrawal');
resetWorld();
await api.login({ email: 'gunmay@geu.ac.in', password: 'secret123' });

// the same flag, three encodings, one meaning
const onRow = await api.getItem(12); // active: "1"
const offRow = await api.getItem(13); // active: 0
const quietRow = await api.getItem(14); // no flag at all
ok('"1" reads as available', onRow.available === true, onRow);
ok('0 reads as taken', offRow.available === false, offRow.available);
ok('a missing flag stays unknown rather than becoming a claim', quietRow.available === null, quietRow.available);
const browse = await api.searchItems('', 'all', 'newest');
ok('a paused listing is not in the browse feed', !browse.items.some((i) => i.id === '13'), browse.items.map((i) => i.id));
const verifiedTrue = await api.getStudent(1);
const verifiedString = await api.getStudent(2);
const verifiedAbsent = await api.getStudent(3);
ok('verified true, "1" and 1 all mean verified', verifiedTrue.verified === true && verifiedString.verified === true, [verifiedTrue.verified, verifiedString.verified]);
ok('an absent verified field stays unknown', verifiedAbsent.verified === null, verifiedAbsent.verified);

// my listings: the queue is in the wrapper, and my place in it is not invented
const owned = await api.getMyItems();
const own = owned.find((i) => i.id === '15') || {};
ok('the nested listing is flattened', own.title === 'OOP notes (mine)', own.title);
ok('the wrapper queue supplies the names', own.waitingNames?.join(', ') === 'Neha, Ravi', own.waitingNames);
ok('…and the count', own.waitlistCount === 2, own.waitlistCount);
ok('nobody invents my position in my own queue', own.position === null && own.peopleAhead === null, { position: own.position, peopleAhead: own.peopleAhead });
const queueless = owned.find((i) => i.id === '16');
ok('an empty wrapper queue reads 0, not missing', queueless && queueless.waitlistCount === 0 && queueless.waitingNames.length === 0, queueless);

// withdrawing my own ask
const ask = await api.sendSwapRequest('2', 'Python');
const withdrew = await api.cancelRequest(ask.request.id);
ok('cancel goes to POST /api/requests/cancel', lastCall().path === '/api/requests/cancel', lastCall().path);
ok('…with nothing but the id in the body', Number(lastCall().body.id) === Number(withdrew.request.id) && Object.keys(lastCall().body).join() === 'id', lastCall().body);
ok('the server answers with the cancelled row', withdrew.ok === true && withdrew.request.status === 'cancelled', withdrew.request?.status);
ok('…which the app reads as withdrawn, and as nothing else', withdrew.request.cancelled === true && withdrew.request.canRespond === false && withdrew.request.canCancel === false, withdrew.request);
const refused = await api.declineRequest(131); // the receiver says no: a different outcome than mine
ok('a declined row is never read as withdrawn', refused.request.status === 'declined' && refused.request.cancelled === false, refused.request);
ok('and it stays answerable by nobody', refused.request.canRespond === false && refused.request.canCancel === false, refused.request);
const twiceWithdrawn = await grabs(() => api.cancelRequest(ask.request.id));
ok('withdrawing an answered row is a conflict', twiceWithdrawn?.status === 409, twiceWithdrawn?.status);

// the received side of the same vocabulary
const inbox = await api.getRequests();
const inbound = inbox.received.find((r) => r.id === '130');
ok('a received request points at the person who wrote it', inbound.other.id === '3', inbound.other);
ok('…and its contact is that person, matched by id', inbound.otherContact?.id === '3' && inbound.otherContact?.email === 'asha@geu.ac.in', inbound.otherContact);
ok('the viewer is never the other side of a received row', inbound.direction === 'received' && inbound.other.id !== '1', { direction: inbound.direction, other: inbound.other });

console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m`);
console.log('  (all of the above ran against mocked C++ responses — see scripts/test-contract.mjs)');
process.exit(fail ? 1 : 0);
