/**
 * A dev-only stand-in for the C++ server, speaking its exact dialect:
 * numeric ids, comma-joined lists, `{ ok: true, … }` envelopes, and only the
 * routes the frontend is allowed to call. It exists so that
 *
 *   node scripts/fake-cpp-server.mjs        # in another terminal
 *   SETU_API_URL=http://localhost:8080 npm run test:live
 *
 * can prove the real-mode wiring end to end without a C++ build. It is not a
 * backend: nothing is persisted, there is no email transport (the OTP is
 * '123456'), and it is never shipped — `dist/` does not contain this file.
 *
 *   SETU_FAKE_PORT=8080 node scripts/fake-cpp-server.mjs
 */
import { createServer } from 'node:http';

/* 8080 by default, so that the fixture and the real C++ server answer the same
   address the README and .env.example tell people about */
const PORT = Number(process.env.SETU_FAKE_PORT || process.env.PORT || 8080);
const OTP = '123456';

const world = {
  users: [
    { id: 1, name: 'Gunmay Sharma', email: 'gunmay@geu.ac.in', branch: 'CSE', year: 3, verified: 1, rating: 4.7, ratingCount: 27, teaches: 'C++, Public speaking', wants: 'Python, Guitar', freeTime: 'Mon 14:00-18:00, Tue 09:00-11:00, Thu 16:00-19:00', itemsListed: 2, swapsDone: 3 },
    { id: 2, name: 'Ishwar Prasad', email: 'ishwar@geu.ac.in', branch: 'CSE', year: 4, verified: 1, rating: 4.5, ratingCount: 12, teaches: 'Python, Django', wants: 'C++', freeTime: 'Mon 14:00-17:00, Wed 10:00-12:00', itemsListed: 1, swapsDone: 1 },
    { id: 3, name: 'Asha Rawat', email: 'asha@geu.ac.in', branch: 'IT', year: 2, verified: 1, rating: 4.8, ratingCount: 41, teaches: 'DBMS, Excel', wants: 'Public speaking', freeTime: 'Tue 09:00-11:00, Sat 08:00-12:00', itemsListed: 2, swapsDone: 5 },
  ],
  items: [
    { id: 11, ownerId: 3, title: 'DBMS notes 7th sem', category: 'Notes', mode: 'free', price: 0, available: 1, wantsInReturn: '' },
    { id: 12, ownerId: 1, title: 'Spare calculator', category: 'Electronics', mode: 'sell', price: 350, available: 1, wantsInReturn: '', waiting: ['Neha', 'Ravi'] },
    { id: 13, ownerId: 2, title: 'Guitar (acoustic)', category: 'Misc', mode: 'barter', price: 0, available: 1, wantsInReturn: 'C++ lessons' },
  ],
  requests: [
    { id: 21, fromId: 3, toId: 1, type: 'swap', skill: 'DBMS', itemId: 0, offerSkill: 'Excel', note: 'I can trade Excel for your C++', status: 'pending' },
    { id: 22, fromId: 1, toId: 3, type: 'item', skill: '', itemId: 11, offerSkill: '', note: 'Would like the notes', status: 'pending' },
  ],
  circles: [],
  ratings: [],
  tutorListings: [{ id: 31, ownerId: 3, subject: 'DBMS', pricePerHour: 250, description: '7th sem focus, past papers', active: 1, rating: 4.8, ratingCount: 41 }],
};

let seq = 100;
const nextId = () => ++seq;
const list = (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const user = (id) => world.users.find((u) => u.id === Number(id));

const person = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  branch: u.branch,
  year: u.year,
  verified: u.verified ? '1' : '0', // §1: "1"/"0" on the wire
  rating: u.rating ?? null,
  ratingCount: u.ratingCount ?? 0,
  teaches: u.teaches || '',
  wants: u.wants || '',
  freeTime: u.freeTime || '',
  itemsListed: u.itemsListed ?? 0,
  swapsDone: u.swapsDone ?? 0,
});

const item = (it) => ({
  id: it.id,
  title: it.title,
  category: it.category,
  mode: it.mode,
  price: it.price,
  ownerId: it.ownerId,
  owner: person(user(it.ownerId)),
  active: it.available ? '1' : '0',
  available: it.available ? '1' : '0', // the older spelling, kept readable on both sides
  wantsInReturn: it.wantsInReturn || '',
  waitlistCount: (it.waiting || []).length,
});

/** GET /api/items/mine answers wrapper rows: { item, waiting: [names] } */
const mineRow = (it) => ({ item: item(it), waiting: it.waiting || [] });

/** a Person when the id resolves, null when it does not — a row must not 500 */
const maybePerson = (id) => {
  const u = user(Number(id));
  return u ? person(u) : null;
};

const tutorListing = (t) => ({
  id: t.id,
  subject: t.subject,
  about: t.about || t.description || '',
  price: t.price ?? t.pricePerHour ?? 0,
  active: t.active ? '1' : '0',
  owner: person(user(t.ownerId)),
});

const request = (r) => ({
  id: r.id,
  fromId: r.fromId,
  toId: r.toId,
  from: maybePerson(r.fromId),
  to: maybePerson(r.toId),
  contact: r.contact ?? null, // revealed by /api/requests/accept, to the *other* side
  type: r.type,
  skill: r.skill || '',
  offerSkill: r.offerSkill || '',
  itemId: r.itemId || 0,
  note: r.note || '',
  status: r.status,
  from: person(user(r.fromId)),
  to: person(user(r.toId)),
  contact: r.status === 'accepted' ? user(r.fromId).email : '',
});

/* long opaque tokens, like the real server hands out — a short guessable one
   would let a test pass that should not */
const tokens = new Map();
const tokenOf = new Map();
world.users.forEach((u) => {
  const value = `tok-${u.id}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
  tokens.set(value, u.id);
  tokenOf.set(u.id, value);
});

const authenticate = (req) => {
  const header = req.headers.authorization || '';
  const id = tokens.get(header.replace(/^Bearer\s+/i, ''));
  return id ? user(id) : null;
};

function handle(method, path, query, body, req) {
  const me = authenticate(req);
  const send = (out) => out;
  const need = () => (me ? null : send({ status: 401, body: { ok: false, error: 'Invalid or expired token' } }));

  if (method === 'POST' && path === '/api/login') {
    const u = world.users.find((x) => x.email === String(body.email || '').toLowerCase());
    if (!u || String(body.password || '') !== (u.password || '123456')) return { status: 401, body: { ok: false, error: 'Email or password is wrong', field: 'password' } };
    if (!u.verified) return { status: 403, body: { ok: false, error: 'Confirm your college email first', email: u.email, devOtp: OTP } };
    return { status: 200, body: { ok: true, token: tokenOf.get(u.id), user: person(u) } };
  }
  if (method === 'POST' && path === '/api/register') {
    if (world.users.some((u) => u.email === body.email)) return { status: 409, body: { ok: false, error: 'That email already has an account', field: 'email' } };
    if (String(body.password || '').length < 6) return { status: 400, body: { ok: false, error: 'Password must be at least 6 characters', field: 'password' } };
    const u = { id: nextId(), password: String(body.password || ''), name: body.name, email: body.email, branch: body.branch, year: Number(body.year), verified: 0, teaches: list(body.teaches).join(', '), wants: list(body.wants).join(', '), freeTime: '' };
    world.users.push(u);
    return { status: 201, body: { ok: true, userId: u.id, email: u.email, devOtp: OTP } };
  }
  if (method === 'POST' && path === '/api/verify') {
    const u = world.users.find((x) => x.email === body.email);
    if (!u) return { status: 404, body: { ok: false, error: 'No account uses that email', field: 'email' } };
    if (String(body.otp) !== OTP) return { status: 400, body: { ok: false, error: 'That code is not right', field: 'otp' } };
    u.verified = 1;
    return { status: 200, body: { ok: true, token: tokenOf.get(u.id), user: person(u) } };
  }
  if (method === 'POST' && path === '/api/logout') return { status: 200, body: { ok: true } };

  if (path === '/api/me' && method === 'GET') return need() || { body: { ok: true, ...person(me) } };
  if (path === '/api/me/skills' && method === 'POST') {
    if (!list(body.teaches).length) return { status: 400, body: { ok: false, error: 'Teach at least one thing', field: 'teaches' } };
    me.teaches = list(body.teaches).join(', ');
    me.wants = list(body.wants).join(', ');
    return { body: { ok: true, ...person(me) } };
  }
  if (path === '/api/me/free-time' && method === 'POST') {
    me.freeTime = list(body.freeTime).join(', ');
    return { body: { ok: true, freeTime: me.freeTime } };
  }
  if (path === '/api/items/categories' && method === 'GET') {
    const counts = new Map();
    world.items.forEach((i) => counts.set(i.category, (counts.get(i.category) || 0) + 1));
    return { body: { ok: true, categories: [...counts].map(([name, count]) => ({ name, count })) } };
  }
  if (path === '/api/items' && method === 'GET') {
    const q = String(query.q || '').toLowerCase();
    const rows = world.items.filter((i) => i.ownerId !== me?.id && i.available && (!q || i.title.toLowerCase().includes(q)));
    return need() || { body: { ok: true, items: rows.map(item), total: rows.length } };
  }
  if (path === '/api/items' && method === 'POST') {
    if (!me) return need();
    const it = { id: nextId(), ownerId: me.id, title: body.title, category: body.category, mode: body.mode, price: Number(body.price || 0), available: 1, wantsInReturn: body.wantsInReturn || '' };
    world.items.push(it);
    return { status: 201, body: { ok: true, item: item(it) } };
  }
  if (path === '/api/items/one' && method === 'GET') {
    const it = world.items.find((i) => i.id === Number(query.id));
    return it ? { body: { ok: true, ...item(it) } } : { status: 404, body: { ok: false, error: 'That listing is gone' } };
  }
  if (path === '/api/items/category' && method === 'GET') {
    // the same rows as the browse feed, filtered by one category name
    const rows = world.items.filter((i) => i.available && i.ownerId !== me?.id && (!query.name || i.category === query.name));
    return { body: { ok: true, items: rows.map(item), count: rows.length } };
  }
  if (path === '/api/items/mine' && method === 'GET') {
    if (!me) return need();
    return { body: { ok: true, items: world.items.filter((i) => i.ownerId === me.id).map(mineRow) } };
  }
  if (path === '/api/items/active' && method === 'POST') {
    const it = world.items.find((i) => i.id === Number(body.id));
    if (!it) return { status: 404, body: { ok: false, error: 'That listing is gone' } };
    it.available = body.active === '1' || body.active === 1 ? 1 : 0;
    return { body: { ok: true, item: item(it) } };
  }
  if (path === '/api/requests' && method === 'GET') {
    if (!me) return need();
    const mine = world.requests.filter((r) => r.toId === me.id || r.fromId === me.id);
    return {
      body: {
        ok: true,
        received: mine.filter((r) => r.toId === me.id).map(request),
        sent: mine.filter((r) => r.fromId === me.id).map(request),
        pending: mine.filter((r) => r.toId === me.id && r.status === 'pending').length,
      },
    };
  }
  if (path === '/api/requests/accept' && method === 'POST') {
    const r = world.requests.find((x) => x.id === Number(body.id ?? body.request));
    if (!r) return { status: 404, body: { ok: false, error: 'That request is gone' } };
    if (r.toId !== me?.id) return { status: 403, body: { ok: false, error: 'Only the person asked can accept' } };
    if (r.status !== 'pending') return { status: 409, body: { ok: false, error: 'That request was answered already' } };
    r.status = 'accepted';
    // who gets the email is the other participant, whoever the row was pointed at
    const otherId = r.fromId === me.id ? r.toId : r.fromId;
    r.contact = user(otherId)?.email || null;
    return { body: { ok: true, request: request(r) } };
  }
  if (path === '/api/requests/decline' && method === 'POST') {
    const r = world.requests.find((x) => x.id === Number(body.id ?? body.request));
    if (!r) return { status: 404, body: { ok: false, error: 'That request is gone' } };
    if (r.toId !== me?.id) return { status: 403, body: { ok: false, error: 'Only the person asked can decline' } };
    if (r.status !== 'pending') return { status: 409, body: { ok: false, error: 'That request was answered already' } };
    r.status = 'declined';
    return { body: { ok: true, request: request(r) } };
  }
  // the sender taking their own ask back: a different outcome from a decline
  if (path === '/api/requests/cancel' && method === 'POST') {
    const r = world.requests.find((x) => x.id === Number(body.id ?? body.request));
    if (!r) return { status: 404, body: { ok: false, error: 'That request is gone' } };
    if (r.fromId !== me?.id) return { status: 403, body: { ok: false, error: 'Only the sender may withdraw a request' } };
    if (r.status !== 'pending') return { status: 409, body: { ok: false, error: 'That request was answered already' } };
    r.status = 'cancelled';
    return { body: { ok: true, request: request(r) } };
  }
  if (path === '/api/barter/request' && method === 'POST') {
    const r = { id: nextId(), fromId: me.id, toId: Number(body.to), type: 'swap', skill: body.skill || '', offerSkill: '', itemId: 0, note: body.note || '', status: 'pending' };
    world.requests.push(r);
    return { status: 201, body: { ok: true, request: request(r) } };
  }
  if (path === '/api/barter' && method === 'GET') {
    // swaps are people whose teaches match what I asked for; `circle` is a list
    // of links, and an empty one means "no circle is possible", not "null"
    const want = String(query.skill || '').toLowerCase();
    const swaps = world.users
      .filter((u) => u.id !== me?.id && list(u.teaches).some((t) => t.toLowerCase() === want))
      .map((u) => ({ student: person(u), teaches: u.teaches, wantsFromYou: u.wants || '', score: 1 }));
    return need() || { body: { ok: true, skill: want, swaps, circle: [], circleMembers: [], oneWay: [] } };
  }
  if (path === '/api/circles' && method === 'GET') {
    if (!me) return need();
    const circles = world.circles.filter((c) => c.members.some((m) => m.studentId === me.id));
    return { body: { ok: true, circles, count: circles.length, waitingForMe: 0 } };
  }
  if (path === '/api/circles' && method === 'POST') {
    const circle = { id: `c${nextId()}`, skill: body.skill, status: 'waiting', members: list(body.members).map((id) => ({ student: person(user(id)), answer: 'waiting' })) };
    circle.members[0] = { ...circle.members[0], answer: 'yes' };
    world.circles.push(circle);
    return { status: 201, body: { ok: true, circle, sent: circle.members.length - 1 } };
  }
  if (path === '/api/circles/answer' && method === 'POST') {
    const circle = world.circles.find((c) => c.id === body.circle);
    if (!circle) return { status: 404, body: { ok: false, error: 'That circle is gone' } };
    const member = circle.members.find((m) => m.student.id === me?.id);
    if (!member) return { status: 403, body: { ok: false, error: 'You are not in that circle' } };
    member.answer = body.yes === '1' || body.yes === 1 || body.yes === true ? 'yes' : 'no';
    circle.status = circle.members.every((m) => m.answer === 'yes') ? 'active' : circle.members.some((m) => m.answer === 'no') ? 'cancelled' : 'waiting';
    return { body: { ok: true, circle, status: circle.status } };
  }
  if (path === '/api/ratings' && method === 'POST') {
    const stars = Number(body.stars);
    if (!(stars >= 1 && stars <= 5)) return { status: 400, body: { ok: false, error: 'Rate from 1 to 5 stars', field: 'stars' } };
    if (world.ratings.some((r) => r.fromId === me.id && r.request === body.request)) return { status: 409, body: { ok: false, error: 'You already rated this exchange' } };
    const r = world.requests.find((x) => x.id === Number(body.request));
    const other = user(r && (r.fromId === me.id ? r.toId : r.fromId));
    // a rating is only worth storing against an exchange that exists — never crash the process
    if (!r || !other) return { status: 404, body: { ok: false, error: 'No such exchange to rate' } };
    world.ratings.push({ fromId: me.id, request: body.request, stars });
    const count = (other.ratingCount || 0) + 1;
    other.rating = Math.round((((other.rating || 0) * (other.ratingCount || 0) + stars) / count) * 10) / 10;
    other.ratingCount = count;
    return { body: { ok: true, rating: other.rating, ratingCount: count } };
  }
  if (path === '/api/student' && method === 'GET') {
    const u = user(query.id);
    if (!u) return { status: 404, body: { ok: false, error: 'No such student' } };
    const p = person(u);
    delete p.email; // emails stay behind an accepted exchange
    return { body: { ok: true, ...p } };
  }
  if (path === '/api/meet' && method === 'GET') {
    const other = user(query.with);
    if (!other) return { status: 404, body: { ok: false, error: 'No such student' } };
    const mine = list(me?.freeTime);
    const theirs = list(other.freeTime);
    return { body: { ok: true, commonFreeTime: mine.filter((slot) => theirs.includes(slot)).join(', '), them: other.name } };
  }
  if (path === '/api/tutors' && method === 'GET') {
    const rows = world.tutorListings.filter((t) => t.active && (!query.subject || t.subject.toLowerCase().includes(String(query.subject).toLowerCase())));
    return { body: { ok: true, tutors: rows.map(tutorListing) } };
  }
  if (path === '/api/top-tutors' && method === 'GET') {
    const rows = [...world.tutorListings].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, Number(query.k || 6));
    return { body: { ok: true, tutors: rows.map((t) => ({ id: t.id, subject: t.subject, pricePerHour: t.pricePerHour, tutor: person(user(t.ownerId)), rating: t.rating ?? null, ratingCount: t.ratingCount ?? 0 })) } };
  }
  if (path === '/api/teach' && method === 'POST') {
    // the client sends { subject, about, price }; pricePerHour/description are read too
    const t = {
      id: nextId(),
      ownerId: me.id,
      subject: body.subject,
      about: body.about ?? body.description ?? '',
      price: Number(body.price ?? body.pricePerHour ?? 0),
      active: 1,
    };
    world.tutorListings.push(t);
    return { status: 201, body: { ok: true, listing: tutorListing(t) } };
  }
  if (path === '/api/teach/mine' && method === 'GET') {
    if (!me) return need();
    return { body: { ok: true, listings: world.tutorListings.filter((t) => t.ownerId === me.id).map(tutorListing) } };
  }
  if (path === '/api/teach/active' && method === 'POST') {
    const t = world.tutorListings.find((x) => x.id === Number(body.id));
    if (!t) return { status: 404, body: { ok: false, error: 'No such listing' } };
    t.active = body.active === '1' || body.active === 1 || body.active === true ? 1 : 0;
    return { body: { ok: true, listing: tutorListing(t) } };
  }
  if (path === '/api/tutors/request' && method === 'POST') {
    // { id } is the listing id; the server works out who teaches it
    const listingId = Number(body.id ?? body.tutor ?? body.to);
    const t = world.tutorListings.find((x) => x.id === listingId);
    const r = { id: nextId(), fromId: me.id, toId: t ? t.ownerId : listingId, type: 'tutor', skill: '', offerSkill: '', itemId: 0, note: body.note || '', status: 'pending' };
    world.requests.push(r);
    return { status: 201, body: { ok: true, request: request(r) } };
  }
  if (path === '/api/items/request' && method === 'POST') {
    const r = { id: nextId(), fromId: me.id, toId: user(world.items.find((i) => i.id === Number(body.id))?.ownerId || 1)?.id || 1, type: 'item', skill: '', offerSkill: '', itemId: Number(body.id), note: body.note || '', status: 'pending' };
    world.requests.push(r);
    return { status: 201, body: { ok: true, request: request(r) } };
  }
  if (path === '/api/items/handoff' && method === 'POST') {
    if (!world.items.some((i) => i.id === Number(body.id))) return { status: 409, body: { ok: false, error: 'That item has already been handed over' } };
    return { body: { ok: true, to: person(world.users[1]), remaining: 0, declinedOthers: 0 } };
  }
  if (path === '/api/otp/resend' && method === 'POST') return { body: { ok: true, devOtp: OTP } };

  return { status: 404, body: { ok: false, error: `no such route: ${method} ${path}` } };
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const cors = {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  let raw = '';
  req.on('data', (c) => {
    raw += c;
  });
  req.on('end', () => {
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json', ...cors });
      res.end(JSON.stringify({ ok: false, error: 'Body is not JSON' }));
      return;
    }
    const out = handle(req.method, url.pathname.replace(/\/$/, ''), Object.fromEntries(url.searchParams), body, req) || { body: { ok: true } };
    console.log(`  ${String(out.status || 200).padEnd(3)} ${req.method} ${url.pathname}${url.search}`);
    res.writeHead(out.status || 200, { 'Content-Type': 'application/json; charset=utf-8', ...cors });
    res.end(JSON.stringify(out.body));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  fake C++-shaped API on http://localhost:${PORT}  (any of: ${world.users.map((u) => u.email).join(', ')} / 123456)\n  Ctrl-C to stop. In another terminal:\n    SETU_API_URL=http://localhost:${PORT} SETU_EMAIL=gunmay@geu.ac.in SETU_PASSWORD=123456 npm run test:live\n`);
});
