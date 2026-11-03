# S07 verification record

Date: 2026-11-04, Australia/Brisbane. Executed by Codex with the user's explicit authorization to implement S07 and use Git. Automated execution is identified below; no Postman GUI session, student manual walkthrough or external participant feedback is claimed.

| Layer | Actual result before PR review fix | Scope |
| --- | --- | --- |
| Backend isolated HTTP tests | 40 passed | Actual Express routes/protect/authorize; controlled DB stubs. |
| Real MongoDB integration | 13 passed | Registration/hash/roles, duplicate/concurrent email, profile persistence, database-client reconnect, deleted account, missing persisted role. |
| Frontend Jest | 15 passed | Actual Axios interceptors/session controller, revisions/cleanup, failures and return paths; no network. |
| Real Chrome | 13 passed | Separate Buyer/Seller contexts, real app/API/development DB; explicit injected network failure and delayed profile cases. |
| Production frontend build | Passed | Existing CRA5/React18; no deployment implied. |
| Fixture cleanup | Confirmed | UUID-namespaced test accounts removed by exact generated email lists; no existing accounts migrated or removed. |

A default-sandbox run could not bind temporary HTTP sockets (EPERM). The backend tests passed when executed with local-socket access. Initial CRA HOST=127.0.0.1 caused invalid allowedHosts; using the normal HOST=0.0.0.0 development binding started the independent verifier on3001, preserving the user's existing3000 process. Backend runs5001.

The old frontend boilerplate test imported undeclared Testing Library packages. It now checks actual S07 behavior with the existing Jest toolchain. Axios1's CJS build is mapped for CRA's Jest resolver. The existing Babel placeholder package emitted a delayed warning/open-handle notice; declaring the actual preset dependency7.21.11 removed it. These are limited compatibility repairs, not a React/CRA upgrade. The existing Browserslist age warning remains.

## Reproduce

Use Node22 from .nvmrc and the development runtime env (never commit actual env values):

```sh
npm test --prefix backend
npm run test:integration --prefix backend
CI=true npm test --prefix frontend -- --watchAll=false --runInBand
npm run build --prefix frontend
```

The integration command explicitly opts in to writing UUID-namespaced accounts to the configured development DB and deletes only its own generated email list afterwards. Read the test before running against any other DB.

Browser verification uses optional Playwright installed separately, without adding it to app dependencies; Chrome must be available. Start backend5001 and frontend3001 first. In a local installation, set S07_PLAYWRIGHT_MODULE to the installed Playwright package directory and optionally S07_ARTIFACT_DIR, then run:

```sh
node frontend/scripts/verify-s07.cjs
```

Artifacts are actual screenshots and browser-results.json; no HAR, passwords, JWTs or personal browser profile are saved. The course-work run stores them outside this repository under work/result/a1-s7/evidence. These are automation screenshots, not screenshots of a human using Postman.

## PR review and actual improvement

PR: https://github.com/camperjx/handmade-crafts-marketplace-ifq636-a1/pull/3 . Automated self-review comment: review5753887357, anchored to2985d581210ac8e865f46c15327022648884e82c.

Source review found that an authenticated account losing its persisted role returned403 ACCOUNT_ROLE_UNAVAILABLE but retained the authenticated UI. A new regression was executed before the fix and failed: expected anonymous, received authenticated. The response interceptor now clears only the current revision for401 or403 ACCOUNT_ROLE_UNAVAILABLE. Ordinary403 FORBIDDEN and stale responses preserve the valid session.

After the fix: **16 frontend tests passed**, production build passed, and **14 real Chrome cases passed**. UI14 removed the role only from this run's dedicated Seller fixture, navigated within the SPA to Profile and verified logout/token removal. The fixture was then deleted. The delayed-profile case explicitly waits for the held request to complete/cancel. Backend remains40 isolated +13 real DB cases, with no backend logic changed by this review fix.

The inherited README also contained committed conflict markers and obsolete assessment text. It was replaced with actual S07 setup/verification and scope notes, retaining the starter source link and Git history.

## Remaining assignment boundaries

- HM-15 AC4 still needs a real Seller-only Product write endpoint in S08 and proof that Buyer writes receive403 without changing data.
- Product pages are route shells; no Product/Order CRUD or owner authorization is claimed.
- S06 prototype/share verification, Jira online status updates, EC2 deployment, formal report and final video are not completed by S07.
- Auth extends the supplied course starter and was generated/implemented with Codex assistance. Keep the course GenAI disclosure accurate.
