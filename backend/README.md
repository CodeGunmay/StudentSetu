# StudentSetu Phase 3 — C++ API

This API extends the original Phase 2 C/C++ project. Matching, DFS, sorting,
and waitlist modules stay in their original folders. SQLite saves students,
listings, exchanges, circles, bookings, confirmations, and ratings across restarts.

## Local college demonstration

On Linux, install GCC/G++, OpenSSL development headers, Node.js, and npm.
From the **repository root**, run:

```bash
bash backend/build.sh
SETU_DATABASE=studentsetu.db SETU_DEV_OTP=1 PORT=8080 ./build/studentsetu-api
```

In another terminal:

```bash
cd frontend
npm ci
VITE_USE_MOCK=false VITE_API_BASE=http://localhost:8080 npm run dev
```

Open the URL printed by Vite. Register with a `@geu.ac.in` address, verify
using the code returned by the local-only server, then sign in. Different
browser profiles can demonstrate the students' two-sided workflows.

**Safety:** `SETU_DEV_OTP=1` exposes verification codes. Use it **only on a
private local machine**; never expose that configuration publicly. Without
this switch, new registration deliberately refuses to proceed until an email
delivery provider is configured. Public hosting still needs a real email
provider, HTTPS for the backend, persistent storage, and production security
configuration. Do not claim production-ready authentication or deployment.

## Implemented features

- College-domain registration, password hashing, OTP, bearer sessions, profiles.
- Item listings, categories, search, barter/sale, and FIFO free-item handoff.
- Original Phase 2 algorithm-backed matching, direct swaps, exchange circles.
- Accept, decline, cancel, bilateral completion, and post-completion ratings.
- Tutor listings, priced session booking, confirmation, cancellations.
- Offline payment tracking: pending, paid, and cancelled. **No payment gateway.**

## Regression checks

```bash
bash tests/test_backend_auth.sh
bash tests/test_backend_matching.sh
bash tests/test_backend_marketplace.sh
bash tests/test_backend_requests.sh
bash tests/test_backend_bookings.sh
bash tests/test_frontend_live.sh
cd frontend
npm run build
npm run test:ui
npm run test:mock
npm run test:contract
```

The frontend defaults to standalone mock mode. Set `VITE_USE_MOCK=false` and
`VITE_API_BASE` to connect it to the real C++ service. The Phase 2 CLI remains
available separately. This work has not been pushed to GitHub automatically.
