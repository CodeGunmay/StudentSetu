# CHANGES — the C++ contract, and what moved in the frontend

The frontend is now written **against a stated wire contract** instead of against the mock's
convenience. This file is that contract; `scripts/test-contract.mjs` enforces it, and
`scripts/fake-cpp-server.mjs` speaks it so `npm run test:live` can run without a C++ build.

If a field or route is not in this file, the frontend does not ask for it and does not display it.

---

## 1 · Envelope, verbs, encoding

- Every response is JSON with **`ok: true`** on success and **`{ ok: false, error: "<sentence>" }`**
  on failure. The `error` string is user-facing: one short sentence, and the UI prints it verbatim.
  An optional `field` names the form input to mark.
- **Only `GET` and `POST`.** No `PUT`/`PATCH`/`DELETE` anywhere: `POST /api/items/active` with
  `active: "0"` is how a listing is paused *and* removed. A request has two different endings, and
  they are two different routes: `POST /api/requests/decline` is the **receiver** saying no, and
  `POST /api/requests/cancel` is the **sender** taking the ask back. Both bodies are `{ id }`. The
  declined row ends up `status: "declined"`, the withdrawn one `status: "cancelled"` — the UI prints
  "withdrawn" for the second and "declined" for the first, so a cancellation must not be recorded as
  a decline.
- **Ids are numbers on the wire, strings in the app.** `A.fromId()` converts going out,
  `String(id)` coming back. Nothing may assume an id is numeric-shaped.
- **Lists are comma-separated strings** (`teaches: "C++, DBMS"`, `members: "2, 5"`,
  `freeTime: "Mon 14:00-17:00, Tue 09:00-11:00"`, `yes: "1"`). `A.toList()` also accepts a real
  array, so a server that prefers JSON arrays is still readable; a bare string is never split on
  spaces.
- **Booleans are `"1"` / `"0"` strings** for `verified`, `active`, `available`, `yes` — that is the
  spelling the server should write. Real replies vary, so `A.flag()` normalises all of them:
  `true`, `1`, `"1"`, `"true"` mean yes; `false`, `0`, `"0"`, `"false"` mean no; **absent or `null`
  means unknown and stays `null`** — it is never coerced, because a missing flag is not a fact (see
  §3). One normaliser covers availability, teaching activity and verification, so those three can
  never disagree about what the same wire value means.
- `year` is a number; `pricePerHour`, `price`, `rating`, `ratingCount` are numbers or null.
- Timestamps: `createdAt` is `YYYY-MM-DD` or an ISO string; unparseable or absent becomes `null` and
  the UI shows no date rather than "just now".
- Auth is **`Authorization: Bearer <token>`** on every call but `POST /api/login|register|verify|otp/resend`.
  A `401` on any other route drops the token and returns the user to sign-in; a `401` from
  `/api/login` does **not** (it means the password was wrong), and its sentence is shown on the form.
- **CORS is the server's job and it is already done**: every response carries
  `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Content-Type, Authorization`,
  `Access-Control-Allow-Methods: GET, POST, OPTIONS`, and the `OPTIONS` preflight answers `204`.
  The client matches that arrangement exactly: it sets **no `credentials`** and no cookies, only
  `Authorization: Bearer <token>` — which is why the `*` is legal. Narrowing `Allow-Origin` and
  adding `credentials` would break each other; `test:mock` guards both sides of that with a source
  scan (`no request uses a verb the server does not have`, `nothing sets fetch credentials`).
- **Local development is `http://localhost:8080`** (the server's own `PORT`, default 8080), and the
  dev server calls it directly — `vite.config.js` has no `/api` proxy, so a missing CORS header is
  visible in development instead of appearing after a deploy. A *deployed* bundle may not point at
  localhost: `vite build` refuses on Netlify and warns elsewhere (see DEPLOY.md §1).

## 2 · Routes the frontend calls (and nothing else)

| | route | query / body | the UI uses it for |
| --- | --- | --- | --- |
| G | `/api/me` | — | profile, greeting, stats, verified badge, free-time chips |
| P | `/api/me/skills` | `teaches`, `wants` (strings) | skills editor |
| P | `/api/me/free-time` | `freeTime` (string) | "When I am free" |
| G | `/api/items` | `q`, `mode`, `sort` | browse, search, home carousels |
| G | `/api/items/one` | `id` | listing detail |
| G | `/api/items/mine` | — | my listings + hand-off queue — **wrapper rows**: `{ item: Listing, waiting: ["Neha", …] }` |
| G | `/api/items/categories` | — | category chips |
| G | `/api/items/category` | `name` | one category feed |
| P | `/api/items` | `title, category, mode, price, wantsInReturn` | list something |
| P | `/api/items/active` | `id`, `active` | pause / resume / remove |
| P | `/api/items/request` | `id`, `offer` | ask for an item, barter offer, join the waitlist |
| P | `/api/items/handoff` | `id` | give a free item to the next in line |
| G | `/api/requests` | — | Activity inbox + sent, badge count |
| P | `/api/requests/accept` | `id` | accept (unlocks the other email) |
| P | `/api/requests/decline` | `id` | the receiver says no |
| P | `/api/requests/cancel` | `id` | the sender withdraws → `status: "cancelled"` |
| G | `/api/barter` | `skill` | swaps for a skill, one-way list, circle links |
| P | `/api/barter/request` | `to`, `skill` | two-way swap ask |
| G | `/api/circles` | — | my circles + `waitingForMe` |
| P | `/api/circles` | `members`, `skill` | propose a circle |
| P | `/api/circles/answer` | `id`, `yes` | say yes / no to a circle |
| P | `/api/ratings` | `request`, `stars` | rate an accepted exchange |
| G | `/api/student` | `id` | other people's profiles (**never** an email) |
| G | `/api/meet` | `with` | common free time (`commonFreeTime`, a string) |
| G | `/api/tutors` | `subject`, `min`, `max`, `sort` | paid tutor board |
| G | `/api/top-tutors` | `k` | home carousel |
| P | `/api/tutors/request` | `id` | request a paid session |
| P | `/api/teach` | `subject`, `about`, `price` | add a tutoring listing |
| G | `/api/teach/mine` | — | my teaching list (same row shape as `/api/tutors`) |
| P | `/api/teach/active` | `id`, `active` | pause / resume a listing |

**Row shapes.** A teaching listing on `/api/tutors` and `/api/teach/mine` is
`{ id, subject, about, price, active, owner }` — the rating lives on `owner` (`rating`,
`ratingCount`), and `active` is the flag from §1. The home carousel is a different row:
`GET /api/top-tutors?k=` answers `{ tutors: [{ person, subject, pricePerHour, rating, ratingCount }] }`,
where `person` is a Person and the price is per hour. Both shapes were taken from the replies the
client was written against; `A.toTutor()`/`A.toTopTutor()` also read the older `description` /
`tutor` / `pricePerHour`-on-listing spellings, but a new server should write the two above.

**Request rows.** `GET /api/requests` answers rows as
`{ id, kind, status, note, from: Person, to: Person, listing, contact, canRate }`, in `received` and
`sent` arrays plus `newCount`. The frontend works out which side it is on from `from.id`, so the
other person in the UI is `from` for a received row and `to` for a sent one. `contact` is an email
the server reveals only after both sides accept, and it is always the **other** participant's:
`A.toRequest()` attaches it to that person (`otherContact.id === other.id`), so a reply that carries
the viewer's own address can never make the app offer to email yourself.
| P | `/api/login`, `/api/register`, `/api/verify`, `/api/otp/resend`, `/api/logout` | see client | auth |

`sort` on `/api/items` and `/api/tutors` is exactly `new | low | high | rating`. There is no
`relevance`, no `/api/search/advanced`, no `/version`, no `/api/health`, and no demo routes —
`resetDemo`, `demoLogin`, `setFailureMode` are mock-only and **reject** in real mode.

**Production has no API address yet.** `netlify.toml` therefore builds the **demo**
(`VITE_USE_MOCK = "true"`) and carries `VITE_API_BASE = "https://YOUR-API-HOST"` as a marked
placeholder for whoever hosts the server: flipping that file to real mode without replacing the
address is refused by `vite build` (as is an empty base that was not opted into with
`VITE_API_SAME_ORIGIN=1`), so no bundle can go out calling a placeholder and then error on every
screen. `VITE_DEMO_HINTS` and its alias `VITE_SHOW_DEV_OTP` are both pinned
`false` there; the app accepts either name (either can turn hints on in mock mode, never in real
mode, because `DEMO_HINTS = USE_MOCK && (dev server || flag)`).

## 3 · Field presence — the honesty rule

The frontend distinguishes *"this server does not track that"* from *"it is empty"*:

| wire | app | on screen |
| --- | --- | --- |
| key **absent** or `null` | `null` | the row/field is **not rendered** |
| `""` or `[]` | `''` / `[]` | rendered as genuinely empty ("no notes", "nobody waiting") |

So: omit the key when you do not store it. Sending `0`/`""` for an untracked value makes the UI
print a zero or an empty quote as if it were a fact.

Fields the contract says most servers will not have, and how the UI behaves without them:

| field | if absent |
| --- | --- |
| `item.condition`, `item.description` | the detail sheet has no Condition/Description rows (mock-only text is gated behind `USE_MOCK`) |
| `item.createdAt` | no "· 2 days ago" line anywhere |
| `item.active` (and `item.available`) | the row says nothing about being taken or hidden — the chip is drawn only from `=== false` |
| `tutor.active` | no Live/Paused chip and the row is not dimmed; the switch shows "unknown" instead of a position |
| `student.verified` … absent | see two rows down: no tick is drawn, and no "unverified" claim either |
| `item.waitlistCount`, `item.waitingNames` | no queue count on "my listings", no "N waiting", no "ahead of you" list |
| the `/api/items/mine` wrapper's `waiting` | "nobody waiting" for that listing; names never invented, and the viewer's place in their own queue is never displayed |
| `waitlist.position`, `...ahead` | "you are in the queue" without a place |
| `student.rating`, `ratingCount` | the stars row is replaced by *No ratings yet* — never `0.0 ★` |
| `ratingCount > 0` | the average is shown only when the count explains it |
| `student.verified` | the verified tick is not drawn (`BadgeCheck` requires `=== true`) |
| `otherContact` / `contact` | no email block, no copy button, no `mailto:` |
| `circle.waitingCount`, `yesCount` | the card says "waiting on an answer" without numbers |
| `request.canRate`, `canRespond` | the button is not offered at all |

`A.knownOr(value, fallback)` is the one helper for this; it never turns `null` into a string.

## 4 · Behaviour the server owns (the UI assumes it, does not enforce it)

1. **A request row is answerable once.** A second answer — or a `POST /api/requests/cancel` after
   the receiver already replied, or a decline of a row that was withdrawn — → `409` +
   `'That request was answered already'`. Only the sender may cancel, and only the receiver may
   accept or decline.
2. **A hand-off is one-way.** Handing over an already-given item → `409` naming who received it
   (e.g. `'This item was already handed over to Neha'`); the UI then re-reads the listing.
3. **Contact details appear only after both sides accept** — and, for a circle, after *every* member
   says yes. `waiting` is not `no`: an unanswered member is counted, never refused.
4. **One rating per person per exchange**, only for an accepted exchange. Out-of-range stars are
   refused before saving; the new `rating`/`ratingCount` come back on the response.
5. **A listing body may not carry unknown fields.** `condition`, `description` and `photo` are
   rejected with `400 unknown field <name>` — the UI does not send them in real mode.
6. **`freeTime` is validated on the server too**: `Day HH:MM-HH:MM`, comma-joined, ≤ 8 windows.
7. **Free items have no price and no `request` path** except the waitlist (`/api/items/request` with
   no `offer` is a queue join).
8. **`q` search is the server's fuzzy match**; the UI shows what comes back, including nothing.

## 5 · What changed in the frontend

- `src/api/` split into `env.js` (flags), `client.js` (fetch, errors, token, 401 handling),
  `adapters.js` (the whole server dialect), `logic.js` (slot parsing, common free time, OTP
  cooldown), `seed.js`, `index.js` — every method now has a real-mode branch to the routes above.
- New screens/flows: email **verification** (`src/screens/auth/Verify.jsx`, routed from register and
  from a wrong-verification `403`), **circles** answering/cancel inside Activity, **ratings** on
  accepted exchanges, **availability** editor on the profile, "find common time" on meet rows.
- Screens stopped inventing content: mock-only copy is gated on `USE_MOCK`, missing owners/dates are
  guarded, and `verified`/rating affordances only render from real values.
- `useOnActive` + `usePolling` (`src/lib/hooks.js`): an open live screen re-reads the same endpoints
  on a timer and when the tab is revealed; `useAsync` keeps the previous data during those refreshes,
  so a poll or a failed background refresh never blanks or errors the visible list.
- `public/sw.js` rewritten as cache `studentsetu-v2`: purges v1 on activate, never intercepts `POST`,
  any request carrying `Authorization`/`credentials: include`, or any `/api` path; statics are
  network-first; the offline page is navigation-only.
- Tooling: `scripts/run.mjs` (loader launcher, tells you to upgrade Node instead of stack-tracing),
  `.env.example`, `test:contract` / `test:sw` / `test:live` suites, `scripts/fake-cpp-server.mjs`.
- The Express/Node backend that used to live beside this app is **gone**; this repository is frontend
  plus its tests. The C++ server is a separate codebase implementing §1–§4.
- Corrections applied on the client side (no design or layout change, and no route invented):
  withdrawal moved to `POST /api/requests/cancel` with `{ id }` and its own `cancelled` status in the
  demo data too; one `A.flag()` normaliser behind availability, teaching activity and verification;
  `GET /api/items/mine` read as wrapper rows, so the queue names come from `waiting` and nobody's
  place in the queue is fabricated; a `401` on a protected route now clears the signed-in person,
  their cached reads and the screen stack and lands on the sign-in form (a wrong password still stays
  on the form, because `/api/login` is exempt from that path); and a request's contact email is
  attached to the other participant rather than defaulting to whoever `to` names.

## 6 · How much of this is actually been executed

| suite | what it talks to |
| --- | --- |
| `test:mock` (164), `test:ui` (87) | the mock database — proves the app's own rules, and that the demo path issues no request (a fetch spy records nothing while 18 reads and writes succeed) |
| `test:contract` (100) | **a stubbed `fetch`** that replays §1–§4: real `src/api` code, invented server |
| `test:session` (25) | the real-mode client and the actual screens in jsdom, over **a stub transport** — 401 handling, token removal, which screen is left mounted |
| `test:sw` (19) | the service-worker source in a `vm` sandbox with fake `caches`/`fetch` |
| `test:live` (46) | a real HTTP socket — but to `scripts/fake-cpp-server.mjs`, this repository's fixture |

Every number above is a run against fixtures or stubs. `scripts/fake-cpp-server.mjs` is this repo's
own file, written to the same §1–§4 reading of the contract, so `test:live` passing means the
frontend keeps its side of the arrangement — it is not evidence that the C++ server agrees. Where the
contract is genuinely unknown (a field name the sample replies never showed), the adapter reads the
documented name first and one older spelling second, and that fallback is noted above rather than
presented as the server's wording.

A production build with `VITE_USE_MOCK=false` contains no reachable demo path (no `/api/demo` in the
bundle; `demoLogin()`, `resetDemo()` and `setFailureMode()` reject, which `test:contract` asserts with
a zero-fetch counter) — but the dead mock strings are still in the bundle, because both data sources
live in one module. See DEPLOY.md §4.

**No test has run against the real C++ server** — it does not exist in this environment. Until
`SETU_API_URL=https://the-real-api npm run test:live` passes on your machine, §1–§4 is a promise the
frontend keeps and the backend has not yet been measured against.
