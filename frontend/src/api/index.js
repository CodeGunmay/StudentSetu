/**
 * StudentSetu — the ONLY place the app talks to data.
 *
 * Today every function reads/writes an in-memory mock database with a 300 ms
 * fake delay. Flip USE_MOCK to false and the same functions hit a REST server
 * at BASE_URL instead (the route for each call is written above its body).
 * Components never import the mock database directly.
 */
import { createSeed, CATEGORIES, BRANCHES, DEMO_ACCOUNT } from './seed.js';
import {
  bestSuggestion,
  cleanSkill,
  findExchangeCircle,
  findOneWayTeachers,
  findTwoWaySwaps,
  sortBySortKey,
  taughtAs,
  textMatches,
  uniqSkills,
  commonFreeTime,
  parseSlot,
  parseSlots,
  rateStars,
  OTP_COOLDOWN_MS,
} from './logic.js';

/* Two data sources, one surface.

   USE_MOCK === true  -> the in-memory database below (default; nothing to run).
   USE_MOCK === false -> the C++ server documented above every function below,
                         through src/api/client.js + src/api/adapters.js.

   Both flags are build-time (see src/api/env.js):
     VITE_USE_MOCK=false VITE_API_BASE=http://localhost:8080 npm run dev

   There is deliberately NO fallback between them. If the C++ server is down,
   returns a bad status or is not configured, real mode throws and the screen
   shows ErrorState — it never quietly answers from the mock database, because a
   reviewer must not be able to mistake a dead API for a working one.

   Routes the mock-only demo controls used to have (/demo/reset, /demo/failure,
   /auth/demo) are not implemented on the C++ server at all, so the real-mode
   branch of each of those functions refuses instead of calling them.
*/
import * as A from './adapters.js';
import { BASE_URL, DEMO_HINTS, TOKEN_KEY, USE_MOCK } from './env.js';
import { ApiError } from './errors.js';
import { addUnauthorizedHandler, call, clearToken, setToken, setUnauthorizedHandler } from './client.js';

/** Let the app react to a dead session as well (see AppContext). */
export { addUnauthorizedHandler };

export { BASE_URL, USE_MOCK, DEMO_HINTS };

const LATENCY = 300; // fake network delay for the mock

/* ------------------------------------------------------------------ state */

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
/* `null` has to actually remove the key: if it does not, a reload straight after
   logging out reads the old token and signs you back in. setToken/clearToken are
   the same two helpers the real client uses, and they swallow storage errors
   (private mode), so the session just stops surviving a reload there. */
const writeToken = (value) => (value ? setToken(value) : clearToken());

let db = createSeed();
/* The token is the only thing kept in localStorage. Passwords, OTP codes and
   request bodies never go near it, and nothing here writes to the console. */
let sessionId = readToken();
let failureMode = false; // mock-only switch: makes the mock fail so error states are visible

const listeners = new Set();
let notifyMuted = false; // test-only: makes a mutation invisible to this tab (see below)

/** Every mutation tells all open screens to refetch. */
function notify() {
  if (notifyMuted) return;
  listeners.forEach((fn) => fn());
}

/**
 * Mock/test only: with notify muted, a change made through this same module
 * behaves like a change made in another browser tab — no local refresh signal,
 * so only a focus refresh or a poll can surface it. That is how the UI suite
 * proves requirement "another member's acceptance appears without reloading".
 */
export function setNotifyMuted(on) {
  notifyMuted = !!on;
}

setUnauthorizedHandler(() => {
  myId = null;
  notify();
});

export function subscribe(fn) {
  // (client side) would be an SSE / websocket stream in a real backend
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * DEMO CONTROL — mock mode only. Makes every call fail so the error states can
 * be seen without unplugging a server.
 *
 * It refuses in real mode rather than silently doing nothing: there is no
 * /api/demo/failure route on the C++ server, so there is nothing honest this
 * could do to a live campus database. The UI hides the switch when USE_MOCK is
 * false (see src/screens/Profile.jsx).
 */
export async function setFailureMode(on) {
  if (!USE_MOCK) throw new ApiError('Forced API errors are a mock-mode demo control, not an API feature.');
  failureMode = !!on;
  notify();
  return { failureMode };
}

export function getFailureMode() {
  return failureMode;
}

async function settle() {
  await new Promise((r) => setTimeout(r, LATENCY));
  if (failureMode) {
    throw new ApiError('Could not reach the StudentSetu server (demo failure mode is on — turn it off in Profile).');
  }
}

/* ------------------------------------------------------------------- real */

/**
 * Real mode only: talk to the C++ server, then convert. Nothing past these two
 * helpers is server-shaped, so the screens read the same objects in both modes.
 */
const GET = async (path, query, adapt) => {
  const data = await call('GET', `/api${path}`, { query });
  return adapt ? adapt(data) : data;
};
const POST = async (path, body, adapt) => {
  const data = await call('POST', `/api${path}`, { body });
  if (data?.token) setToken(data.token); // login / verify hand us a fresh token
  if (!USE_MOCK) notify(); // mutations refresh every open screen, like the mock does
  return adapt ? adapt(data) : data;
};

/** `isMine` needs to know who we are; ask once and remember. */
let myId = null;
let mePerson = null;
async function ensureMe() {
  if (USE_MOCK) return sessionId;
  if (!myId) {
    const data = await GET('/me');
    myId = A.toId(data.id ?? data.user?.id);
    mePerson = A.toMe(data);
  }
  return myId;
}
const ensureMeCache = () => myId; // for synchronous adapters inside .map()
const personOfMe = async () => (USE_MOCK ? personView(me()) : (await ensureMe(), mePerson));

/* -------------------------------------------------------------- utilities */

const me = () => {
  const user = db.users.find((u) => u.id === sessionId);
  if (!user) throw new ApiError('Your session expired. Please log in again.');
  return user;
};

const findItem = (id) => {
  const item = db.items.find((i) => i.id === id);
  if (!item) throw new ApiError('That listing no longer exists.');
  return item;
};

const initials = (name) =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/** Public profile — email is deliberately NOT included (privacy until accept). */
function personView(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    initials: initials(user.name),
    color: user.color,
    branch: user.branch,
    year: user.year,
    yearLabel: `${user.year}${['th', 'st', 'nd', 'rd'][user.year] || 'th'} year`,
    teaches: user.teaches,
    wants: user.wants,
    freeTime: user.freeTime || [],
    rating: user.rating || 0,
    ratingCount: user.ratingCount || 0,
    // mirrors adapters.toPerson: a badge needs the flag to be true, not merely present
    verified: user.verified === true,
  };
}

/** Contact details, revealed only once a request is accepted. */
function contactView(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, initials: initials(user.name), color: user.color };
}

export const MODE_LABEL = { free: 'Free', barter: 'Barter', sell: 'Sell' };

function itemSearchText(item) {
  return [item.title, item.category, ...(item.wants || [])].join(' ');
}

function itemView(item) {
  const owner = db.users.find((u) => u.id === item.ownerId);
  const mine = owner && owner.id === sessionId;
  const position = item.mode === 'free' ? item.waitlist.indexOf(sessionId) : -1;
  const isWaiting = position >= 0;
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    mode: item.mode,
    modeLabel: MODE_LABEL[item.mode],
    price: item.mode === 'sell' ? item.price : null,
    wants: item.wants || [],
    condition: item.condition,
    description: item.description,
    available: item.available,
    isMine: !!mine,
    owner: personView(owner),
    createdAt: item.createdAt,
    waitlistCount: item.waitlist.length,
    isWaiting,
    position: position >= 0 ? position + 1 : null,
    requestedByMe: db.requests.some(
      (r) => r.fromId === sessionId && r.itemId === item.id && r.status === 'pending'
    ),
    peopleAhead: item.waitlist.slice(0, Math.max(position, 0)).map((id) => db.users.find((u) => u.id === id)?.name).filter(Boolean),
  };
}

function tutoringView(t) {
  const tutor = db.users.find((u) => u.id === t.userId);
  const taken = db.requests.filter((r) => r.listingId === t.id && r.status === 'accepted').length;
  const pendingByMe = db.requests.some(
    (r) => r.fromId === sessionId && r.listingId === t.id && r.type === 'paid' && r.status === 'pending'
  );
  return {
    id: t.id,
    subject: t.subject,
    description: t.description,
    pricePerHour: t.pricePerHour,
    active: t.active,
    rating: t.rating,
    reviews: t.reviews,
    sessionsTaken: taken,
    pendingByMe,
    isMine: tutor && tutor.id === sessionId,
    tutor: personView(tutor),
    createdAt: t.createdAt,
  };
}

const TYPE_LABEL = {
  item: 'Item',
  swap: 'Skill swap',
  circle: 'Exchange circle',
  paid: 'Paid session',
};

function requestView(r) {
  const from = db.users.find((u) => u.id === r.fromId);
  const to = db.users.find((u) => u.id === r.toId);
  const other = from.id === sessionId ? to : from;
  const direction = from.id === sessionId ? 'sent' : 'received';
  const accepted = r.status === 'accepted';
  const item = r.itemId ? db.items.find((i) => i.id === r.itemId) : null;
  const offer = r.offerItemId ? db.items.find((i) => i.id === r.offerItemId) : null;
  const tutoring = r.type === 'paid' ? db.tutorings.find((t) => t.id === r.listingId) : null;
  const circle = r.circleIds
    ? [sessionId, ...r.circleIds].map((id) => db.users.find((u) => u.id === id)).filter(Boolean).map(personView)
    : null;

  let title = r.note || 'Request';
  let subtitle = '';
  if (r.type === 'item' && item) {
    title = item.title;
    subtitle = offer ? `You offer: ${offer.title}` : `${MODE_LABEL[item.mode]}${item.mode === 'sell' ? ` · ₹${item.price}` : ''} · ${item.category}`;
    if (offer) subtitle = `${MODE_LABEL[item.mode]} · you both have something to give`;
  } else if (r.type === 'swap') {
    title = `Skill swap · ${r.skill}`;
    subtitle =
      direction === 'received'
        ? `${from?.name} wants to learn ${r.skill} from you`
        : `You asked ${to?.name} to teach you ${r.skill}`;
  } else if (r.type === 'circle') {
    title = `Exchange circle · ${r.skill}`;
    subtitle = circle ? circle.map((p) => p.name).join(' → ') : 'Circular skill exchange';
  } else if (r.type === 'paid' && tutoring) {
    title = `Paid session · ${tutoring.subject}`;
    subtitle = `₹${tutoring.pricePerHour}/hr · ${direction === 'received' ? (from?.name ?? '') : (to?.name ?? '')}`;
  }

  return {
    id: r.id,
    type: r.type,
    typeLabel: TYPE_LABEL[r.type],
    status: r.status,
    direction,
    canRespond: direction === 'received' && r.status === 'pending',
    title,
    subtitle,
    note: r.note,
    skill: r.skill,
    item: item ? { id: item.id, title: item.title, mode: item.mode, available: item.available, modeLabel: MODE_LABEL[item.mode] } : null,
    offer: offer ? { id: offer.id, title: offer.title, mode: offer.mode, available: offer.available } : null,
    tutoring: tutoring ? { id: tutoring.id, subject: tutoring.subject, pricePerHour: tutoring.pricePerHour } : null,
    circle,
    other: personView(other),
    // Contacts exist on both sides of an accepted request; nothing is revealed
    // before that, and nothing is invented here either.
    contactVisible: accepted,
    otherContact: accepted ? contactView(other) : null,
    canCancel: direction === 'sent' && r.status === 'pending',
    canRate:
      accepted && r.type !== 'item' && !db.ratings.some((e) => e.requestId === r.id && e.byId === sessionId),
    createdAt: r.createdAt,
    autoDeclined: r.autoDeclined,
    cancelled: r.cancelled === true,
  };
}

/* ---------------------------------------------------------------- circles */

/**
 * Mock circles. One invitation row per member lives in db.requests (those are
 * what the inbox renders) and is grouped by circleTag; db.circles says who was
 * in it. The STATE is derived, never stored:
 *
 *   every member accepted        -> active    (the consensus that unlocks emails)
 *   anyone declined, or I quit   -> cancelled
 *   otherwise                    -> waiting
 */
function circleRows(circleId) {
  return db.requests.filter((r) => r.circleTag === circleId);
}

function circleState(circle, viewerId) {
  if (!circle) return null;
  const rows = circleRows(circle.id);
  const byId = (id) => db.users.find((u) => u.id === id);
  const members = circle.memberIds
    .map((id) => {
      const student = personView(byId(id));
      if (!student) return null;
      let answer = id === circle.ownerId ? 'yes' : 'waiting';
      const row = rows.find((r) => r.toId === id);
      if (row) answer = row.status === 'accepted' ? 'yes' : row.status === 'declined' || row.status === 'cancelled' ? 'no' : 'waiting';
      return { student, answer, contact: null };
    })
    .filter(Boolean);

  const status = members.some((m) => m.answer === 'no')
    ? 'cancelled'
    : members.every((m) => m.answer === 'yes')
    ? 'active'
    : 'waiting';

  // consensus shares the contact details, not my own yes
  if (status === 'active') {
    members.forEach((m) => {
      if (m.student.id !== viewerId) m.contact = contactView(byId(m.student.id));
    });
  }

  const myRow = rows.find((r) => r.toId === viewerId);
  const mine = members.find((m) => m.student.id === viewerId);
  const links = [];
  if (members.length > 1) {
    for (let i = 0; i < members.length; i += 1) {
      links.push({ learner: members[i].student, teacher: members[(i + 1) % members.length].student, skill: circle.skill });
    }
  }

  return {
    id: circle.id,
    skill: circle.skill,
    status,
    size: members.length,
    members,
    links,
    edges: links.map((l) => ({ from: l.learner.name, to: l.teacher.name, skill: l.skill })),
    waitingForMe: !!myRow && myRow.status === 'pending' && viewerId !== circle.ownerId,
    myAnswer: mine ? mine.answer : null,
    waitingCount: members.filter((m) => m.answer === 'waiting').length,
    yesCount: members.filter((m) => m.answer === 'yes').length,
    contactsVisible: status === 'active',
    canAnswer: !!myRow && myRow.status === 'pending' && viewerId !== circle.ownerId,
    iInitiated: circle.ownerId === viewerId,
    createdAt: circle.createdAt,
  };
}

function circlesOf(viewerId) {
  return db.circles
    .filter((c) => c.memberIds.includes(viewerId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((c) => circleState(c, viewerId))
    .filter(Boolean);
}

/** Recompute a student's mean from the seeded base plus everything rated since. */
function recomputeRating(user) {
  const added = db.ratings.filter((r) => r.toId === user.id);
  const baseSum = (user.baseRating || 0) * (user.baseCount || 0);
  const baseCount = user.baseCount || 0;
  if (!added.length) {
    user.rating = user.baseRating || 0;
    user.ratingCount = baseCount;
    return;
  }
  const sum = baseSum + added.reduce((total, r) => total + Number(r.stars), 0);
  user.rating = Math.round((sum / (baseCount + added.length)) * 10) / 10;
  user.ratingCount = baseCount + added.length;
}

/* ------------------------------------------------------------------- auth */

/**
 * The C++ server emails a 6-digit code and, in its dev config, also hands it
 * back as `devOtp`. That code is only ever forwarded to the UI when hints are
 * explicitly allowed (mock dev server, or VITE_DEMO_HINTS=true) — a production
 * bundle must not show either half of someone's sign-up ceremony, and no code
 * or password is ever written to storage or the console.
 */
const DEV_OTP = '123456';
const hint = (value) => (DEMO_HINTS ? value : null);

/** POST /api/register  { name, email, branch, year, password, teaches, wants } */
export async function register(payload) {
  const name = String(payload.name || '').trim();
  const email = cleanSkill(payload.email || '');
  const password = String(payload.password || '');
  const teaches = uniqSkills(payload.teaches || []);
  const wants = uniqSkills(payload.wants || []);

  if (name.length < 2) throw new ApiError('Enter your full name', 'name');
  if (!email.endsWith('@geu.ac.in')) throw new ApiError('Use your college email ending in @geu.ac.in', 'email');
  if (!BRANCHES.includes(payload.branch)) throw new ApiError('Pick your branch', 'branch');
  const year = Number(payload.year);
  if (!(year >= 1 && year <= 4)) throw new ApiError('Pick your year (1 to 4)', 'year');
  if (password.length < 8) throw new ApiError('Password must be at least 8 characters', 'password');
  if (!teaches.length) throw new ApiError('Add at least one skill you can teach', 'teaches');

  if (!USE_MOCK) {
    // flat JSON: the two skill lists travel as "C++, DBMS"
    return POST('/register', {
      name,
      email,
      branch: payload.branch,
      year,
      password,
      teaches: A.joinList(teaches),
      wants: A.joinList(wants),
    });
  }

  await settle();
  if (db.users.some((u) => u.email === email)) throw new ApiError('That email is already registered', 'email');
  if (USE_MOCK && !DEMO_HINTS) {
    // no dev code to hand the reviewer: the mock still stores a code, it is just
    // never returned, exactly as the production API would behave
  }

  const user = {
    id: `u${db.seq.user++}`,
    name,
    email,
    password,
    branch: payload.branch,
    year,
    teaches,
    wants,
    freeTime: [],
    rating: 0,
    ratingCount: 0,
    color: 'violet',
    verified: false,
    otp: DEV_OTP,
    otpSentAt: Date.now(),
    joinedAt: Date.now(),
  };
  db.users.push(user);
  notify();
  return { ok: true, email, devOtp: hint(DEV_OTP), message: 'We sent a 6-digit code to your college email.' };
}

/** POST /api/otp/resend { email } — the server enforces a 30 second gap. */
export async function resendOtp(email) {
  const key = cleanSkill(email || '');
  if (!USE_MOCK) return POST('/otp/resend', { email: key });

  await settle();
  const user = db.users.find((u) => u.email === key);
  if (!user) throw new ApiError('No account with that college email.', 'email');
  if (user.verified) throw new ApiError('That account is already verified — just sign in.', 'email');
  const since = Date.now() - (user.otpSentAt || 0);
  if (since < OTP_COOLDOWN_MS) {
    throw new ApiError(`You can ask for another code in ${Math.ceil((OTP_COOLDOWN_MS - since) / 1000)}s.`, 'otp');
  }
  user.otp = DEV_OTP;
  user.otpSentAt = Date.now();
  notify();
  return { ok: true, devOtp: hint(DEV_OTP) };
}

/** POST /api/verify { email, otp } → { ok, token, user } */
export async function verifyOtp({ email, otp }) {
  const key = cleanSkill(email || '');
  const code = String(otp || '').replace(/\D/g, '');

  if (!USE_MOCK) {
    const data = await POST('/verify', { email: key, otp: code });
    const raw = data.user || data;
    myId = A.toId(raw.id);
    mePerson = A.toMe(raw);
    notify();
    return { token: data.token, user: A.toMe(raw) };
  }

  await settle();
  const user = db.users.find((u) => u.email === key);
  if (!user) throw new ApiError('No account with that college email.', 'email');
  if (code.length !== 6) throw new ApiError('Enter the 6-digit code we sent you.', 'otp');
  if (!user.verified && code !== user.otp) throw new ApiError('That code is not right. Check the email, or send a new one.', 'otp');
  user.verified = true;
  user.otp = null;
  sessionId = user.id;
  myId = user.id;
  writeToken(user.id);
  notify();
  return { token: user.id, user: mePayload(user) };
}

/** POST /api/login { email, password } → { ok, token, user } */
export async function login({ email, password }) {
  const key = cleanSkill(email || '');

  if (!USE_MOCK) {
    const data = await POST('/login', { email: key, password: String(password || '') });
    const raw = data.user || data;
    myId = A.toId(raw.id);
    mePerson = A.toMe(raw);
    notify();
    return { token: data.token, user: A.toMe(raw), needsVerify: data.needsVerify === true || data.needsVerify === 1 };
  }

  await settle();
  const user = db.users.find((u) => u.email === key);
  if (!user || user.password !== String(password)) {
    // never say which half was wrong, and never leak the demo password
    throw new ApiError('Wrong email or password.', 'password');
  }
  if (!user.verified) {
    throw new ApiError('Confirm your college email to finish signing up.', 'otp', {
      needsVerify: true,
      devOtp: hint(user.otp || DEV_OTP),
      email: user.email,
    });
  }
  sessionId = user.id;
  myId = user.id;
  writeToken(user.id);
  notify();
  return { token: user.id, user: mePayload(user) };
}

/**
 * Mock-only convenience: signs in as the seed student so a reviewer can explore
 * without typing. There is no such route on the C++ server, so it is refused
 * there and the UI hides the button in real mode.
 */
export async function demoLogin() {
  if (!USE_MOCK) throw new ApiError('Demo sign-in only exists in mock mode.');
  return login(DEMO_ACCOUNT);
}

/** POST /api/logout */
export async function logout() {
  if (!USE_MOCK) {
    try {
      await POST('/logout', {});
    } finally {
      clearToken();
      myId = null;
      notify();
    }
    return { ok: true };
  }
  await settle();
  sessionId = null;
  myId = null;
  writeToken(null);
  notify();
  return { ok: true };
}

/** The UI's sort keys, translated to what the C++ server calls them. */
const SORT_OUT = { newest: 'new', price_asc: 'low', price_desc: 'high', rating: 'rating' };

/** The signed-in shape every screen reads (person + email + a few counts). */
function mePayload(user) {
  const itemsListed = db.items.filter((i) => i.ownerId === user.id).length;
  const swapsDone = db.requests.filter(
    (r) => (r.toId === user.id || r.fromId === user.id) && ['swap', 'circle'].includes(r.type) && r.status === 'accepted'
  ).length;
  const requestsTotal = db.requests.filter((r) => r.fromId === user.id || r.toId === user.id).length;
  return {
    ...personView(user),
    email: user.email,
    verified: user.verified !== false,
    itemsListed,
    swapsDone,
    requestsTotal,
    pendingReceived: db.requests.filter((r) => r.toId === user.id && r.status === 'pending').length,
    teachingCount: db.tutorings.filter((t) => t.userId === user.id).length,
  };
}

/** GET /api/me → Me */
export async function getMe() {
  if (!USE_MOCK) {
    const data = await GET('/me');
    const me = A.toMe(data);
    myId = me.id;
    // the server's Me carries no counters, so the Profile hides them in real mode
    return { ...me, itemsListed: null, swapsDone: null, requestsTotal: null, pendingReceived: null, teachingCount: null };
  }
  await settle();
  return mePayload(me());
}

/** POST /api/me/skills { teaches, wants } — flat, so lists are strings */
export async function updateSkills({ teaches, wants }) {
  if (!USE_MOCK) {
    const data = await POST('/me/skills', { teaches: A.joinList(teaches), wants: A.joinList(wants) });
    notify();
    return A.toPerson(data.user || data);
  }
  await settle();
  const user = me();
  const cleanTeach = uniqSkills(teaches || []);
  const cleanWant = uniqSkills(wants || []);
  if (!cleanTeach.length) throw new ApiError('Keep at least one skill you can teach', 'teaches');
  user.teaches = cleanTeach;
  user.wants = cleanWant;
  notify();
  return personView(user);
}

/* ------------------------------------------------------------------ items */

/** GET /api/categories */
export async function getCategories() {
  if (!USE_MOCK) return GET('/items/categories', undefined, (data) => A.toCategories(data));
  await settle();
  const mine = sessionId;
  return CATEGORIES.map((name) => ({
    name,
    count: db.items.filter((i) => i.category === name && i.available && i.ownerId !== mine).length,
  })).filter((c) => c.count > 0);
}

/** GET /api/items?q=&mode=&sort= — 50% similarity search, never my own listings */
export async function searchItems(q, mode = 'all', sort = 'newest') {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await GET('/items', { q, mode: mode === 'all' ? '' : mode, sort: SORT_OUT[sort] || sort });
    const items = ((data && data.items) || []).map((row) => A.toItem(row, viewer));
    // the server has no "did you mean" endpoint: an empty result is the answer
    return { items, suggestion: null, query: cleanSkill(q), total: items.length };
  }
  await settle();
  const user = me();
  const query = cleanSkill(q);
  if (!query) return { items: [], suggestion: null, query: '', total: 0 }; // empty query -> no results

  const visible = db.items.filter((i) => i.ownerId !== user.id && i.available);
  const hits = visible.filter((i) => textMatches(query, itemSearchText(i)));
  const items = sortBySortKey(hits, sort).map(itemView);

  let suggestion = null;
  if (!items.length) {
    const best = bestSuggestion(
      query,
      visible.map((i) => ({ text: i.title, id: i.id }))
    );
    if (best) suggestion = { text: best.text, id: best.id };
  }
  return { items, suggestion, query, total: items.length };
}

/** GET /api/items?mode=&sort=&category=&limit= — plain browse, no query */
export async function getBrowse({ mode = 'all', sort = 'newest', category = 'all', limit } = {}) {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    // a category is its own route here; everything else is a filtered browse
    const data =
      category && category !== 'all'
        ? await GET('/items/category', { name: category })
        : await GET('/items', { mode: mode === 'all' ? '' : mode, sort: SORT_OUT[sort] || sort });
    let items = ((data && data.items) || []).map((row) => A.toItem(row, viewer));
    if (limit) items = items.slice(0, limit);
    return { items, total: items.length, suggestion: null, query: '' };
  }
  await settle();
  const user = me();
  let list = db.items.filter((i) => i.ownerId !== user.id && i.available);
  if (mode !== 'all') list = list.filter((i) => i.mode === mode);
  if (category && category !== 'all') list = list.filter((i) => i.category === category);
  const items = sortBySortKey(list, sort).map(itemView);
  return { items: limit ? items.slice(0, limit) : items, total: items.length, suggestion: null, query: '' };
}

/** GET /api/items/:id */
export async function getItem(id) {
  if (!USE_MOCK) return GET('/items/one', { id: A.fromId(id) }, (data) => A.toItem(data, ensureMeCache()));
  await settle();
  return itemView(findItem(id));
}

/** POST /api/items */
export async function listItem(payload) {
  if (!USE_MOCK) {
    const wants = uniqSkills(payload.wants || []);
    return POST(
      '/items',
      {
        title: String(payload.title || '').trim(),
        category: payload.category,
        mode: payload.mode,
        price: payload.mode === 'sell' ? Number(payload.price) : 0,
        wantsInReturn: A.joinList(wants),
      },
      (data) => A.toItem(data, ensureMeCache())
    );
  }
  await settle();
  const user = me();
  const title = String(payload.title || '').trim();
  const mode = payload.mode;
  if (title.length < 3) throw new ApiError('Give your item a clear title (3+ characters)', 'title');
  if (!CATEGORIES.includes(payload.category)) throw new ApiError('Pick a category', 'category');
  if (!['free', 'barter', 'sell'].includes(mode)) throw new ApiError('Pick how you want to pass it on', 'mode');

  const wants = uniqSkills(payload.wants || []).map((w) => w.replace(/\s+/g, ' '));
  if (mode === 'barter' && !wants.length) throw new ApiError('Say what you want in return', 'wants');
  const price = mode === 'sell' ? Number(payload.price) : null;
  if (mode === 'sell' && (!Number.isFinite(price) || price <= 0 || price > 100000)) {
    throw new ApiError('Enter a price in rupees (more than 0)', 'price');
  }

  const item = {
    id: `i${db.seq.item++}`,
    ownerId: user.id,
    title,
    category: payload.category,
    mode,
    price: mode === 'sell' ? Math.round(price) : null,
    wants: mode === 'barter' ? wants : [],
    condition: String(payload.condition || 'Good').trim() || 'Good',
    description: String(payload.description || '').trim(),
    available: true,
    waitlist: [],
    createdAt: Date.now(),
  };
  db.items.unshift(item);
  notify();
  return itemView(item);
}

/** GET /api/items/mine */
export async function getMyItems() {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await GET('/items/mine');
    return ((data && data.items) || []).map((row) => A.toMyItem(row, viewer));
  }
  await settle();
  const user = me();
  return db.items
    .filter((i) => i.ownerId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((i) => ({
      ...itemView(i),
      waitingNames: i.waitlist.map((id) => db.users.find((u) => u.id === id)?.name).filter(Boolean),
      openRequests: db.requests.filter((r) => r.itemId === i.id && r.status === 'pending').length,
    }));
}

/** POST /api/items/:id/requests  (body: { offerItemId }) */
export async function requestItem(id, offerItemId = null) {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await POST('/items/request', { id: A.fromId(id), offer: offerItemId ? A.fromId(offerItemId) : 0 });
    // a free item answers with a queue place; barter/sell answer with a request
    if (data && data.place !== undefined && !data.request) return { place: Number(data.place), ok: true };
    return {
      request: A.toRequest(data.request, viewer),
      owner: data.request?.listing ? A.toPerson(data.request.listing.owner) : null,
    };
  }
  await settle();
  const user = me();
  const item = findItem(id);
  if (item.ownerId === user.id) throw new ApiError('This is your own listing.');
  if (!item.available) throw new ApiError('This item is no longer available.');
  if (item.mode === 'free') throw new ApiError('Free items use the waitlist — join it instead.');

  let offer = null;
  if (item.mode === 'barter') {
    if (!offerItemId) throw new ApiError('Pick one of your items to offer', 'offerItemId');
    offer = findItem(offerItemId);
    if (offer.ownerId !== user.id) throw new ApiError('You can only offer your own items.');
    if (!offer.available) throw new ApiError('That item is already taken.');
  }

  const dup = db.requests.find(
    (r) => r.fromId === user.id && r.toId === item.ownerId && r.type === 'item' && r.listingId === item.id && r.status === 'pending'
  );
  if (dup) throw new ApiError('You already sent a request for this item — it is still pending.');

  const request = {
    id: `r${db.seq.request++}`,
    fromId: user.id,
    toId: item.ownerId,
    type: 'item',
    skill: null,
    listingId: item.id,
    itemId: item.id,
    offerItemId: offer ? offer.id : null,
    note: offer
      ? `Swap my "${offer.title}" for your "${item.title}"`
      : `I would like to buy "${item.title}" for ₹${item.price}`,
    status: 'pending',
    autoDeclined: false,
    createdAt: Date.now(),
  };
  db.requests.unshift(request);
  notify();
  return { request: requestView(request), owner: personView(db.users.find((u) => u.id === item.ownerId)) };
}

/** POST /api/items/active { id, active: "0" } — the server has no DELETE verb */
export async function removeItem(id) {
  if (!USE_MOCK) {
    // there is no DELETE on this server: "remove" means "stop showing it"
    await POST('/items/active', { id: A.fromId(id), active: '0' });
    return { ok: true };
  }
  await settle();
  const user = me();
  const item = findItem(id);
  if (item.ownerId !== user.id) throw new ApiError('Only the owner can remove a listing.');
  db.items = db.items.filter((i) => i.id !== id);
  // anyone waiting is let go, and pending requests for it are closed out
  db.requests
    .filter((r) => r.itemId === id && r.status === 'pending')
    .forEach((r) => {
      r.status = 'declined';
      r.autoDeclined = true;
    });
  notify();
  return { ok: true, title: item.title };
}

/** POST /api/items/:id/waitlist */
export async function joinWaitlist(id) {
  if (!USE_MOCK) {
    const data = await POST('/items/request', { id: A.fromId(id) });
    return { position: Number(data.place || 0), total: null, ahead: [] };
  }
  await settle();
  const user = me();
  const item = findItem(id);
  if (item.mode !== 'free') throw new ApiError('Only free items have a waitlist.');
  if (item.ownerId === user.id) throw new ApiError('You cannot join the waitlist for your own item.');
  if (!item.available) throw new ApiError('This item has already been given away.');
  const existing = item.waitlist.indexOf(user.id);
  if (existing >= 0) throw new ApiError(`You are already #${existing + 1} in line.`);
  item.waitlist.push(user.id);
  notify();
  return {
    position: item.waitlist.length,
    total: item.waitlist.length,
    ahead: item.waitlist.slice(0, -1).map((uid) => db.users.find((u) => u.id === uid)?.name).filter(Boolean),
  };
}

/** POST /api/items/:id/hand-off — give the free item to the first person in line */
export async function handOff(id) {
  if (!USE_MOCK) {
    const data = await POST('/items/handoff', { id: A.fromId(id) });
    return A.toHandoff(data || {});
  }
  await settle();
  const user = me();
  const item = findItem(id);
  if (item.ownerId !== user.id) throw new ApiError('Only the owner can hand off an item.');
  // the server answers a second hand-off with 409; the mock says the same thing
  // instead of quietly giving the item to the next person in line
  if (!item.available) throw new ApiError('This item has already been handed over.', null, { status: 409 });
  if (!item.waitlist.length) throw new ApiError('Nobody is waiting for this item yet.');

  const [nextId, ...rest] = item.waitlist;
  item.waitlist = []; // the queue is done with: nobody is left to hand to
  item.available = false;

  const next = db.users.find((u) => u.id === nextId);
  db.requests.unshift({
    id: `r${db.seq.request++}`,
    fromId: nextId,
    toId: user.id,
    type: 'item',
    skill: null,
    listingId: item.id,
    itemId: item.id,
    offerItemId: null,
    note: `Waitlist hand-off of "${item.title}"`,
    status: 'accepted',
    autoDeclined: false,
    createdAt: Date.now(),
  });
  const others = db.requests.filter((r) => r.itemId === item.id && r.status === 'pending');
  others.forEach((r) => {
    r.status = 'declined';
    r.autoDeclined = true;
  });
  notify();
  // `remaining` is who else was in line and is now told it is gone; `declinedOthers`
  // counts the pending requests closed alongside. Both are facts from this db,
  // and in real mode they arrive as null when the server does not report them.
  return { to: contactView(next), itemTitle: item.title, remaining: rest.length, declinedOthers: others.length };
}

/** POST /api/items/active { id, active: "1" | "0" } */
export async function setItemActive(id, active) {
  if (!USE_MOCK) {
    // flat, POST-only: availability travels as the string "1"/"0"
    const data = await POST('/items/active', { id: A.fromId(id), active: active ? '1' : '0' });
    return A.toItem(data, ensureMeCache());
  }
  await settle();
  const user = me();
  const item = findItem(id);
  if (item.ownerId !== user.id) throw new ApiError('Only the owner can change this listing.');
  item.available = !!active;
  notify();
  return itemView(item);
}

/* ------------------------------------------------------------------ skills */

/** GET /api/barter?skill= → { swaps, circle, oneWay } */
export async function findBarter(skill) {
  if (!USE_MOCK) {
    const wanted = cleanSkill(skill);
    if (!wanted) return { skill: '', skillLabel: '', swaps: [], circle: null, oneWay: [] };
    const viewer = await ensureMe();
    const data = await GET('/barter', { skill: wanted });
    const swaps = ((data && data.swaps) || []).map((row) => A.toSwap(row, wanted));
    const links = (data && data.circle) || [];
    let circle = null;
    if (!swaps.length && links.length) {
      const circles = await GET('/circles');
      circle = A.toCircle({
        links,
        circleMembers: data.circleMembers,
        me: viewer,
        mePerson: await personOfMe(),
        alreadySent: ((circles && circles.circles) || []).some((c) => cleanSkill(c.skill || '') === wanted),
      });
    }
    return {
      skill: wanted,
      skillLabel: swaps[0]?.skillLabel || wanted,
      swaps,
      circle,
      oneWay: ((data && data.oneWay) || []).map((person) => {
        const peer = A.toPerson(person);
        return { peer, teaches: peer?.teaches || [], wants: [] };
      }),
    };
  }
  await settle();
  const user = me();
  const wanted = cleanSkill(skill);
  if (!wanted) return { skill: '', skillLabel: '', swaps: [], circle: null, oneWay: [] };

  const swaps = findTwoWaySwaps(user, wanted, db.users).map(({ user: peer, score, matchedSkills }) => ({
    peer: personView(peer),
    score,
    teaches: peer.teaches,
    // matchedSkills are canonical (lowercased) — show them the way I wrote them
    wantsFromYou: matchedSkills.map((skillName) => (user.teaches || []).find((t) => cleanSkill(t) === skillName) || skillName),
    skill: wanted,
    skillLabel: taughtAs(peer, wanted),
    alreadyRequested: db.requests.some(
      (r) =>
        r.fromId === user.id &&
        r.toId === peer.id &&
        r.type === 'swap' &&
        cleanSkill(r.skill) === wanted &&
        r.status === 'pending'
    ),
  }));

  let circle = null;
  if (!swaps.length) {
    const found = findExchangeCircle(user, wanted, db.users);
    if (found) {
      const memberIds = found.ids.filter((id) => id !== user.id);
      circle = {
        size: found.size,
        ids: found.ids,
        alreadySent: memberIds.some((id) =>
          db.requests.some(
            (r) =>
              r.fromId === user.id &&
              r.toId === id &&
              r.type === 'circle' &&
              cleanSkill(r.skill) === wanted &&
              r.status === 'pending'
          )
        ),
        people: [personView(user), ...found.people.map(personView)],
        edges: found.edges.map((e) => ({
          from: personView(db.users.find((u) => u.id === e.from))?.name,
          to: personView(db.users.find((u) => u.id === e.to))?.name,
          skill: e.skill,
        })),
        memberIds,
        note: found.edges.map((e) => e.skill),
      };
    }
  }

  const oneWay = swaps.length || circle ? [] : findOneWayTeachers(user, wanted, db.users).map(({ user: peer, wants }) => ({
    peer: personView(peer),
    teaches: peer.teaches,
    wants,
  }));

  // Someone on campus teaches this skill — borrow their casing so headings never read "Dbms".
  const teacher = db.users.find((u) => (u.teaches || []).some((t) => cleanSkill(t) === wanted));
  return { skill: wanted, skillLabel: taughtAs(teacher, skill), swaps, circle, oneWay };
}

/** POST /api/swaps (body: { toId, skill }) */
export async function sendSwapRequest(toId, skill) {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await POST('/barter/request', { to: A.fromId(toId), skill });
    return { request: A.toRequest(data.request, viewer), sentTo: data.request ? A.toPerson(data.request.to) : null };
  }
  await settle();
  const user = me();
  const peer = db.users.find((u) => u.id === toId);
  if (!peer) throw new ApiError('That student is not on StudentSetu.');
  if (peer.id === user.id) throw new ApiError('You cannot swap skills with yourself.');
  const wanted = cleanSkill(skill);
  if (!wanted) throw new ApiError('Tell them which skill you want to learn.');

  const dup = db.requests.find(
    (r) =>
      r.fromId === user.id &&
      r.toId === peer.id &&
      r.type === 'swap' &&
      cleanSkill(r.skill) === wanted &&
      r.status === 'pending'
  );
  if (dup) throw new ApiError('A swap request for this skill is already pending.');

  const label = uniqSkills([taughtAs(peer, skill)])[0]; // "DBMS", never "dbms"
  const request = {
    id: `r${db.seq.request++}`,
    fromId: user.id,
    toId: peer.id,
    type: 'swap',
    skill: label,
    listingId: null,
    itemId: null,
    offerItemId: null,
    circleIds: null,
    note: `Swap: I teach ${user.teaches.join(' + ')} for ${label}`,
    status: 'pending',
    autoDeclined: false,
    createdAt: Date.now(),
  };
  db.requests.unshift(request);
  notify();
  return { request: requestView(request), sentTo: personView(peer) };
}

/** POST /api/swaps/circle (body: { memberIds, skill }) */
export async function sendCircleRequest(memberIds, skill) {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    // the server wants one flat "1, 2, 3" string of member ids
    const data = await POST('/circles', { members: A.joinList((memberIds || []).map(A.fromId)), skill });
    const circle = A.toCircleState(data.circle || data, viewer);
    return { sent: circle?.members.length || 0, to: (circle?.members || []).map((m) => m.student), circle };
  }
  await settle();
  const user = me();
  const ids = (memberIds || []).filter((id) => id !== user.id && db.users.some((u) => u.id === id));
  if (!ids.length) throw new ApiError('No circle members to notify.');
  // keep the teacher's own casing for the circle's skill label
  const teacher = db.users.find((u) => (u.teaches || []).some((t) => cleanSkill(t) === cleanSkill(skill)));
  const label = uniqSkills([taughtAs(teacher, skill)])[0] || skill;

  // same group + same skill twice is the same ask: reuse the open circle
  const open = db.circles.find(
    (c) =>
      c.ownerId === user.id &&
      cleanSkill(c.skill) === cleanSkill(label) &&
      c.memberIds.length === ids.length + 1 &&
      ids.every((id) => c.memberIds.includes(id)) &&
      ['waiting', 'active'].includes(circleState(c, user.id).status)
  );
  if (open) {
    const state = circleState(open, user.id);
    throw new ApiError(
      state.status === 'active'
        ? `Your ${label} circle is already agreed — open Activity to see it.`
        : `Your ${label} circle is still waiting on ${state.waitingCount} people.`,
      null,
      { status: 409, circle: state }
    );
  }

  const circle = {
    id: `c${db.seq.circle++}`,
    ownerId: user.id,
    skill: label,
    memberIds: [user.id, ...ids],
    createdAt: Date.now(),
  };
  db.circles.push(circle);

  const created = ids.map((toId) => {
    const dup = db.requests.find(
      (r) =>
        r.fromId === user.id &&
        r.toId === toId &&
        r.type === 'circle' &&
        cleanSkill(r.skill) === cleanSkill(label) &&
        r.status === 'pending'
    );
    if (dup) return dup;
    const request = {
      id: `r${db.seq.request++}`,
      fromId: user.id,
      toId,
      type: 'circle',
      skill: label,
      listingId: null,
      itemId: null,
      offerItemId: null,
      circleIds: ids.filter((x) => x !== toId),
      note: `Circle for ${label}: everyone learns by teaching the next person`,
      status: 'pending',
      autoDeclined: false,
      circleTag: circle.id,
      createdAt: Date.now(),
    };
    db.requests.unshift(request);
    return request;
  });
  notify();
  return {
    sent: created.length,
    to: ids.map((id) => personView(db.users.find((u) => u.id === id))),
    circle: circleState(circle, user.id),
  };
}

/* ------------------------------------------------------------------- paid */

/** GET /api/tutors?subject=&min=&max=&sort= */
export async function searchTutors(subject, min = 0, max = 1000, sort = 'price_asc') {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await GET('/tutors', { subject: subject || '', min, max, sort: SORT_OUT[sort] || sort || 'low' });
    const tutors = ((data && data.tutors) || []).map((row) => A.toTutor(row, viewer));
    return { tutors, total: tutors.length, query: cleanSkill(subject) };
  }
  await settle();
  const user = me();
  const query = cleanSkill(subject);
  let list = db.tutorings.filter((t) => t.active && db.users.find((u) => u.id === t.userId)?.id !== user.id);
  if (query) list = list.filter((t) => textMatches(query, t.subject));
  list = list.filter((t) => t.pricePerHour >= Number(min) && t.pricePerHour <= Number(max));
  const sorted = [...list].sort((a, b) => {
    if (sort === 'price_desc') return b.pricePerHour - a.pricePerHour || a.id.localeCompare(b.id);
    if (sort === 'rating') {
      const rate = (t) => (t.reviews ? t.rating : -1); // unrated tutors go last, not first
      return rate(b) - rate(a) || a.pricePerHour - b.pricePerHour || a.id.localeCompare(b.id);
    }
    return a.pricePerHour - b.pricePerHour || a.id.localeCompare(b.id);
  });
  return { tutors: sorted.map(tutoringView), total: sorted.length, query };
}

/** POST /api/teach { subject, about, price } — the row comes back as { listing } */
export async function addTeaching({ subject, description, pricePerHour }) {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await POST('/teach', { subject, about: description, price: Number(pricePerHour) });
    return A.toTutor(data, viewer);
  }
  await settle();
  const user = me();
  const cleanSubject = String(subject || '').trim();
  const price = Number(pricePerHour);
  if (cleanSubject.length < 3) throw new ApiError('Say what you teach (3+ characters)', 'subject');
  if (String(description || '').trim().length < 10) throw new ApiError('Add a short description (10+ characters)', 'description');
  if (!Number.isFinite(price) || price <= 0) throw new ApiError('Enter an hourly price above ₹0', 'pricePerHour');
  if (price > 5000) throw new ApiError('Keep peer prices fair — ₹5000/hr max', 'pricePerHour');

  const tutoring = {
    id: `t${db.seq.tutoring++}`,
    userId: user.id,
    subject: cleanSubject,
    description: String(description).trim(),
    pricePerHour: Math.round(price),
    active: true,
    rating: 5,
    reviews: 0,
    createdAt: Date.now(),
  };
  db.tutorings.unshift(tutoring);
  notify();
  return tutoringView(tutoring);
}

/** GET /api/teach/mine → the same { id, subject, about, price, active, owner } rows */
export async function getMyTeaching() {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await GET('/teach/mine');
    return ((data && data.listings) || []).map((row) => A.toTutor(row, viewer));
  }
  await settle();
  const user = me();
  return db.tutorings
    .filter((t) => t.userId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((t) => ({
      ...tutoringView(t),
      pendingStudents: db.requests.filter((r) => r.listingId === t.id && r.status === 'pending').length,
    }));
}

/** POST /api/teach/active { id, active: "1" | "0" } */
export async function setTeachingActive(id, active) {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await POST('/teach/active', { id: A.fromId(id), active: active ? '1' : '0' });
    return A.toTutor(data, viewer);
  }
  await settle();
  const user = me();
  const tutoring = db.tutorings.find((t) => t.id === id);
  if (!tutoring) throw new ApiError('That listing no longer exists.');
  if (tutoring.userId !== user.id) throw new ApiError('Only you can pause your own listing.');
  tutoring.active = !!active;
  notify();
  return tutoringView(tutoring);
}

/** POST /api/tutors/request { id } — the listing id; there are no path params on this API */
export async function requestTutor(id) {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await POST('/tutors/request', { id: A.fromId(id) });
    return { request: A.toRequest(data.request, viewer), tutor: data.request ? A.toPerson(data.request.to) : null };
  }
  await settle();
  const user = me();
  const tutoring = db.tutorings.find((t) => t.id === id);
  if (!tutoring) throw new ApiError('That tutor is not available.');
  if (tutoring.userId === user.id) throw new ApiError('This is your own tutor listing.');
  if (!tutoring.active) throw new ApiError('This tutor has paused new students.');

  const dup = db.requests.find(
    (r) => r.fromId === user.id && r.listingId === tutoring.id && r.type === 'paid' && r.status === 'pending'
  );
  if (dup) throw new ApiError('Your session request to this tutor is still pending.');

  const request = {
    id: `r${db.seq.request++}`,
    fromId: user.id,
    toId: tutoring.userId,
    type: 'paid',
    skill: null,
    listingId: tutoring.id,
    itemId: null,
    offerItemId: null,
    note: `Session request: ${tutoring.subject}`,
    status: 'pending',
    autoDeclined: false,
    createdAt: Date.now(),
  };
  db.requests.unshift(request);
  notify();
  return { request: requestView(request), tutor: personView(db.users.find((u) => u.id === tutoring.userId)) };
}

/* --------------------------------------------------------------- requests */

/** GET /api/requests → { received, sent } */
export async function getRequests() {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await GET('/requests');
    const map = (list) => (list || []).map((row) => A.toRequest(row, viewer));
    return { received: map(data.received), sent: map(data.sent), pendingCount: Number(data.newCount || 0) };
  }
  await settle();
  const user = me();
  const all = db.requests
    .filter((r) => r.fromId === user.id || r.toId === user.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(requestView);
  return {
    received: all.filter((r) => r.direction === 'received'),
    sent: all.filter((r) => r.direction === 'sent'),
  };
}

/** GET /api/requests/pending-count */
export async function getPendingCount() {
  if (!USE_MOCK) {
    // newCount from /api/requests is the badge — there is no count-only route
    const data = await GET('/requests');
    return { count: Number(data.newCount || 0) };
  }
  await settle();
  const user = me();
  return { count: db.requests.filter((r) => r.toId === user.id && r.status === 'pending').length };
}

/** POST /api/requests/:id/accept */
export async function acceptRequest(id) {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await POST('/requests/accept', { id: A.fromId(id) });
    const request = A.toRequest(data.request || data, viewer);
    return { request, contact: request.otherContact, itemTitle: null, declinedOthers: 0 };
  }
  await settle();
  const user = me();
  const request = db.requests.find((r) => r.id === id);
  if (!request) throw new ApiError('That request no longer exists.');
  if (request.toId !== user.id) throw new ApiError('Only the receiver can accept a request.');
  if (request.status !== 'pending') throw new ApiError(`Already ${request.status}.`);

  request.status = 'accepted';
  request.acceptedAt = Date.now();

  let declinedOthers = 0;
  let itemTitle = null;
  if (request.type === 'item' && request.itemId) {
    const item = db.items.find((i) => i.id === request.itemId);
    if (item) {
      item.available = false;
      itemTitle = item.title;
    }
    const offer = request.offerItemId ? db.items.find((i) => i.id === request.offerItemId) : null;
    if (offer) offer.available = false;
    // both listings are gone, so every other pending request touching either one is declined
    const affected = new Set([request.itemId, offer ? offer.id : null].filter(Boolean));
    db.requests
      .filter(
        (r) => r.id !== request.id && r.status === 'pending' && (affected.has(r.itemId) || affected.has(r.offerItemId))
      )
      .forEach((r) => {
        r.status = 'declined';
        r.autoDeclined = true;
        declinedOthers += 1;
      });
  }

  notify();
  return {
    request: requestView(request),
    contact: contactView(db.users.find((u) => u.id === request.fromId)),
    itemTitle,
    declinedOthers,
  };
}

/** POST /api/requests/decline { id } — the receiver says no. */
export async function declineRequest(id) {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await POST('/requests/decline', { id: A.fromId(id) });
    return { request: A.toRequest(data.request || data, viewer) };
  }
  await settle();
  const user = me();
  const request = db.requests.find((r) => r.id === id);
  if (!request) throw new ApiError('That request no longer exists.');
  if (request.toId !== user.id) throw new ApiError('Only the receiver can decline a request.');
  if (request.status !== 'pending') throw new ApiError(`Already ${request.status}.`);
  request.status = 'declined';
  request.declinedAt = Date.now();
  notify();
  return { request: requestView(request) };
}

/* -------------------------------------------------- availability, circles,
                                                    ratings (C++ contract) */

/** Lines the user typed -> the canonical "Mon 14:00-17:00" spelling. */
function cleanSlots(lines) {
  const list = (Array.isArray(lines) ? lines : String(lines || '').split(/[,\n]/)).map((raw) => String(raw).trim()).filter(Boolean);
  const out = [];
  for (const line of list) {
    const slot = parseSlot(line);
    if (!slot) throw new ApiError('Use a line like "Mon 14:00-17:00" — day, then a start and end time.', 'freeTime');
    if (!out.includes(slot.text)) out.push(slot.text);
  }
  if (out.length > 8) throw new ApiError('Keep it to the 8 busiest windows — that is plenty to match on.', 'freeTime');
  return out;
}

/** POST /api/me/free-time { freeTime: "Mon 14:00-17:00, Tue 09:00-11:00" } */
export async function setFreeTime(lines) {
  const slots = cleanSlots(lines);

  if (!USE_MOCK) {
    const data = await POST('/me/free-time', { freeTime: A.joinList(slots) });
    return A.toList(data.freeTime ?? slots);
  }

  await settle();
  const user = me();
  user.freeTime = slots;
  notify();
  return slots;
}

/** GET /api/student?id= -> Person (never an email: that stays behind accept). */
export async function getStudent(id) {
  if (!USE_MOCK) return GET('/student', { id: A.fromId(id) }, (data) => A.toPerson(data.student || data));
  await settle();
  const user = db.users.find((u) => u.id === String(id));
  if (!user) throw new ApiError('That student is not on StudentSetu.');
  return personView(user);
}

/** GET /api/meet?with= -> the time slots we can both actually make. */
export async function getMeet(otherId) {
  if (!USE_MOCK) {
    const data = await GET('/meet', { with: A.fromId(otherId) });
    return { slots: A.toMeet(data), query: A.toId(otherId) };
  }
  await settle();
  const user = me();
  const other = db.users.find((u) => u.id === String(otherId));
  if (!other) throw new ApiError('That student is not on StudentSetu.');
  return { slots: commonFreeTime(user.freeTime || [], other.freeTime || []), query: String(otherId) };
}

/** GET /api/top-tutors?k= -> the Home row, ranked by the server. */
export async function getTopTutors(k = 6) {
  if (!USE_MOCK) {
    const data = await GET('/top-tutors', { k });
    return { tutors: ((data && data.tutors) || []).map((row) => A.toTopTutorRow(row)) };
  }
  await settle();
  const user = me();
  const list = db.tutorings
    .filter((t) => t.active && t.userId !== user.id)
    .map((t) => ({ tutor: db.users.find((u) => u.id === t.userId), t }))
    .filter((row) => row.tutor)
    .sort((a, b) => (b.t.reviews ? b.t.rating : -1) - (a.t.reviews ? a.t.rating : -1) || a.t.pricePerHour - b.t.pricePerHour)
    .slice(0, Number(k) || 6);
  return {
    tutors: list.map(({ tutor, t }) => ({
      id: t.id,
      person: personView(tutor),
      subject: t.subject,
      pricePerHour: t.pricePerHour,
      rating: t.reviews ? t.rating : null,
      ratingCount: t.reviews,
      rated: t.reviews > 0,
    })),
  };
}

/**
 * GET /api/circles -> my circles and the invitations waiting on me.
 * An empty list means no circle: the caller shows the finder again, never an
 * empty ring or a "0 people" card.
 */
export async function getMyCircles() {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await GET('/circles');
    return A.toCircleList(data, viewer);
  }
  await settle();
  const circles = circlesOf(sessionId);
  return { circles, count: circles.length, waitingForMe: circles.filter((c) => c.waitingForMe).length };
}

/** POST /api/circles/answer { id, yes: "1" | "0" } — the consensus vote. */
export async function answerCircle(id, yes) {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await POST('/circles/answer', { id: A.fromId(id), yes: yes ? '1' : '0' });
    const raw = data.circle || data;
    return { circle: raw && raw.id !== undefined ? A.toCircleState(raw, viewer) : null, status: data.status || null };
  }

  await settle();
  const user = me();
  const circle = db.circles.find((c) => c.id === String(id));
  if (!circle) throw new ApiError('That circle no longer exists.', null, { status: 404 });

  // the person who proposed it has no invitation to answer: saying "no" to your
  // own circle is how you cancel it, which closes it for everybody
  if (circle.ownerId === user.id) {
    if (yes) throw new ApiError('You proposed this circle — there is nothing for you to accept.');
    const mine = db.requests.filter((r) => r.circleTag === circle.id && r.fromId === user.id);
    if (!mine.length) throw new ApiError('This circle is already closed.', null, { status: 409 });
    // the founder has no invitation to decline: saying no takes the invitations
    // back, so those rows are cancelled, not declined
    mine.forEach((r) => {
      r.status = 'cancelled';
      r.cancelled = true;
    });
    notify();
    const closed = circleState(circle, user.id);
    return { circle: closed, status: closed.status };
  }

  const row = db.requests.find((r) => r.circleTag === circle.id && r.toId === user.id);
  if (!row) throw new ApiError('You are not waiting on an invitation here.', null, { status: 403 });
  if (row.status !== 'pending') throw new ApiError(`You already ${row.status === 'accepted' ? 'accepted' : 'declined'} this.`, null, { status: 409 });
  row.status = yes ? 'accepted' : 'declined';
  row.answeredAt = Date.now();
  notify();
  return { circle: circleState(circle, user.id), status: circleState(circle, user.id).status };
}

/**
 * POST /api/requests/cancel { id } — withdraw a request I sent.
 *
 * A different route from /requests/decline, and a different outcome: declining is
 * the receiver answering "no", cancelling is the sender taking it back, and the
 * server records the row as "cancelled" rather than "declined". Cancelling a
 * circle I started withdraws every invitation in it.
 */
export async function cancelRequest(id) {
  if (!USE_MOCK) {
    const viewer = await ensureMe();
    const data = await POST('/requests/cancel', { id: A.fromId(id) });
    const raw = data.request || data;
    return { ok: true, request: raw && raw.id !== undefined ? A.toRequest(raw, viewer) : null };
  }

  await settle();
  const user = me();
  const request = db.requests.find((r) => r.id === id);
  if (!request) throw new ApiError('That request no longer exists.', null, { status: 404 });
  if (request.fromId !== user.id) throw new ApiError('You can only withdraw a request you sent.', null, { status: 403 });
  if (request.status !== 'pending') throw new ApiError(`This request is already ${request.status}.`, null, { status: 409 });

  if (request.circleTag) {
    db.requests.filter((r) => r.circleTag === request.circleTag && r.fromId === user.id).forEach((r) => {
      r.status = 'cancelled';
      r.cancelled = true;
    });
  } else {
    request.status = 'cancelled';
    request.cancelled = true;
  }
  notify();
  return { ok: true, request: requestView(request) };
}

/**
 * POST /api/ratings { request, stars }. One rating per person per exchange;
 * a second attempt is a conflict, and the screen refreshes instead of resending.
 */
export async function rateRequest(requestId, stars) {
  const score = Math.round(Number(stars));
  if (!(score >= 1 && score <= 5)) throw new ApiError('Pick 1 to 5 stars.', 'stars');

  if (!USE_MOCK) {
    const data = await POST('/ratings', { request: A.fromId(requestId), stars: score });
    return {
      ok: true,
      rating: data.rating === undefined ? null : Number(data.rating),
      ratingCount: data.ratingCount === undefined ? null : Number(data.ratingCount),
    };
  }

  await settle();
  const user = me();
  const request = db.requests.find((r) => r.id === String(requestId));
  if (!request) throw new ApiError('That exchange is not on your record.', null, { status: 404 });
  if (request.status !== 'accepted') throw new ApiError('Only an exchange you both accepted can be rated.', null, { status: 409 });
  if (![request.fromId, request.toId].includes(user.id)) throw new ApiError('You were not part of this exchange.', null, { status: 403 });
  if (db.ratings.some((r) => r.requestId === request.id && r.byId === user.id)) {
    throw new ApiError('You have already rated this exchange.', null, { status: 409 });
  }

  const otherId = request.fromId === user.id ? request.toId : request.fromId;
  db.ratings.push({ id: `v${db.seq.rating++}`, requestId: request.id, byId: user.id, toId: otherId, stars: score, createdAt: Date.now() });
  const other = db.users.find((u) => u.id === otherId);
  if (other) recomputeRating(other);
  notify();
  return { ok: true, rating: other ? other.rating : null, ratingCount: other ? other.ratingCount : null };
}

/* ------------------------------------------------------------------- demo */

/** POST /api/demo/reset — put the mock database back to its seed values */
export async function resetDemo() {
  if (!USE_MOCK) throw new ApiError('Demo data only exists in mock mode.');
  await settle();
  db = createSeed();
  sessionId = DEMO_ACCOUNT.email ? db.users[0].id : null;
  writeToken(db.users[0].id);
  notify();
  return { ok: true, user: personView(db.users[0]) };
}

// These Phase 3 routes preserve the existing frontend API interface.
export async function getBookings() {
  if (USE_MOCK) return { bookings: [] };
  return GET('/bookings');
}

export async function createBooking(listing, slotStart, slotEnd) {
  if (USE_MOCK) throw new ApiError('Bookings need the Phase 3 C++ server.');
  return POST('/bookings', { listing: A.fromId(listing), slotStart, slotEnd });
}

export async function answerBooking(id, accept) {
  if (USE_MOCK) throw new ApiError('Bookings need the Phase 3 C++ server.');
  return POST('/bookings/answer', { id: A.fromId(id), accept: accept ? '1' : '0' });
}

export async function cancelBooking(id) {
  if (USE_MOCK) throw new ApiError('Bookings need the Phase 3 C++ server.');
  return POST('/bookings/cancel', { id: A.fromId(id) });
}

export async function setBookingPayment(id, status) {
  if (USE_MOCK) throw new ApiError('Bookings need the Phase 3 C++ server.');
  return POST('/bookings/payment', { id: A.fromId(id), status });
}

export async function completeRequest(id) {
  if (USE_MOCK) throw new ApiError('Completion confirmation needs the Phase 3 C++ server.');
  return POST('/requests/complete', { id: A.fromId(id) });
}

export const api = {
  USE_MOCK,
  BASE_URL,
  register,
  login,
  demoLogin,
  logout,
  verifyOtp,
  resendOtp,
  getMe,
  updateSkills,
  getCategories,
  searchItems,
  getBrowse,
  getItem,
  listItem,
  getMyItems,
  requestItem,
  joinWaitlist,
  handOff,
  setItemActive,
  removeItem,
  findBarter,
  sendSwapRequest,
  sendCircleRequest,
  searchTutors,
  addTeaching,
  getMyTeaching,
  setTeachingActive,
  requestTutor,
  getRequests,
  getPendingCount,
  acceptRequest,
  declineRequest,
  cancelRequest,
  getMyCircles,
  answerCircle,
  getTopTutors,
  getStudent,
  getMeet,
  setFreeTime,
  rateRequest,
  getBookings,
  createBooking,
  answerBooking,
  cancelBooking,
  setBookingPayment,
  completeRequest,
  resetDemo,
  subscribe,
  setFailureMode,
  getFailureMode,
  DEMO_HINTS,
  setNotifyMuted,
};

export default api;
