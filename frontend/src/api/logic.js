/**
 * Pure matching + graph helpers used by the mock API.
 * These are the exact business rules from the spec, kept framework-free so the
 * real backend can reuse them in tests.
 */

/** " DBMS " -> "dbms" ; multiple spaces collapse */
export function cleanSkill(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function uniqSkills(list) {
  const seen = new Map();
  for (const raw of list || []) {
    const key = cleanSkill(raw);
    if (!key || seen.has(key)) continue;
    seen.set(key, String(raw).trim().replace(/\s+/g, ' '));
  }
  return [...seen.values()];
}

/** Classic iterative Levenshtein distance */
export function editDistance(a = '', b = '') {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1, // deletion
        cur[j - 1] + 1, // insertion
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** similarity = 1 - editDistance(a,b) / max(len a, len b) */
export function similarity(a = '', b = '') {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  return 1 - editDistance(a, b) / longest;
}

export function words(text = '') {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
}

/** below this a "50% similar" word is just noise (3-letter queries match anything short) */
const MIN_FUZZY_WORD = 5;

/**
 * 50% similarity search:
 *  - query shorter than 3 letters  -> must match the START of a word
 *  - otherwise an exact part match, OR the whole text >= 50% similar,
 *    OR any single word >= 50% similar
 *  - empty query -> never matches
 */
export function textMatches(query, text) {
  const q = cleanSkill(query);
  const t = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q || !t) return false;
  if (q.length < 3) return words(t).some((w) => w.startsWith(q));
  if (t.includes(q)) return true;
  if (similarity(q, t) >= 0.5) return true;
  return words(t).some((w) => w.length >= MIN_FUZZY_WORD && similarity(q, w) >= 0.5);
}

/**
 * Best "did you mean" candidate. Suggestions are allowed to be a little softer
 * (40%) than the 50% rule that decides an actual search hit.
 */
export function bestSuggestion(query, candidates = [], threshold = 0.4) {
  const q = cleanSkill(query);
  if (!q) return null;
  let best = null;
  for (const c of candidates) {
    const target = cleanSkill(c.text);
    if (!target || target === q) continue;
    const score = Math.max(
      similarity(q, target),
      ...words(target).filter((w) => w.length >= MIN_FUZZY_WORD).map((w) => similarity(q, w)),
      0
    );
    if (score >= threshold && (!best || score > best.score)) best = { text: c.text, id: c.id, score };
  }
  return best;
}

export function sortBySortKey(list, sort) {
  const copy = [...list];
  if (sort === 'price_asc') copy.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.id.localeCompare(b.id));
  else if (sort === 'price_desc') copy.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity) || a.id.localeCompare(b.id));
  else copy.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  return copy;
}

/**
 * How `owner` wrote this skill in their own profile — so a search for "dbms"
 * can be shown as "DBMS". Falls back to the raw text the user typed.
 */
export function taughtAs(owner, skill) {
  const wanted = cleanSkill(skill);
  const hit = (owner?.teaches || []).find((t) => cleanSkill(t) === wanted);
  return hit || String(skill || '').trim() || wanted;
}

/**
 * Two-way swaps: B teaches the searched skill AND B wants >= 1 skill I teach.
 * Score = how many of my skills B wants. Sort score desc, then id.
 */
export function findTwoWaySwaps(me, skill, users) {
  const wanted = cleanSkill(skill);
  const mine = (me.teaches || []).map(cleanSkill);
  const out = [];
  for (const u of users) {
    if (u.id === me.id) continue;
    const teaches = (u.teaches || []).map(cleanSkill);
    if (!teaches.includes(wanted)) continue;
    const theirWants = (u.wants || []).map(cleanSkill);
    const score = mine.filter((s) => theirWants.includes(s)).length;
    if (score > 0) out.push({ user: u, score, matchedSkills: mine.filter((s) => theirWants.includes(s)) });
  }
  out.sort((a, b) => b.score - a.score || String(a.user.id).localeCompare(String(b.user.id)));
  return out;
}

/**
 * Does `from` want anything `to` teaches? Returns the skill in the form the
 * teacher wrote it in, so labels read "DSA" and not "dsa".
 */
function wantsFrom(from, to) {
  const wanted = (from.wants || []).map(cleanSkill);
  const hit = (to.teaches || []).map(cleanSkill).find((s) => wanted.includes(s));
  if (!hit) return null;
  return (to.teaches || []).find((s) => cleanSkill(s) === hit) || hit;
}

/**
 * Exchange circle — smallest ring of 3, then 4 people containing me.
 * Edge A -> B means "A wants a skill B teaches", but my own first edge only
 * points at people who teach the skill I searched for.
 * DFS with backtracking, no person repeats.
 */
export function findExchangeCircle(me, skill, users) {
  const wanted = cleanSkill(skill);
  const pool = users.filter((u) => u.id !== me.id);
  const byId = new Map(pool.map((u) => [u.id, u]));

  const firstHop = pool.filter((u) => (u.teaches || []).map(cleanSkill).includes(wanted));
  if (!firstHop.length) return null;

  for (const size of [3, 4]) {
    for (const start of firstHop) {
      const path = [me.id, start.id];
      const visited = new Set(path);
      const walk = () => {
        const last = byId.get(path[path.length - 1]);
        if (path.length === size) {
          // close the loop: last person must want something I teach
          const closing = wantsFrom(last, me);
          return closing ? [{ from: last.id, to: me.id, skill: closing }] : null;
        }
        for (const next of pool) {
          if (visited.has(next.id)) continue;
          const edgeSkill = wantsFrom(last, next);
          if (!edgeSkill) continue;
          visited.add(next.id);
          path.push(next.id);
          const rest = walk();
          if (rest) return [{ from: last.id, to: next.id, skill: edgeSkill }, ...rest];
          path.pop();
          visited.delete(next.id);
        }
        return null;
      };
      const closing = walk();
      if (closing) {
        // `path[0]` is me and is not in `pool`, so filter it out of `people`
        const people = path.map((id) => byId.get(id)).filter(Boolean);
        const head = { from: me.id, to: start.id, skill: displaySkill(start, wanted) };
        return { size: path.length, ids: [...path], people, edges: [head, ...closing] };
      }
    }
  }
  return null;
}

/** Keep the original capitalisation of the matched skill for display */
function displaySkill(user, cleaned) {
  const found = (user.teaches || []).find((s) => cleanSkill(s) === cleaned);
  return found || cleaned;
}

/** One-way teachers: teach the skill, but want nothing I teach */
export function findOneWayTeachers(me, skill, users) {
  const wanted = cleanSkill(skill);
  return users
    .filter((u) => u.id !== me.id && (u.teaches || []).map(cleanSkill).includes(wanted))
    .map((u) => ({ user: u, wants: u.wants || [] }))
    .sort((a, b) => String(a.user.id).localeCompare(String(b.user.id)));
}

/* ---------------------------------------------------------------- free time */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Monday" / "mon" / "Mon" -> "Mon"; unknown days are dropped. */
function dayCode(value) {
  const key = String(value || '').trim().toLowerCase();
  return DAYS.find((d) => d.toLowerCase() === key || String(value).trim().toLowerCase() === d.toLowerCase() + 'day') ||
    DAYS.find((d) => key.startsWith(d.toLowerCase())) || null;
}

const minutes = (hhmm) => {
  const [h, m = '0'] = String(hhmm).split(':');
  const hours = Number(h);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return null;
  const mins = Number(m) || 0;
  return hours * 60 + mins;
};

/**
 * One availability string -> { day, start, end } in minutes.
 * Accepts "Mon 14:00-17:00", "Mon 2-5pm" (24h only), "Wed 10-12".
 */
export function parseSlot(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const match = /^([A-Za-z]+)\s+(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)$/.exec(raw);
  if (!match) return null;
  const day = dayCode(match[1]);
  const start = minutes(match[2]);
  const end = minutes(match[3]);
  if (!day || start === null || end === null || end <= start) return null;
  return { day, start, end, text: `${day} ${fmt(start)}-${fmt(end)}` };
}

const fmt = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export const parseSlots = (list) => toListSafe(list).map(parseSlot).filter(Boolean);

const toListSafe = (value) =>
  Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];

/** Where two people are both free, as display strings, earliest first. */
export function commonFreeTime(mine, theirs) {
  const a = parseSlots(mine);
  const b = parseSlots(theirs);
  const out = [];
  for (const left of a) {
    for (const right of b) {
      if (left.day !== right.day) continue;
      const start = Math.max(left.start, right.start);
      const end = Math.min(left.end, right.end);
      if (end <= start) continue;
      const text = `${left.day} ${fmt(start)}-${fmt(end)}`;
      if (!out.includes(text)) out.push(text);
    }
  }
  return out.sort((x, y) => DAYS.indexOf(x.slice(0, 3)) - DAYS.indexOf(y.slice(0, 3)) || x.localeCompare(y));
}

/** Are these two availability lists compatible at all? */
export const canMeet = (mine, theirs) => commonFreeTime(mine, theirs).length > 0;

/* ------------------------------------------------------------------ rating */

/** Mean of 1-5 star ratings, one decimal, for a Person's ★ 4.5 (12) chip. */
export function rateStars(ratings) {
  const list = (ratings || []).map((r) => Number(r.stars)).filter((n) => n >= 1 && n <= 5);
  if (!list.length) return { rating: 0, ratingCount: 0 };
  const avg = list.reduce((sum, n) => sum + n, 0) / list.length;
  return { rating: Math.round(avg * 10) / 10, ratingCount: list.length };
}

/** 30 seconds between two OTP requests — enforced server-side too. */
export const OTP_COOLDOWN_MS = 30 * 1000;
export const OTP_LENGTH = 6;
