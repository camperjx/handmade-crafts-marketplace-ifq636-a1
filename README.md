# Handmade Crafts Marketplace — IFQ636 Assignment 1

MERN application extending the course authentication starter. Buyer/Seller accounts support two local workflows: Product publication/read/update/archive, and persistent requests that a related Seller accepts, rejects or completes. The server derives identity/pricing, saves historical snapshots and guards state transitions. Requests do not take payment or reserve stock.

The merged application includes both workflows (PR #8, merge `250de31`). The last recorded university EC2 trial is `iteration1-demo-20261109-01` (`d2b46ab`) and contains WF1 only. Its recorded URL was http://3.26.221.223:5001/products; that address and availability have not been reverified for S16. The next release tag, cloud update and external acceptance remain pending.

## Local development

Use Node 22 (`.nvmrc`). S16 preparation uses macOS 26.5, Node 22.23.2 and npm 10.9.8; the university Ubuntu runtime must be checked separately before deployment. Install the two application projects from their lockfiles:

```sh
npm ci --prefix backend --include=dev
npm ci --prefix frontend --include=dev
```

Root dependencies are optional development orchestration tools. They are not required for single-process production hosting. For a new local setup, use the keys in `backend/.env.example` to prepare private `backend/.env`: MONGO_URI, JWT_SECRET, PORT (default 5001) and NODE_ENV. Keep an existing file and its values; do not overwrite it with the example. Restrict private files to mode 600 and keep actual values out of Git.

Run in two terminals from this repository root:

```sh
npm run dev --prefix backend
npm start --prefix frontend
```

The React development app normally opens at http://localhost:3000; it proxies `/api/...` to127.0.0.1:5001. Restart CRA after changing package proxy settings. If3000 is already in use, use:

```sh
PORT=3001 HOST=0.0.0.0 BROWSER=none npm start --prefix frontend
```

Open `/register`, choose Buyer or Seller, then sign in. Buyer goes to `/products`; Seller goes to `/seller/products`; both can use `/profile`. Sellers publish at `/seller/products/new` and edit owned active records at `/seller/products/:id/edit`. Public details use `/products/:id`. Enter prices in AUD, for example 25.00; the API stores 2500 integer cents. Archived products leave public reads but remain read-only in the owner's history. Existing DB users without a persisted valid role are rejected rather than silently migrated. This application uses `frontend/src`; the legacy root HTML marketing mockup is not the React app.

## Production hosting

React runs in the browser; Express handles authentication, Product/Order APIs and the built frontend; MongoDB Atlas persists the records. Controllers, middleware and models are logical layers in the same backend process. Production serves the build and API from one origin.

For the normal application database, configure private MONGO_URI and JWT_SECRET, then build and explicitly select production mode. The following local example uses port 5002 only if it is free:

```sh
npm ci --prefix frontend --include=dev
npm run build --prefix frontend
NODE_ENV=production PORT=5002 npm start --prefix backend
```

Use http://localhost:5002 for that normal-app preview. The isolated verification below instead uses 5004 and a dedicated test database; EC2 uses its separately approved port. No CRA process or development proxy is needed. Root `npm start` launches a development frontend through concurrently, so it is not the production entry point. Backend `npm run prod` also needs an explicit NODE_ENV; its script name alone does not select production mode.

The server loads `backend/.env` and `frontend/build` through absolute paths derived from its own directory. Existing process environment takes precedence over env-file values. Startup checks required settings, port and index.html, connects to MongoDB, and initializes User/Product/Order before listening. GET `/api/health` returns 200/ready only while the driver is connected, otherwise 503/unavailable; it does not prove that a complete workflow works.

Known frontend deep links, including `/products/:id/request`, `/orders`, `/seller/orders` and `/orders/:id`, serve the HTML shell. API authentication still protects private data. Unknown API paths return JSON 404; missing assets, unknown frontend paths and private server files remain unavailable. Production does not enable unrestricted CORS.

Use the [S16 production and release runbook](docs/deployment/s16-production-runbook.md) for configuration, build identity, preview, Ubuntu update and rollback. The [S11 record](docs/deployment/s11-runbook.md) is historical first-trial evidence. A local candidate archive is not a submitted release or proof of an EC2 update.

## Candidate and submitted release

S16 creates a build from a clean committed source and public `release.json` containing only stage, tag, candidateId, commit and UTC build time. Candidate stage is `s16-candidate` and tag is null. A candidate ID is a package identifier, not a Git ref.

The S16 execution record and each immutable candidate run are kept in the sibling coursework directory `../result/a1-s12-s14/a1-s16/`, outside this repository. They contain source-linked HTTP/browser results, served metadata, scoped cleanup and a static-only archive/checksum/manifest. The README and runbook are committed before the candidate is built; later source changes require a new build and validation.

The final submitted tag is **pending**. S17 must use the actual final main/tag SHA for both backend checkout and matching frontend build, then verify both workflows externally. If an S16 PR merge changes the commit identity, rebuild the final tagged version rather than relabelling an older candidate.

## Order requests

Buyer: open an active product and choose Request this item (`/products/:id/request`), then follow My requests (`/orders`). Seller: use Sales requests (`/seller/orders`) to open `/orders/:id`, accept/reject a pending request or complete an accepted one. Both roles read the same persisted status. Archived products cannot receive new requests; existing requests retain their original name and price.

Create requests contain only productId and numeric quantity 1–100. Seller updates contain status and expectedStatus. Both identity and safe-integer AUD prices/totals are derived by the backend. Related-account APIs and error contracts are documented in [Order API](docs/orders/s12-api.md) and [Order decisions](docs/orders/s12-decisions.md).

## Verification

```sh
npm test --prefix backend
npm run test:integration --prefix backend
npm run test:products:integration --prefix backend
CI=true npm test --prefix frontend -- --watchAll=false --runInBand
npm run build --prefix frontend
```

The original auth integration command opts in to UUID-namespaced temporary accounts in the configured development DB. The Product integration command instead requires ignored `backend/.env.s08-test.local` with `PRODUCT_TEST_MONGO_URI` pointing specifically to `hm_s08_test`; it cleans only its generated accounts/products. No real configuration values are committed. See [Product verification](docs/products/s08-verification.md) for the separate process-restart check and evidence boundaries. Browser automation is optional and requires a separately installed Playwright package and Chrome; see [auth verification](docs/auth/s07-verification.md).

See [authentication decisions](docs/auth/s07-auth-decisions.md), [Product backend decisions](docs/products/s08-decisions.md), [UI decisions](docs/products/s09-ui-decisions.md), [S09-S10 verification](docs/products/s09-s10-verification.md) and [S12-S14 verification](docs/orders/s14-verification.md). No server-side JWT revocation, payment, inventory reservation, server idempotency or general optimistic locking for active Product edits is claimed. Product read→Order creation is not serialised with overlapping Product edits/archive. A write timeout or HTTP 5xx may follow a committed write: the UI preserves the draft and offers read-back instead of automatically retrying.

Order tests require ignored `backend/.env.s12-s14-test.local`: ORDER_TEST_MONGO_URI must point specifically to `hm_s12_s14_test`; ORDER_TEST_JWT_SECRET must be a separate private test secret of at least 32 characters. The launcher and verifiers require explicit opt-in:

```sh
npm run test:orders:integration --prefix backend
npm run build --prefix frontend
RUN_ORDER_DB_TESTS=1 node backend/scripts/start-s12-test-server.cjs --production
```

The isolated preview is http://127.0.0.1:5004; use Ctrl+C to stop its child. It does not change backend/.env or the EC2 release. Stop the manual preview before running the browser verifier, which owns the same port. Routing uses 5005 and Newman uses 5006. The runners stop their own processes and clean only their scoped fixtures. Browser automation and Newman are separate optional tools, not application dependencies; see the verification record and runbook for module-path options.

For production routing and two-workflow verification on a newly built candidate:

```sh
RUN_ORDER_DB_TESTS=1 node backend/scripts/verify-s14-routing.cjs
RUN_ORDER_DB_TESTS=1 node backend/scripts/verify-s14-browser.cjs
```

The browser command needs separately installed Playwright and Chrome; set PLAYWRIGHT_MODULE and, if necessary, CHROME_PATH. S14's recorded 202 backend tests, 97 frontend tests, 27 HTTP checks and 18 browser scenarios are historical results at their documented SHAs. A new candidate needs its own results, source/build identity and cleanup proof. Re-run affected unit/integration checks when runtime code changes.

## Product API and Postman

Import the [S09-S10 collection](docs/products/postman/s09-s10-products.postman_collection.json) and [blank local environment](docs/products/postman/s09-s10-local.postman_environment.json). Select S09-S10 Local, use the running backend origin (normally `http://127.0.0.1:5001`) and run folders 00-03 in order. The first request generates fresh local fixture identities; subsequent requests store local tokens. Keep populated environment values private. The export contains no credentials. The complete collection has 38 requests and 114 assertions.

Public GET `/api/products` returns `{products: [...]}` for active products. Seller GET `/api/products/mine` includes their archived records. GET `/api/products/:id` returns `{product: {...}}`; only its authenticated owner can read an archived item. Seller POST creates an active product; owner PATCH updates allowed fields or archives it. Money is positive safe-integer AUD cents. Do not submit owner, initial status, IDs or timestamps.

The Postman collection does not stop/restart the server or directly inspect MongoDB. The optional Newman wrapper records a separate final DB check and cleans its own generated fixtures. The browser verifier separately checks React interactions, three identities and genuine backend process replacement. Both require explicit opt-in to the dedicated test DB and separately installed test tools; see the verification document for commands. Postman Desktop screenshots and university EC2 validation are separate steps.

For WF2 use the [39-request Order collection](docs/orders/postman/s12-s14-orders.postman_collection.json) and [blank environment](docs/orders/postman/s12-s14-local.postman_environment.json). The new runner generates four independent temporary account passwords in memory and retains only sanitised request/assertion summaries. Never publish a populated environment or raw Newman report.

## Source and assistance

Authentication/bcrypt/JWT and the React/Express/Mongoose scaffold extend [the supplied course starter](https://github.com/nahaQUT/sampleapp_IFQ636). Development, testing and documentation have involved generative-tool assistance. Retain accurate course GenAI disclosure; these technical records are not a student reflection, proof of independent authorship or a claim of human user research.

The inherited README contained committed merge-conflict markers and older assessment/admin/CI descriptions. This operational README replaces those with the actual current increment; previous content remains in Git history. Current assignment requirements come from the course's current criteria.
