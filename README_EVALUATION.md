# StudentSetu — Phase 3 PBL evaluation

This is the **complete combined** StudentSetu project: the original Phase 2
C/C++ source plus the Phase 3 React frontend, persistent C++ HTTP API, SQLite
database schema, and regression tests. **Team Up is not included.**

## Open for a local demonstration (Linux or WSL)

1. Extract this ZIP and open a terminal inside its `StudentSetu` folder.
2. Install GCC/G++, OpenSSL development headers, Node.js, npm, curl, and jq.
3. Run `bash backend/build.sh`.
4. Run `SETU_DEV_OTP=1 ./build/studentsetu-api` in terminal one.
5. Run `cd frontend && npm ci && VITE_USE_MOCK=false VITE_API_BASE=http://localhost:8080 npm run dev` in terminal two.
6. Open the local URL Vite prints. Register and verify using the **local-only** OTP returned by the server.

Use separate browser profiles for two student accounts to show requests,
confirmations, tutoring bookings, and offline payment status.

## Demonstration sequence

- Register and verify two accounts, then sign in.
- Post, search, and request an item. Accept and confirm completion from both accounts.
- Rate the completed exchange; demonstrate pending FIFO for a free item.
- Search skills and show direct and graph-based exchange matches.
- Publish a paid tutoring listing; another student chooses a date/time and requests a booking.
- Tutor confirms; mark offline payment as paid, or cancel a second booking.
- Restart the backend and confirm records remain in `studentsetu.db`.

## What is and is not finished

The local end-to-end system and automated backend/UI checks are working.
There is **no real payment gateway** and no Team Up module. Production email
delivery, HTTPS infrastructure, and deployment security are not configured;
never expose the `SETU_DEV_OTP=1` server publicly. Public deployment is a
future configuration step, not an already-verified deliverable.

The college's final Phase 3 rubric was not provided during implementation;
cross-check this package with that official rubric before submission.
No separately identifiable Phase 1 source tree was present in the supplied
repository, so Phase 1 documents/designs cannot be claimed as code-tested.
See `backend/README.md` and `frontend/README.md` for module details.

## All-in-one regression command

After installing the local dependencies, run `bash tests/test_full_project.sh`
from the project root. This runs the original Phase 2 C/C++ tests, backend
integration and SQLite persistence, React build/UI/API/session tests, and the
React-to-C++ live contract. The original CLI is also compiled and smoke-tested.
See `PHASE3_FULL_TEST_REPORT.md` for the detailed results and limitations.

## Members and repository integration

- Gunmay: Phase 2 graph/matching continuation, matching API, exchange circles, matching UI and checks.
- Ishwar: Phase 2 C++ application continuation, authentication, API integration, React shell and UI checks.
- Gaurav: Phase 2 queues/search/storage continuation, SQLite, marketplace, request lifecycle, offline tutoring bookings and checks.

The member packages represent **proposed code ownership and review/push
responsibilities**, not a claim about who originally authored generated code.
Each member should review, test, and commit their own assigned changes through
their own GitHub account. Commit percentages are not fabricated or guaranteed.
No GitHub pushes were performed by this packaging process.
