/**
 * Which data source the app runs on. Read once, shared by the api module and
 * the HTTP client so neither can disagree with the other.
 *
 *   USE_MOCK true   -> the in-memory mock in index.js (default; no server needed)
 *   USE_MOCK false  -> the C++ server at BASE_URL (`/api/...`, GET + POST only)
 *
 * Both flags are BUILD-TIME. Vite inlines `import.meta.env.VITE_*` into the
 * bundle, so changing them means rebuilding (or restarting `npm run dev`) — a
 * visitor can never flip them, and a real-mode build can never fall back to the
 * mock database because the mock branches are not in that bundle at all.
 *
 * Copy `.env.example` to `.env.local` instead of exporting shell variables.
 * Outside a browser (the Node test harnesses) the same names are read from
 * `process.env`, which is how `npm run test:contract` drives the real-mode
 * branches without a server.
 *
 * Run against the server with:
 *   VITE_USE_MOCK=false VITE_API_BASE=http://localhost:8080 npm run dev
 */
function readEnv() {
  const viaVite = typeof import.meta !== 'undefined' && import.meta && import.meta.env;
  if (viaVite && typeof viaVite === 'object') return viaVite;
  if (typeof process !== 'undefined' && process && process.env) return process.env;
  return {};
}

const ENV = readEnv();

/** anything but the literal string 'false' keeps the mock — a typo cannot go to a live API by accident */
export const USE_MOCK = ENV.VITE_USE_MOCK !== 'false';
export const REAL_MODE = !USE_MOCK;

/** '' (same origin) is a valid choice when a proxy or reverse proxy fronts the API. */
export const BASE_URL = ENV.VITE_API_BASE ?? '';
export const TOKEN_KEY = ENV.VITE_TOKEN_KEY || 'setu.token';

/** Dev server / explicit opt-in. A production bundle never gets these flags on its own. */
const IS_DEV = ENV.DEV === true || ENV.DEV === 'true' || ENV.NODE_ENV === 'development';
// two spellings of the same switch: VITE_DEMO_HINTS is what this app has always
// used, VITE_SHOW_DEV_OTP is the name the API team's notes use. Either turns the
// hints on in mock mode; netlify.toml pins both to false.
const EXPLICIT = ENV.VITE_DEMO_HINTS === 'true' || ENV.VITE_SHOW_DEV_OTP === 'true';

/**
 * Where a reviewer is allowed to be told the demo password and the dev OTP.
 * Mock mode AND (dev server OR an explicit VITE_DEMO_HINTS=true). Real mode and
 * production builds get neither, and nothing like this is ever logged.
 */
export const DEMO_HINTS = USE_MOCK && (IS_DEV || EXPLICIT);

/**
 * How often an open screen re-reads the server when it is visible and focused,
 * so another member's acceptance shows up without a reload. 0 turns polling off.
 */
export const POLL_MS = Number(ENV.VITE_POLL_MS ?? (USE_MOCK ? 0 : 15000));
