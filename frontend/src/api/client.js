/**
 * The C++ server client.
 *
 * Rules this server plays by (it is not ours to change):
 *  • only GET and POST — no PATCH, no DELETE
 *  • request bodies are FLAT JSON: lists travel as one comma-separated string
 *  • ids are numbers
 *  • errors are { ok:false, error:"message" } with 400/401/403/404/409/429
 *  • after login every call carries Authorization: Bearer <token>
 *
 * Everything server-shaped is converted back in ../adapters.js, so screens never
 * see any of this.
 */
import { ApiError } from './errors.js';
import { BASE_URL, TOKEN_KEY } from './env.js';

/* ------------------------------------------------------------------ token */

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // private mode / no storage: behave like a signed-out client
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function clearToken() {
  setToken(null);
}

/* --------------------------------------------------------------- 401 hook */

const onUnauthorized = new Set();

/**
 * Called when a protected route answers 401: the token is already cleared, and
 * whoever listens has to drop everything it remembered about the session. The api
 * module clears its cached person here; AppContext clears the user and the stack.
 */
export function addUnauthorizedHandler(fn) {
  onUnauthorized.add(fn);
  return () => onUnauthorized.delete(fn);
}

/** The single-slot form, kept so a listener can be replaced wholesale. */
export function setUnauthorizedHandler(fn) {
  onUnauthorized.clear();
  if (fn) onUnauthorized.add(fn);
}

/* ---------------------------------------------------- server error → field */

/**
 * The server returns a sentence, not a field name. Map the common ones onto the
 * input they belong to so the form shows the error where it was earned.
 */
const FIELD_HINTS = [
  [/full name|name too short|invalid name/i, 'name'],
  [/@geu\.ac\.in|college email|email/i, 'email'],
  [/password/i, 'password'],
  [/otp|verification code|verify your email/i, 'otp'],
  [/branch/i, 'branch'],
  [/year/i, 'year'],
  [/teach.*skill|skill you can teach|teaches/i, 'teaches'],
  [/title/i, 'title'],
  [/category/i, 'category'],
  [/price/i, 'price'],
  [/condition/i, 'condition'],
  [/want in return|wants/i, 'wants'],
  [/offer/i, 'offerItemId'],
  [/subject|about/i, 'subject'],
  [/skill/i, 'skill'],
  [/circle|member/i, 'memberIds'],
  [/star|rating/i, 'stars'],
  [/free time|slot|day|time/i, 'freeTime'],
  [/listing|item no longer|already taken|no longer available/i, null],
];

function fieldFor(message) {
  for (const [re, field] of FIELD_HINTS) if (re.test(message)) return field;
  return null;
}

/* --------------------------------------------------------------- the origin */

/**
 * Where to send a call. BASE_URL is baked in at build time, so:
 *   • set  -> that origin must be reachable from the browser AND answer CORS
 *   • empty -> same origin (a reverse proxy or a server that also serves dist/)
 * An https page may not talk to a plain http API (the browser blocks it), which
 * is exactly the trap a Netlify deploy walks into, so it is named up front
 * instead of surfacing as an opaque network error.
 */
function endpoint(path) {
  const base = String(BASE_URL || '').replace(/\/+$/, '');
  const origin = typeof location !== 'undefined' && location.origin ? location.origin : '';
  if (!base && !origin) throw new ApiError('No API origin is configured — set VITE_API_BASE and rebuild.', null, { status: 0 });
  const full = `${base || origin}${path}`;
  const pageIsSecure = typeof location !== 'undefined' && location.protocol === 'https:';
  if (base && pageIsSecure && full.startsWith('http://')) {
    throw new ApiError(
      `The API is set to ${base}, but this page is https — a browser will refuse that request. Host the C++ server behind https and rebuild.`,
      null,
      { status: 0 }
    );
  }
  return full;
}

/**
 * 401s mean two different things and must not be merged: "your saved token died"
 * (clear it, send the user back to the login screen) and "the password you just
 * typed was wrong" (say exactly that, keep the token of whoever is signed in).
 */
const AUTH_ROUTES = /^\/api\/(login|verify|register|otp\/resend)$/;

/* ------------------------------------------------------------------ call */

/**
 * @param {'GET'|'POST'} method
 * @param {string} path      e.g. '/items'
 * @param {object} [options] { query:{...}, body:{...}, raw:false }
 * @returns whatever JSON the server sent, already unwrapped of { ok:true }
 */
export async function call(method, path, { query, body, raw = false } = {}) {
  const url = new URL(endpoint(path.startsWith('/') ? path : `/${path}`));
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const token = getToken();
  let res;
  try {
    // no `credentials`: the API is bearer-token only and sets no cookies, which is
    // what lets the C++ server answer with a plain Access-Control-Allow-Origin: *
    // (adding credentials would make the browser reject that wildcard).
    res = await fetch(url.toString(), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      `Cannot reach the StudentSetu server at ${BASE_URL || 'this origin'} — is it running, and does it allow this origin (CORS)? ` +
        'Nothing was loaded from a demo database instead.',
      null,
      { status: 0 }
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    const message = data.error || data.message || `Request failed (${res.status})`;
    if (res.status === 401 && !AUTH_ROUTES.test(path)) {
      clearToken();
      onUnauthorized.forEach((fn) => fn());
      throw new ApiError('Your session expired — please log in again.', null, { status: 401, ...data });
    }
    // 409 is a "someone changed this underneath you" answer: the screens show
    // this sentence and then re-read the affected listing or request
    throw new ApiError(message, data.field ?? fieldFor(message), { status: res.status, ...data });
  }

  // the server wraps success in ok:true; callers want the payload itself
  if (raw) return data;
  const { ok, ...rest } = data;
  return Object.keys(rest).length ? rest : { ok: true };
}

export const get = (path, query, options) => call('GET', path, { query, ...options });
export const post = (path, body, options) => call('POST', path, { body, ...options });
