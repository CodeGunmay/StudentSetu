# Deploying StudentSetu

Two moving parts: a **static bundle** (`dist/`) and the **C++ API** that serves `/api/*`. The
frontend contains no server code and no demo fallback in production — if the API is unreachable the
app says so and offers a retry.

---

## 1 · Build

```bash
npm ci
npm run build          # → dist/  (index.html, assets with hashed names, sw.js, icons)
```

Build-time variables (they are compiled into the bundle — see `.env.example`):

| variable | production value | what it does |
| --- | --- | --- |
| `VITE_USE_MOCK` | `false` **required** for a real deploy | turns the in-memory demo database off, and removes every demo affordance. `netlify.toml` pins it to `true` for now, because the C++ server has no origin yet — see §3 |
| `VITE_API_BASE` | `https://YOUR-API-HOST` → **replace it** | where `/api` calls go. The C++ server is not hosted yet, so there is no real value to put here; a placeholder (or an empty value on Netlify) fails the build |
| `VITE_DEMO_HINTS` | `false` (pinned in `netlify.toml`) | when `true`, the register/verify screens may show the dev OTP. `VITE_SHOW_DEV_OTP` is the same switch under the API team's name — either name works, so `netlify.toml` pins both |
| `VITE_API_SAME_ORIGIN` | `1` only for the nginx layout in §2 | says "an empty `VITE_API_BASE` is deliberate: dist/ is served by the host that proxies `/api`" |
| `VITE_POLL_MS` | e.g. `20000` | how often an open live screen re-reads the server (`0` disables) |
| `VITE_TOKEN_KEY` | default `setu.token` | the only localStorage key the app writes |

```bash
# Linux/macOS — same-origin layout (§2): the empty base is deliberate, so say so
VITE_USE_MOCK=false VITE_API_SAME_ORIGIN=1 npm run build

# …or with an explicit API origin, once the C++ server has one
VITE_USE_MOCK=false VITE_API_BASE=https://api.your-campus.test npm run build
```

```powershell
# Windows PowerShell
$env:VITE_USE_MOCK = "false"; $env:VITE_API_SAME_ORIGIN = "1"; npm run build
$env:VITE_USE_MOCK = "false"; $env:VITE_API_BASE = "https://api.your-campus.test"; npm run build
```

For local development the server is `http://localhost:8080` (its own `PORT`
variable decides; 8080 by default), and `VITE_API_BASE` in `.env.local` should keep
that value — the dev server on :5173 calls it directly because the server handles
CORS itself. A *built* bundle pointing at localhost is only ever a local preview:
`vite build` warns about it, and Netlify refuses.

### The build guard, and why it is there

`vite.config.js` checks the environment before a production build is written:

| you asked for | result |
| --- | --- |
| `VITE_USE_MOCK=false`, `VITE_API_BASE` still `https://YOUR-API-HOST` | **build fails** — "put the https address of the hosted C++ server in netlify.toml, then rebuild" |
| `VITE_USE_MOCK=false`, `VITE_API_BASE` empty, not same-origin opt-in | **build fails** — on Netlify especially, because an empty base means "call Netlify", which is not your API |
| `VITE_USE_MOCK=false`, `VITE_API_BASE=http://localhost:…` on Netlify | **build fails**; off Netlify it is a warning, for a local `npm run preview` |
| `VITE_USE_MOCK=false` + `VITE_API_SAME_ORIGIN=1` (not on Netlify) | builds; §2's proxy is then responsible for `/api` |
| `VITE_USE_MOCK` unset (the demo build) | builds, and calls nothing |
| `VITE_USE_MOCK=true` **with** a placeholder base, on Netlify (what `netlify.toml` ships) | builds — the address is compiled in and never reached, because mock mode answers before the client is touched |

So the deploy that "succeeds" is the one where somebody put a real address in
`netlify.toml`. Nothing else in this repo invents an API origin for you.

Three hard rules the client and the build enforce, so a wrong setup fails loudly instead of silently:

- **A page served over `https` may not call an `http://` API.** The app refuses and shows an
  explanation (browsers block that mix). Use `https` for the API, or leave `VITE_API_BASE` empty and
  proxy `/api` on the same origin.
- The client **never sends cookies**: no `credentials` option on any `fetch`, only an
  `Authorization: Bearer <token>` header. That is what lets the API answer with a plain
  `Access-Control-Allow-Origin: *` — do not add `credentials: 'include'` anywhere, the
  wildcard and credentialed CORS are mutually exclusive.
- An empty result is never filled with demo data. `resetDemo()`, `demoLogin()` and
  `setFailureMode()` reject in real mode; nothing here has a mock left to fall through to.

## 2 · Same origin (recommended)

Serve `dist/` and proxy `/api` to the C++ process. Then `VITE_API_BASE` stays empty, there is no
CORS to configure, and no mixed-content trap.

```nginx
server {
  listen 443 ssl http2;
  server_name studentsetu.your-campus.test;

  root /var/www/studentsetu/dist;
  index index.html;

  # the app owns the URL space: every path is the shell
  location / { try_files $uri $uri/ /index.html; }

  # a stale sw.js is a stale app; hashed assets are the opposite
  location = /sw.js       { add_header Cache-Control "no-cache"; }
  location = /index.html  { add_header Cache-Control "no-cache"; }
  location /assets/       { add_header Cache-Control "public, max-age=31536000, immutable"; }

  location /api/ {
    proxy_pass http://127.0.0.1:8080;   # the C++ server, whose PORT default is 8080
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Content-Type $content_type;
  }
}
```

Caddy does the same in four lines:

```caddyfile
studentsetu.your-campus.test {
  root * /var/www/studentsetu/dist
  try_files {path} /index.html
  handle_path /api/* { reverse_proxy 127.0.0.1:8080 }
}
```

Run the API under systemd so it comes back after a reboot:

```ini
# /etc/systemd/system/studentsetu-api.service
[Unit]
Description=StudentSetu C++ API
After=network.target

[Service]
ExecStart=/usr/local/bin/studentsetu_api --port 8080 --host 127.0.0.1
Restart=always
User=studentsetu

[Install]
WantedBy=multi-user.target
```

Keep the API on `127.0.0.1` and let nginx/Caddy terminate TLS. `npm run preview`
(`http://localhost:4173`) is a local smoke check of the built bundle, not a deployment server.

## 3 · Netlify (or any static host) with the API elsewhere

Netlify builds and hosts the bundle; it cannot reach your laptop, so the API must be a **public
`https` origin**. The C++ server is not hosted yet, so the committed file deploys the **demo** instead
and keeps the address below as a marked placeholder. What you get from that deploy is the real UI over
in-memory data: nobody's swaps are shared, nothing survives a reload, and every demo affordance is
present — fine for a review link, not a product for students.

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  VITE_USE_MOCK = "true"                   # ← "false" only together with a real address below
  VITE_API_BASE = "https://YOUR-API-HOST"  # ← replace with the hosted server's https address
  VITE_DEMO_HINTS = "false"
  VITE_SHOW_DEV_OTP = "false"
```

To put the real app on Netlify: host the server, replace `YOUR-API-HOST`, set `VITE_USE_MOCK =
"false"`, rebuild. Half of that is the same as all of it as far as the guard is concerned — a
real-mode build on a placeholder or an empty base **fails** rather than shipping an app that errors on
every screen (§1). Both hint flags stay `false` either way: they are mock-and-dev-only switches, and
pinning them keeps a demo build from printing a dev OTP on a public URL.

**CORS needs nothing from you.** The server already sends, on every response including the
`OPTIONS` preflight (answered `204`):

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Methods: GET, POST, OPTIONS
```

Because it is `*` and the client sends no cookies, deploy previews and any branch URL work without
touching the API — do not narrow `Allow-Origin` to one host, and do not add `credentials`. Only
`GET` and `POST` are used; nothing in this app sends `PUT`, `PATCH` or `DELETE`.

Two notes that still catch people: a self-signed certificate on the API means the browser refuses the
fetch and the app reports the server as unreachable (use a real TLS cert, or put the API behind the
same host as §2); and redirects are not needed for this app — it has no URL routes, so `/* → /index.html`
only matters if you add deep links later. `netlify.toml` already pins `/sw.js` to
`max-age=0, must-revalidate`.

## 4 · Check a deployment

```bash
# which mode was baked in?
grep -o 'VITE_USE_MOCK:"[^"]*"' dist/assets/*.js
#   "false" → this bundle talks to an API, so the two greps below must come back empty
#   "true"  → the Netlify demo build of §3 (the flag was pinned explicitly)
#   nothing → a plain `npm run build`, which is mock by default because the variable is absent

# a real-mode bundle must name no placeholder and no laptop origin:
grep -c 'YOUR-API-HOST\|localhost:8080' dist/assets/*.js   # → 0
grep -c "/api/demo" dist/assets/*.js                       # → 0 (demoLogin/resetDemo reject in real mode)

# a *demo* bundle may still contain the base URL it was built with — it is compiled
# in and never used, because every method answers from local data before the client
# is reached. `npm run test:mock` measures exactly that: a fetch spy records nothing
# while 18 reads and writes succeed.

curl -s -o /dev/null -w '%{http_code}\n' https://your-site.test/                 # 200
curl -s -o /dev/null -w '%{http_code}\n' https://your-site.test/some/deep/route  # 200 (SPA fallback)
curl -s -I https://YOUR-API-HOST/api/items | head -5                       # 401 + Access-Control-Allow-Origin: *

# the real end-to-end gate, against what you just deployed
SETU_API_URL=https://api.your-campus.test SETU_EMAIL=you@geu.ac.in SETU_PASSWORD=… npm run test:live
```

In the browser: open DevTools → Network and confirm no request goes to `/api` with a mock delay,
that a hard reload re-uses the cached shell (`sw.js` → *Cache* tab → *Clear site data* to force a
fresh install), and that **Offline** in the Network tab still opens the app but every API call fails
with the honest message rather than demo content.

Rollback is a re-copy of the previous `dist/` — file names are content-hashed, so a stale
service worker keeps serving the old shell until `sw.js` itself changes. Ship `sw.js` with
`Cache-Control: no-cache` (step 2) and bump `CACHE` in `public/sw.js` when the app shell contract
changes.

### Known: the mock code is still inside the bundle

`src/api/index.js` holds both data sources in one module, so a production build keeps the mock's
unreachable strings (the demo email, the seed names, the demo buttons) — `grep "Try demo"` will find
them. They cannot run: `USE_MOCK` is `false` at runtime, every demo method rejects, and no demo route
exists in the bundle. If that bothers you, the fix is to split `src/api/mock/` behind a dynamic
`import()` so Rollup can drop the whole branch — that is a refactor, not a config flag, and it is not
done here.

## 5 · What not to do

- Do not add a `/version` or `/health` route for the frontend's benefit — nothing calls it, and the
  app deliberately treats "no answer" as the answer.
- Do not let the API return `0` or `""` for a number it does not track. `null` means "not
  tracked", and the UI hides the field; `0` means "zero" and the UI prints it. (CHANGES.md has the
  per-field table.)
- Do not cache `/api` responses in the service worker, and do not put `Authorization` on a
  cross-origin `GET` for static assets.
- Do not set `credentials` (or any cookie-based session) on `/api` calls, and do not replace
  `Access-Control-Allow-Origin: *` with an allowlist while the client sends no cookies — the
  wildcard is the arrangement the C++ server already implements.
- Do not put `http://localhost:8080` in a deployed build. It is the local development value in
  `.env.example`, and `vite build` will refuse or warn rather than ship it.
- Do not ship demo data or the dev OTP: `VITE_DEMO_HINTS` stays unset in production builds.
