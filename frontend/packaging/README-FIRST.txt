StudentSetu — static build (drop this folder on any static host)

What this is
  A production bundle of the React app built in its DEFAULT mode: the in-memory
  demo campus. It needs no server and talks to nothing outside the browser tab,
  which is why "Try demo as Gunmay" (gunmay@geu.ac.in / 123456) works here.

What it is not
  A deployment against your C++ API. This build makes no /api call at all, and a
  real-mode build has no demo fallback either way — they are two different builds.

To build the real-app version
  npm ci

  # same-origin layout: nginx/Caddy serves dist/ and proxies /api to the API
  VITE_USE_MOCK=false VITE_API_SAME_ORIGIN=1 npm run build

  # or an explicit API origin, once the C++ server is hosted
  VITE_USE_MOCK=false VITE_API_BASE=https://YOUR-API-HOST npm run build
  # (replace the address — "YOUR-API-HOST" is a placeholder, and the build
  #  refuses to ship it, instead of deploying an app that errors on every screen)

  # Windows PowerShell
  $env:VITE_USE_MOCK="false"; $env:VITE_API_BASE="https://YOUR-API-HOST"; npm run build

  The C++ server answers CORS itself (Allow-Origin: *, Content-Type and
  Authorization allowed, OPTIONS -> 204) and the app sends no cookies, so there is
  nothing else to configure on the API side. Only GET and POST are used.
  Details: DEPLOY.md. The wire contract: CHANGES.md.

Files
  index.html            the shell; asset names are content-hashed
  assets/               JS + CSS — cache these forever
  sw.js                 offline shell cache (studentsetu-v2). Serve it with
                        Cache-Control: no-cache, or an update takes an extra visit.
  manifest.webmanifest  PWA manifest
  icon.svg              app icon
  _redirects            Optional SPA fallback (/* -> /index.html 200) for hosts that
                        want one, kept for convenience. This app has
                        no URL routes, so it is optional; delete it if your host
                        uses its own config.

Check it locally
  python3 -m http.server 4173     # then open http://localhost:4173
  # (8080 is the port the C++ server uses locally, so keep them apart)
