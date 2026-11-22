# StudentSetu — Combined Project Test Report

**Date:** 1 November 2026  
**Project:** Official StudentSetu PBL (original Phase 2 C/C++ + Phase 3 React/C++/SQLite)  
**Command:** `bash tests/test_full_project.sh` from the combined project root  
**Outcome:** PASS — complete test runner returned exit code 0.

## Automated results

| Test area | Result |
| --- | --- |
| Original C matching and DFS | PASS, zero failures |
| Original C++ matcher | PASS, zero failures |
| Original C++ application models/classes | PASS, zero failures |
| Original C hash table and queue | PASS, zero failures |
| Original C++ storage, search, waitlists, requests | PASS, zero failures |
| Original interactive Phase 2 CLI starts and exits | PASS |
| Backend registration, college email, OTP, login, permissions | PASS |
| Original graph matching through real HTTP API | PASS |
| Marketplace search, ownership, tutor listings | PASS |
| Exchange lifecycle, dual completion, ratings, FIFO handoff | PASS |
| Tutor booking, confirmation, offline payment, cancellation | PASS |
| SQLite records survive backend restart | PASS |
| React production build | PASS |
| Frontend mock API tests | 164 passed, 0 failed |
| Frontend real-mode API contract tests | 106 passed, 0 failed |
| Frontend service-worker tests | 19 passed, 0 failed |
| React UI and accessibility checks | 87 passed, 0 failed |
| React session / invalid-token flows | 25 passed, 0 failed |
| Live React UI against real C++ server | 72 passed, 0 failed, 1 optional check skipped |

**Total frontend assertions:** 473 passed, 0 failed, 1 skipped.

## How the modules were integrated

The backend is compiled with the original Phase 2 C modules (`matching/text.c`,
`matching/graph.c`, `matching/sort.c`, `services/hashtable.c`,
`services/queue.c`). Matching is called through `/api/barter` instead of being
reimplemented in JavaScript. The React API layer calls the same live C++ HTTP
service that writes records to SQLite. The live frontend suite uses real
registered students, listings, swap requests, approvals, and status changes.

The restart test creates a verified account and real item/tutor listings,
stops the backend, starts it again with the same database, signs back in,
and checks the records remain available.

## Notes and limitations

1. **Phase 1:** No independently identifiable Phase 1 source code was supplied.
   Design/report material is not executable code, so it was not code-tested.
2. **Official rubric:** The official Phase 3 college rubric has not yet been
   supplied; this result verifies the agreed scope, not unknown rubric points.
3. **Email delivery:** Local college-email verification uses `SETU_DEV_OTP=1`.
   Production OTP email delivery is not configured. Do not expose this setting
   on a public host.
4. **Payments:** Pending, paid, and cancelled are **offline tracking states**;
   no real payment gateway or financial transaction is implemented.
5. **Deployment:** Public HTTPS hosting, production email delivery, and
   operational security require configuration and were not acceptance-tested.
6. **Skipped check:** The live suite skipped the optional `/api/meet` check
   because the isolated test accounts did not have an eligible exchange partner.
   It did not report a failed route.
7. **Test harness:** React issued development-only `act(...)` warnings while
   the live contract test exercised asynchronous screens; the checks still
   completed with zero failures. A manual multi-device browser demonstration
   and performance/security audit remain sensible before public hosting.

## Re-run during evaluation prep

```bash
bash tests/test_full_project.sh
```

The project tests require Linux or WSL with GCC, G++, OpenSSL development
headers, Node.js, npm, curl, and jq. Install frontend dependencies first with
`cd frontend && npm ci`, then return to the root and run the command above.

**Conclusion:** The integrated local PBL application passed its complete
available automated regression matrix. This does not certify production
deployment or guarantee coverage of every possible user action.
