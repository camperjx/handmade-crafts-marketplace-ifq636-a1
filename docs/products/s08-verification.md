# S08 Product verification

Date: 6 November 2026, Australia/Brisbane. Baseline: S07 main `e45f7349d32028d07e3d705a4cf0c37b96f70dab`. These are technical execution records rather than a student reflection or user-research report.

| Layer | Recorded result | Boundary |
| --- | --- | --- |
| Backend regression | 150 passing | Includes the existing 40 S07 cases plus Product HTTP contracts, input/document boundaries and DTO checks. DB operations are stubbed in the isolated HTTP layer. |
| Real MongoDB integration | 22 passing | Dedicated `hm_s08_test`; real registration/login, Product persistence/visibility, Buyer/cross-owner rejection, competing archive and DB reconnect. |
| Actual HTTP process verification | 9 passing | Separate backend processes, real HTTP and MongoDB, three temporary identities, saved update/archive, Node process replacement and login/read after restart. |
| Postman export | 38 requests in four folders | Collection and blank environment prepared for manual use. No Postman GUI run or screenshots are claimed. |

The runtime report records the before/after process IDs and confirms saved Product price/status after a genuine process restart. Fixture cleanup is scoped to the run's generated email identities and their Product IDs/owners. No database is dropped or globally cleared.

## Reproduce

Use Node 22 and the locked dependencies from the repository root:

```sh
npm test --prefix backend
npm run test:products:integration --prefix backend
RUN_PRODUCT_DB_TESTS=1 node backend/scripts/verify-s08-runtime.cjs
```

The two real-DB commands require ignored `backend/.env.s08-test.local` containing `PRODUCT_TEST_MONGO_URI` for the dedicated `hm_s08_test` database. The suite verifies that name before writing and uses a random test JWT secret. The runtime script starts only its own temporary backend process/port, restarts it and stops it afterwards. It saves sanitised evidence under ignored `artifacts/s08` unless `S08_ARTIFACT_DIR` specifies another location.

Original execution evidence is retained in the course workspace under `work/result/a1-s8/evidence/`: backend-regression.txt, product-db-integration.txt, runtime-verification.txt and runtime-results.json. These logs belong to the executed versions; later changes require appropriate revalidation. Tokens, passwords and database URIs are not stored in those evidence files.

## Requirement boundaries

- HM-21/22/26/31/32: Product model/input rules, creation/public reads, Seller filtering and owner-only update/archive are implemented.
- HM-15 AC4: actual Product POST/PATCH reject a Buyer with 403; real database assertions verify no Product creation or target-record modification.
- HM-20/25/30: backend portions are delivered; forms, UI feedback and complete browser WF1 remain S09–S10.
- HM-24/29/34: backend verification/review evidence is available; this does not establish full UI/workflow acceptance.
- Orders, archived-product order rejection, payments, inventory and EC2 deployment are outside this increment.
- Jira online changes and manual Postman evidence must be recorded separately from the automated results here.

## Review

[PR #4](https://github.com/camperjx/handmade-crafts-marketplace-ifq636-a1/pull/4) review identified a test-evidence limitation: counting only Seller A products would miss an accidental Buyer-owned insertion. The integration and runtime assertions now compare the whole Product collection count while retaining full target-record equality. Runtime evidence additionally records the tested commit, clean-worktree status, Node version and explicit before/after counts. No production permission failure was observed or fabricated for this review.

The final commit/tree and rerun results are recorded in the S08 execution report. Scope and evidence limitations are retained rather than treating a successful build or test stub as deployment or persistence proof.
