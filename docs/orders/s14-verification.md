# S12-S14 verification

Date: 10 November 2026, Australia/Brisbane. Scope: local WF1/WF2, dedicated test databases and real production serving. University EC2 remains the S11 trial.

Final regression at clean commit `9892866c56ab8fcd16625be809de0d60d06907b4` passed **202 backend tests**, **97 frontend tests in 10 suites**, **10 real Order integration cases**, **22 existing Product integration cases**, **27 production HTTP checks**, and **39 Postman requests / 58 assertions** through Newman. The strengthened Chrome verifier at clean commit `a31b207f0d59f785ddb9c5bb5eaeb62002f24fc1` passed **18 scenarios**. The only source difference is that browser verifier; application runtime and build are unchanged. These are separate runs, not one cumulative test count.

See [verification summary](evidence/verification-summary.json), [Order integration](evidence/order-integration-results.json), [Chrome](evidence/browser-results.json), [production HTTP](evidence/routing-results.json) and [Newman](evidence/newman-results.json). The final documentation/evidence commit adds records only and must be distinguished from the tested commits.

Actual Chrome evidence includes [completed request](evidence/buyer-completed.png), [stale-state reconciliation](evidence/conflict-reloaded.png) and [uncertain creation](evidence/uncertain-create.png). Node PID 31895 was replaced by 31936; both Product and Order values were unchanged. All scoped fixtures were removed, with zero remaining.

## Reproduction

Use Node 22 and the existing backend/frontend lockfiles. The private Order test configuration is described in README. From the repository root:

```sh
npm test --prefix backend
npm run test:products:integration --prefix backend
npm run test:orders:integration --prefix backend
CI=true npm test --prefix frontend -- --watchAll=false --runInBand
npm run build --prefix frontend
RUN_ORDER_DB_TESTS=1 node backend/scripts/verify-s14-routing.cjs
RUN_ORDER_DB_TESTS=1 node backend/scripts/verify-s14-browser.cjs
RUN_ORDER_DB_TESTS=1 node backend/scripts/verify-s14-postman.cjs
```

The browser runner requires a separately installed Playwright module (`PLAYWRIGHT_MODULE`) and Chrome (`CHROME_PATH`, defaults to the macOS installed application). Newman similarly accepts `NEWMAN_MODULE`. These optional test tools are not runtime dependencies. All three verifiers accept `S14_ARTIFACT_DIR`, resolved against the repository root; default outputs are ignored under artifacts/. They use ports 5005, 5004 and 5006 respectively and never stop a pre-existing listener.

## Evidence boundaries

Unit HTTP cases use isolated model stubs. Integration cases use `hm_s12_s14_test`; existing Product regression retains `hm_s08_test`. Chrome runs the actual production build, creates independent sessions, injects controlled failures after real writes, verifies a true Node process replacement and cleans temporary fixtures. Snapshot history and concurrency also have direct MongoDB checks. Newman summaries never include passwords, login responses, Authorization headers or runtime configuration.

The deleted-account integration check explicitly requires a successful login and a confirmed deletion before testing the old credential. A preparatory version lacked those preconditions; only the corrected run establishes that case.

Postman Desktop activation timed out and its process was unavailable; no Desktop screenshot or native collection run is claimed. Jira live changes, native Figma/Draw.io edits, formal S15 review and EC2 deployment of this increment remain separate work. Relevant private planning/evidence material lives in the sibling coursework result directory, outside this repository.
