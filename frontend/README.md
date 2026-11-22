# StudentSetu 🌉

A campus bridge app for Graphic Era students: **swap skills**, **hire peer tutors**, and **give
away, barter or sell your stuff** — one mobile-first PWA. React + Tailwind + lucide-react, hooks
only, no paid services, no third-party APIs. Every byte on screen comes from one module
(`src/api/index.js`), which today runs an in-memory mock database and tomorrow talks to the real
C++ REST server — without a single component changing.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (a phone-sized viewport is how it is designed)
npm run build      # production bundle in dist/
npm run preview    # serve the built app
npm test           # the three headless gates (mock api, wire contract, service worker)
npm run test:all   # those three plus the jsdom UI walk-through
```

Node **18.19+ / 20.6+** (the UI suites load `.jsx` through a module register hook).
Windows: the same commands in PowerShell — `npm` scripts are shell-agnostic.

### Demo data vs the real server

| | mock (default) | real C++ server |
| --- | --- | --- |
| how | nothing to configure | `VITE_USE_MOCK=false` + `VITE_API_BASE=http://localhost:8080` (the C++ server's `PORT`, 8080 by default) |
| data | seeded in `src/api/seed.js`, 300 ms fake latency | the server, `GET`/`POST` under `/api` |
| sign-in | *Try demo as Gunmay* (`gunmay@geu.ac.in` / `123456`) | `POST /api/login` with a real account |
| OTP email | accepted codes are shown on screen when `VITE_DEMO_HINTS=true` | the server emails a real code |
| demo controls | Profile → *Reset demo data*, *Force API errors* | both rows disappear; `resetDemo()` and `setFailureMode()` reject |

`.env.example` lists every flag; copy it to `.env.local` for the dev server. The C++ server answers
CORS itself on every response (`Access-Control-Allow-Origin: *`, `Content-Type` and `Authorization`
allowed, `OPTIONS` → `204`), so the dev server on :5173 calls it directly — there is **no** `/api`
proxy in `vite.config.js`, on purpose, and no fallback to demo data is ever attempted. The client
never sends cookies (`credentials` is unset), which is what makes that wildcard legal.

Leaving `VITE_API_BASE` empty means "call the origin the page came from" — the usual production
layout, where nginx or Caddy serves `dist/` and proxies `/api`. Because the C++ server is **not
hosted yet**, `netlify.toml` builds the **demo** (`VITE_USE_MOCK = "true"`) so a Netlify deploy is a
viewable UI preview rather than a wall of errors, and it keeps
`VITE_API_BASE = "https://YOUR-API-HOST"` as a marked placeholder for whoever hosts the server.
Flipping that file to `VITE_USE_MOCK = "false"` without replacing the address fails `vite build`:
no deploy of a broken-by-configuration bundle, and no demo data quietly standing in for an API.

---

## Tests

| command | asserts | needs |
| --- | --- | --- |
| `npm run test:mock` | **164** business rules of the shipped `api` module in mock mode (skills, waitlists, hand-offs, circles, ratings, verification, withdrawal, withheld fields) — including a measured proof that a demo session issues **no request at all** | — |
| `npm run test:contract` | **106** checks that the *real* code path speaks the C++ dialect: routes, ids, list encoding, sort words, flag encodings, wrapper queues, `409` conflicts, `null` vs `""`, bearer tokens, and that no demo fallback exists | — |
| `npm run test:sw` | **19** rules of `public/sw.js`: v1 cache purged, `/api` and any `Authorization` request never intercepted, offline fallback for navigations only | — |
| `npm run test:ui` | **87** steps that render the actual screens in jsdom and click through them, including a circle reaching consensus while the screen watches on its own timer | — |
| `npm run test:session` | **25** steps through the real-mode sign-in form, a wrong password, and a protected route answering `401`: token dropped, cached person dropped, stack back to sign-in | — |
| `npm run test:live` | **73** end-to-end reads and writes over a real HTTP socket (28 of the 33 routes), against a live server | an account; the URL defaults to `http://localhost:8080` |

`npm test` runs the three dependency-free suites; `npm run test:all` adds the two jsdom ones.

`test:live` skips itself with an explanation when the server is unreachable (a missing backend is
not a broken frontend) and never falls back to demo data. To try it without a C++ build, use the
dev-only fixture that speaks the same dialect:

```bash
node scripts/fake-cpp-server.mjs &                      # :8080, any seed account / 123456
SETU_EMAIL=gunmay@geu.ac.in SETU_PASSWORD=123456 \
  SETU_PEER_EMAIL=asha@geu.ac.in SETU_PEER_PASSWORD=123456 \
  SETU_LIVE_WRITE=1 npm run test:live                    # SETU_API_URL only if not :8080
```

Without `SETU_PEER_EMAIL`/`SETU_LIVE_WRITE` the same run stays read-only and says so (**29**
assertions, 3 named skips) — it will not accept, rate or list anything on a server you did not opt in to
changing.

No suite in this repository has ever talked to the real C++ server — it does not exist in this
sandbox. Three of the suites simulate it, at different depths, and each says so in its own summary
line: `scripts/test-contract.mjs` replays the dialect into a stubbed `fetch`,
`scripts/test-session.mjs` answers 401s from a stub transport while the real screens render, and
`scripts/fake-cpp-server.mjs` speaks it over a socket. All of them are written from the contract in
[CHANGES.md](CHANGES.md) — they prove the frontend keeps its side of that document, not that a
particular C++ build implements it. `npm run test:live` against `SETU_API_URL` is the run that
measures the latter, and the route-coverage line at its end says which routes it reached.

---

## What is on screen

- **Home** — greeting, live clock, pending badge, search, three carousels (swaps for you, recent
  listings, top tutors), the circle teaser.
- **Items** — browse with mode chips (free / barter / sell / rent), fuzzy "did you mean", listing
  detail, waitlist position for free items, owner-only hand-off, pause/resume, list something.
- **Skills** — Barter: type a skill, get two-way matches, or a three-person **exchange circle** when
  nobody can trade directly; a circle forms only when *every* member says yes, and only then does
  it share contact details. Paid: tutor search by subject and price, request a session, your own
  teaching listings with a live/paused switch, ratings shown next to every score.
- **Activity** — received / sent / circles, accept–decline, cancel a request you sent, answer or
  cancel a circle, rate an accepted exchange (once per person, and it moves their average).
- **Profile** — verified identity, stats, skills editor, "When I am free" windows (used to compute
  common free time), theme switch, sign out, and demo-only controls.
- **Auth** — splash, onboarding, sign in, register, and a **confirm-your-email** screen: a new
  account cannot sign in until the 6-digit code is checked.

Data honesty rules the UI follows, and the server must enforce: a field the server does not have is
**absent from the interface** (never "Unknown", never `0`, never a fake timestamp); an unanswered
request is *waiting*, not *no*; contacts appear only after both sides (or the whole circle) agree.

---

## Layout

```
src/
  api/          env.js · client.js · adapters.js · index.js · seed.js · logic.js · errors.js
  context/      AppContext.jsx — session, navigation stack, toasts, theme, polling
  screens/      one file per screen (auth/ for splash, onboarding, login, register, verify)
  ui/           Button, Inputs, Cards, States, Chrome, BottomSheet, CircleCard, Stars, …
  lib/          hooks.js (useAsync, useOnActive, usePolling, useExclusive, useDebounced), format.js
public/sw.js    offline shell cache — never touches /api
scripts/        the five test suites, run.mjs (loader launcher), fake-cpp-server.mjs, shoot.mjs
```

`src/api/adapters.js` is the only file that knows the server's dialect (numeric ids, comma-joined
lists, `verified`/`available` as `"1"`/`"0"`); everything above it speaks in app shapes.
Deploying? [DEPLOY.md](DEPLOY.md). Changing the API or wondering what moved? [CHANGES.md](CHANGES.md).
