/**
 * C++ reply  →  the exact object shape the screens already render.
 *
 * The server speaks its own dialect: numeric ids, comma-separated strings where
 * the UI wants arrays, `kind` where the UI wants `type`, a Person with no
 * initials or colour. Each converter here is the single place that dialect is
 * translated, so no screen or component has to know which backend answered.
 *
 * `scripts/test-adapters.mjs` feeds the real payloads and asserts these shapes.
 */
import { AVATAR_COLORS } from '../lib/format.js';

/* ------------------------------------------------------------- primitives */

/** ids travel as numbers; the UI (and React keys) is happier with strings. */
export const toId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/^[a-z]+/i, ''));
  return Number.isFinite(n) ? String(n) : String(value);
};

/** …and back out again when we put an id in a request body. */
export const fromId = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
};

/** Flat-JSON rule: lists are sent as "a, b, c". */
export const joinList = (list) => (Array.isArray(list) ? list : list ? [list] : []).filter(Boolean).join(', ');

/** …and read back whether the server sent an array or a string. */
export const toList = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
};

export const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/** The server has no per-user colour, so derive a stable one from the id. */
const COLOR_KEYS = Object.keys(AVATAR_COLORS);
export function colorFromId(id) {
  const key = String(id || '');
  let sum = 0;
  for (let i = 0; i < key.length; i += 1) sum += key.charCodeAt(i);
  return COLOR_KEYS[sum % COLOR_KEYS.length];
}

export const yearLabel = (year) => `${year}${['th', 'st', 'nd', 'rd'][Number(year)] || 'th'} year`;

export const MODE_LABEL = { free: 'Free', barter: 'Barter', sell: 'Sell' };
export const TYPE_LABEL = { item: 'Item', swap: 'Skill swap', circle: 'Exchange circle', paid: 'Paid session' };

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Timestamps the UI shows as "3h ago". The C++ server does not send them for
 * every reply, and "just now" would be a lie about a listing nobody dated, so an
 * unknown date stays null and each screen hides that chip instead.
 */
export function stamp(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** A field the server does not carry at all (null) vs one it carries empty (''). */
export const knownOr = (value, fallback = '') => (value === null || value === undefined ? fallback : value);

/**
 * The C++ server writes booleans three different ways depending on the column:
 * a JSON `true`/`false`, a numeric `1`/`0`, or the string `"1"`/`"0"`. Reading
 * them with `!== false` (or `=== true`) gets each of those wrong in the opposite
 * direction, so every flag goes through here:
 *
 *   true, 1, '1', 'true'  -> true      false, 0, '0', 'false' -> false
 *   absent, null, ''       -> null      (unknown: never guessed either way)
 */
export function flag(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (text === '1' || text === 'true') return true;
    if (text === '0' || text === 'false') return false;
  }
  return null;
}

/** `flag` with a stated default, for the rare field a screen must render anyway. */
export const flagOr = (value, fallback) => {
  const parsed = flag(value);
  return parsed === null ? fallback : parsed;
};

/* -------------------------------------------------------------- people */

/** Person (public, never carries an email). */
export function toPerson(raw) {
  if (!raw) return null;
  const id = toId(raw.id);
  return {
    id,
    name: raw.name || 'Student',
    initials: initials(raw.name),
    color: raw.color || colorFromId(id),
    branch: raw.branch || 'Other',
    year: num(raw.year, 1),
    yearLabel: yearLabel(raw.year),
    teaches: toList(raw.teaches),
    wants: toList(raw.wants),
    freeTime: toList(raw.freeTime),
    rating: num(raw.rating, 0),
    ratingCount: num(raw.ratingCount, 0),
    // A badge is only ever drawn from the server's own flag, in whichever of the
    // three encodings it arrived in. `null` means the reply said nothing, which is
    // not the same as "unverified" — screens draw the tick on `=== true` only.
    verified: flag(raw.verified),
  };
}

/** Me = Person + email + verified. */
export function toMe(raw) {
  const person = toPerson(raw);
  if (!person) return null;
  return { ...person, email: raw.email || '', verified: flag(raw.verified) };
}

/** Contact details, in the shape the copy/email buttons expect. */
export function toContact(person, email) {
  if (!person || !email) return null;
  const base = toPerson(person);
  return { id: base.id, name: base.name, email, initials: base.initials, color: base.color };
}

/* --------------------------------------------------------------- items */

const brief = (item) =>
  item
    ? { id: item.id, title: item.title, mode: item.mode, available: item.available, modeLabel: item.modeLabel }
    : null;

/** Listing (type "item") → itemView, the shape Items/ItemDetail render. */
export function toItem(raw, me) {
  if (!raw) return null;
  const listing = raw.item && !raw.title ? raw.item : raw; // /items/mine nests the listing
  const owner = toPerson(listing.owner);
  const id = toId(listing.id);
  const mode = listing.mode || 'free';
  const outerWaiting = toList(raw && raw !== listing ? raw.waiting : null);
  const waiting = toList(listing.waiting).length ? toList(listing.waiting) : outerWaiting;
  const hasQueue = listing.waitingCount !== undefined || Array.isArray(listing.waiting) || Array.isArray(raw && raw.waiting);
  const countFrom = listing.waitingCount ?? (raw && raw !== listing ? raw.waitingCount : undefined);
  const waitlistCount = countFrom !== undefined ? num(countFrom) : hasQueue ? waiting.length : null;
  // `place` is the only thing that says where *I* stand. Names in a queue do not:
  // they say who is waiting, not who is ahead of me.
  const place = listing.place !== undefined && listing.place !== null && listing.place !== '' ? num(listing.place) : null;

  return {
    id,
    title: listing.title || 'Untitled',
    category: listing.category || 'Other',
    mode,
    modeLabel: MODE_LABEL[mode] || 'Item',
    price: mode === 'sell' ? num(listing.price, 0) : null,
    wants: toList(listing.wantsInReturn ?? listing.wants),
    // null = this server does not carry the field at all, so the screen hides it.
    condition: listing.condition === undefined ? null : String(listing.condition || ''),
    description:
      listing.about === undefined && listing.description === undefined ? null : String(listing.about ?? listing.description ?? ''),
    // `active` is the contract's word for it, `available` the older one; either
    // spelling may arrive as true/false, 1/0 or "1"/"0". Neither arriving is
    // unknown, which screens must not render as "Taken".
    available: flag(listing.active ?? listing.available),
    isMine: me !== undefined && me !== null && owner && owner.id === toId(me),
    owner,
    createdAt: stamp(listing.createdAt),
    waitlistCount,
    isWaiting: listing.iAmWaiting === true || (place !== null && place > 0),
    position: place && place > 0 ? place : null,
    requestedByMe: listing.requestedByMe === true,
    // only claimable when the server both ordered the queue and told me my place
    peopleAhead: place && place > 0 && waiting.length >= place - 1 ? waiting.slice(0, place - 1) : null,
    // /items/mine extras, kept optional so other screens can ignore them. The
    // queue names ride on the WRAPPER there ({ item, waiting: [...] }), so read
    // both levels and let the wrapper's list win for the count as well.
    ...(outerWaiting.length ? { waitingNames: outerWaiting } : waiting.length ? { waitingNames: waiting } : {}),
    ...(listing.openRequests !== undefined ? { openRequests: num(listing.openRequests) } : {}),
  };
}

/**
 * /items/mine row: { item: Listing, waiting: ["Neha","Ravi"] }
 *
 * The queue lives on the wrapper, so it is read here and re-attached rather than
 * expected inside the listing. `position` stays null: a list of names says who is
 * waiting, not where I stand in that line, and only `place` may claim the latter.
 */
export function toMyItem(raw, me) {
  const item = toItem(raw, me);
  const queue = toList(raw && raw.waiting);
  return {
    ...item,
    openRequests: item.openRequests ?? 0,
    waitingNames: queue.length ? queue : item.waitingNames ?? (item.waitlistCount === 0 ? [] : null),
    waitlistCount: queue.length ? queue.length : item.waitlistCount,
  };
}

/* -------------------------------------------------------------- tutors */

/** Listing (type "teach") → tutoringView, the shape Skills/Paid renders. */
export function toTutor(raw, me) {
  if (!raw) return null;
  const listing = raw.listing && !raw.subject ? raw.listing : raw;
  const tutor = toPerson(listing.owner || listing.tutor);
  return {
    id: toId(listing.id),
    subject: listing.subject || listing.title || '',
    description: listing.about || listing.description || listing.title || '',
    pricePerHour: num(listing.price, 0),
    active: flag(listing.active ?? listing.available),
    rating: num(listing.owner?.rating ?? listing.rating, 0),
    reviews: num(listing.owner?.ratingCount ?? listing.reviews, 0),
    sessionsTaken: listing.sessionsTaken === undefined ? null : num(listing.sessionsTaken, 0),
    pendingByMe: listing.pendingByMe === true,
    isMine: me !== undefined && me !== null && tutor && tutor.id === toId(me),
    tutor,
    createdAt: stamp(listing.createdAt),
    ...(listing.pendingStudents !== undefined ? { pendingStudents: num(listing.pendingStudents) } : {}),
  };
}

/** /api/top-tutors → the Home carousel row. */
export function toTopTutor(raw) {
  const person = toPerson(raw.person || raw);
  return {
    id: person?.id,
    person,
    subject: raw.subject || person?.teaches?.[0] || '',
    pricePerHour: raw.pricePerHour !== undefined ? num(raw.pricePerHour, 0) : null,
    rating: num(raw.rating ?? person?.rating, 0),
    ratingCount: num(raw.ratingCount ?? person?.ratingCount, 0),
  };
}

/* ---------------------------------------------------------- barter */

/** { student, teaches, wantsFromYou, score } → a swap card. */
export function toSwap(raw, wanted) {
  const peer = toPerson(raw.student || raw.peer);
  const teaches = toList(raw.teaches);
  const skill = raw.skill || wanted || '';
  return {
    peer,
    score: num(raw.score, 0),
    teaches,
    wantsFromYou: toList(raw.wantsFromYou),
    skill: (skill || '').toLowerCase(),
    skillLabel: raw.skillLabel || (teaches.find((t) => t.toLowerCase() === String(skill).toLowerCase()) || skill),
    alreadyRequested: raw.alreadyRequested === true,
  };
}

/** { learner, teacher, skill } edge → the ring's arrow label. */
function toEdge(link) {
  return {
    from: toPerson(link.learner)?.name || '?',
    to: toPerson(link.teacher)?.name || '?',
    skill: link.skill || '',
  };
}

/**
 * /api/barter returns a circle as links plus a "1, 2, 3" member string. My own
 * id has to lead the ring, because ExchangeCircle renders people[0] as "You".
 */
export function toCircle({ links = [], circleMembers, me, mePerson, alreadySent = false }) {
  const memberIds = toList(circleMembers).map(toId).filter((id) => id !== toId(me));

  // the people we know by name are the ones on the arrows
  const known = new Map();
  const remember = (raw) => {
    const person = toPerson(raw);
    if (person && !known.has(person.id)) known.set(person.id, person);
  };
  links.forEach((link) => {
    remember(link.learner);
    remember(link.teacher);
  });
  if (mePerson) known.set(toId(mePerson.id), mePerson);

  const personFor = (id) =>
    known.get(id) || {
      id,
      name: `Student ${id}`,
      initials: String(id).slice(0, 2).toUpperCase(),
      color: colorFromId(id),
      branch: '—',
      year: 0,
      yearLabel: '',
      teaches: [],
      wants: [],
      freeTime: [],
      rating: 0,
      ratingCount: 0,
    };

  const people = [mePerson || personFor(toId(me)), ...memberIds.map(personFor)];
  return {
    size: people.length,
    ids: people.map((p) => p.id),
    people,
    edges: links.map((link) => ({
      from: toPerson(link.learner)?.name || '?',
      to: toPerson(link.teacher)?.name || '?',
      skill: link.skill || '',
    })),
    memberIds,
    note: toList(links.map((l) => l.skill).join(', ')),
    alreadySent,
  };
}

/** Circle status card + the Activity "Circles" section. */
export function toCircleState(raw, me) {
  if (!raw) return null;
  const members = (raw.members || []).map((m) => ({
    student: toPerson(m.student || m),
    answer: m.answer || 'waiting',
    contact: m.contact || null,
  }));
  const mine = members.find((m) => m.student?.id === toId(me));
  return {
    id: toId(raw.id),
    skill: raw.skill || '',
    status: raw.status || 'waiting',
    size: members.length || (raw.links || []).length,
    members,
    links: (raw.links || []).map((l) => ({ learner: toPerson(l.learner), teacher: toPerson(l.teacher), skill: l.skill || '' })),
    waitingForMe: raw.waitingForMe === true,
    myAnswer: mine ? mine.answer : null,
    waitingCount: members.filter((m) => m.answer === 'waiting').length,
    yesCount: members.filter((m) => m.answer === 'yes').length,
    // Consensus is what unlocks contact details — not my own yes.
    contactsVisible: (raw.status || 'waiting') === 'active',
    canAnswer: raw.waitingForMe === true,
    iInitiated: toId(raw.createdBy) === toId(me) || raw.initiator === true,
    createdAt: stamp(raw.createdAt),
  };
}

/** GET /api/circles → the Activity "Circles" list (an empty array is no circle). */
export function toCircleList(raw, me) {
  const list = Array.isArray(raw) ? raw : raw?.circles;
  if (!Array.isArray(list) || !list.length) return { circles: [], count: 0, waitingForMe: 0 };
  const circles = list.map((row) => toCircleState(row, me)).filter(Boolean);
  return {
    circles,
    count: circles.length,
    waitingForMe: circles.filter((c) => c.waitingForMe).length,
  };
}

/** GET /api/top-tutors?k= → the Home row. Ratings stay null when unscored. */
export function toTopTutorRow(raw) {
  const tutor = toTopTutor(raw);
  return tutor.ratingCount > 0
    ? { ...tutor, rated: true }
    : { ...tutor, rating: null, rated: false };
}

/* ------------------------------------------------------------ requests */

/** The swap skill is not its own field on the server — it lives in the note. */
function skillFromNote(note) {
  const match = /for (.+?)\.?$/.exec(String(note || ''));
  return match ? match[1].trim() : '';
}

/** { id, kind, status, note, from, to, listing, offer, contact, canRate } → requestView */
export function toRequest(raw, me) {
  const from = toPerson(raw.from);
  const to = toPerson(raw.to);
  const meId = toId(me);
  const other = from && from.id === meId ? to : from;
  const direction = from && from.id === meId ? 'sent' : 'received';
  const kind = raw.kind || 'item';
  const listing = raw.listing ? (raw.listing.type === 'teach' ? toTutor(raw.listing, me) : toItem(raw.listing, me)) : null;
  const isTeach = raw.listing?.type === 'teach';
  const offer = raw.offer ? toItem(raw.offer, me) : null;
  // whose address is this? the server sends the email only; the person it belongs
  // to is the OTHER side of the row — `from` on a request I received, `to` on one
  // I sent — unless it names the contact person explicitly. Defaulting to raw.to
  // labelled a sender's own email as if it were the recipient's.
  const contactPerson = raw.contactPerson || raw.contactStudent || (raw.contactFor ? (other && other.id === toId(raw.contactFor) ? other : to) : other);
  const contact = raw.contact ? toContact(contactPerson, raw.contact) : null;
  const accepted = raw.status === 'accepted';
  const skill = raw.skill || (kind === 'swap' ? skillFromNote(raw.note) : '');

  let title = raw.note || 'Request';
  let subtitle = '';
  if (kind === 'item' && listing) {
    title = listing.title;
    subtitle = offer
      ? `${listing.modeLabel} · you both have something to give`
      : `${listing.modeLabel}${listing.mode === 'sell' ? ` · ₹${listing.price}` : ''} · ${listing.category}`;
  } else if (kind === 'swap') {
    title = `Skill swap · ${skill || listing?.skillLabel || 'skill'}`;
    subtitle =
      direction === 'received'
        ? `${from?.name || 'Someone'} wants to learn ${skill || 'a skill'} from you`
        : `You asked ${to?.name || 'them'} to teach you ${skill || 'a skill'}`;
  } else if (kind === 'paid' && listing) {
    title = `Paid session · ${listing.subject}`;
    subtitle = `₹${listing.pricePerHour}/hr · ${direction === 'received' ? from?.name || '' : to?.name || ''}`;
  }

  return {
    id: toId(raw.id),
    type: kind,
    typeLabel: TYPE_LABEL[kind] || 'Request',
    status: raw.status || 'pending',
    direction,
    canRespond: direction === 'received' && (raw.status || 'pending') === 'pending',
    canCancel: direction === 'sent' && (raw.status || 'pending') === 'pending',
    canRate: raw.canRate === true,
    title,
    subtitle,
    note: raw.note || '',
    skill,
    item: !isTeach && listing ? brief(listing) : null,
    offer: offer ? { id: offer.id, title: offer.title, mode: offer.mode, available: offer.available } : null,
    tutoring: isTeach && listing ? { id: listing.id, subject: listing.subject, pricePerHour: listing.pricePerHour } : null,
    circle: null,
    other,
    contactVisible: accepted && !!contact,
    otherContact: accepted ? contact : null,
    // Activity prints "withdrawn" off this flag; without it a real-mode row would
    // say the server's own word while the demo said "withdrawn" for the same event
    cancelled: raw.status === 'cancelled' || raw.cancelled === true,
    createdAt: stamp(raw.createdAt),
    autoDeclined: raw.autoDeclined === true,
  };
}

/* --------------------------------------------------------------- misc */

/** GET /api/items/categories → the chip row (the server sends names only). */
export function toCategories(raw) {
  // servers answer this two ways: a comma string or array of *names*, or rows that
  // also carry a count. toList() is for name lists — it stringifies what it finds,
  // which is exactly what turned { name, count } rows into "[object Object]" chips
  // on the browse screen, so a real array of rows is read as rows
  const rows = Array.isArray(raw && raw.categories) ? raw.categories : toList(raw && raw.categories);
  return rows
    .map((row) => {
      if (row && typeof row === 'object') {
        const name = row.name ?? row.category ?? row.label;
        return name === undefined || name === null ? null : { name: String(name), count: num(row.count, null) };
      }
      return row === undefined || row === null || row === '' ? null : { name: String(row), count: null };
    })
    .filter(Boolean);
}

/** free item join: { ok, place } */
export function toPlace(raw, item) {
  const position = num(raw.place, 0);
  return {
    position,
    total: item?.waitlistCount ? Math.max(num(item.waitlistCount), position) : position || null,
    ahead: item?.peopleAhead || [],
  };
}

/**
 * POST /api/items/handoff → { ok, givenTo:Person, contact }
 * Same shape as the mock returns ({ to: {name, email}, ... }) so one screen
 * renders both. `email` stays null unless the server actually handed one back —
 * that reveal is the whole point of the hand-off, so it is never assembled here.
 */
export function toHandoff(raw) {
  const person = toPerson(raw.givenTo || raw.to);
  const email = raw.contact || raw.email || null;
  return {
    to: person ? { ...person, email } : null,
    itemTitle: raw.itemTitle || null,
    remaining: raw.remaining === undefined ? null : num(raw.remaining),
    declinedOthers: raw.declinedOthers === undefined ? null : num(raw.declinedOthers, 0),
  };
}

/** GET /api/meet?with= → { commonFreeTime: [...] } */
export const toMeet = (raw) => toList(raw && raw.commonFreeTime);
