# Handmade Crafts Marketplace — IFQ636 Assignment 1

MERN application extending the course authentication starter. Buyer/Seller accounts, protected profiles and verified browser sessions support a complete local Product workflow: Seller publication, public catalogue/detail, owner updates and soft archive with retained history. React pages use the persistent Product API. Orders and external EC2 deployment are subsequent work.

## Local development

Use Node22 (`.nvmrc`). The project has separate root/backend/frontend package files. With dependencies installed, create backend runtime configuration from the placeholder `backend/.env.example`: MONGO_URI, JWT_SECRET and optional PORT (default5001). Keep actual values out of Git.

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

Express can serve the React production build and API from one origin. Set `MONGO_URI`, `JWT_SECRET`, `PORT` and `NODE_ENV=production` in private runtime configuration. Build before starting:

```sh
npm ci --prefix frontend --include=dev
npm run build --prefix frontend
NODE_ENV=production PORT=5002 npm start --prefix backend
```

Use http://localhost:5002 for local production verification; EC2 uses its separately approved port. No CRA process or development proxy is needed. GET `/api/health` returns 200/ready only while the database driver is connected, otherwise 503/unavailable. It does not replace a real Product workflow check. Known frontend deep links serve the application; unknown API paths, missing assets and private server files stay unavailable. Production does not enable cross-origin API access.

See the [S11 deployment runbook](docs/deployment/s11-runbook.md) for release packaging, Ubuntu startup, verification commands and evidence boundaries. Preparing a build does not mean the university EC2 is deployed.

## Verification

```sh
npm test --prefix backend
npm run test:integration --prefix backend
npm run test:products:integration --prefix backend
CI=true npm test --prefix frontend -- --watchAll=false --runInBand
npm run build --prefix frontend
```

The original auth integration command opts in to UUID-namespaced temporary accounts in the configured development DB. The Product integration command instead requires ignored `backend/.env.s08-test.local` with `PRODUCT_TEST_MONGO_URI` pointing specifically to `hm_s08_test`; it cleans only its generated accounts/products. No real configuration values are committed. See [Product verification](docs/products/s08-verification.md) for the separate process-restart check and evidence boundaries. Browser automation is optional and requires a separately installed Playwright package and Chrome; see [auth verification](docs/auth/s07-verification.md).

See [authentication decisions](docs/auth/s07-auth-decisions.md), [Product backend decisions](docs/products/s08-decisions.md), [UI decisions](docs/products/s09-ui-decisions.md) and [S09-S10 verification](docs/products/s09-s10-verification.md). No server-side JWT revocation, payment, Order workflow, general optimistic locking for active Product edits or external deployment is claimed. A write timeout or HTTP 5xx may follow a committed write: the UI preserves the draft and offers a read-back check instead of automatically retrying.

## Product API and Postman

Import the [S09-S10 collection](docs/products/postman/s09-s10-products.postman_collection.json) and [blank local environment](docs/products/postman/s09-s10-local.postman_environment.json). Select S09-S10 Local, use the running backend origin (normally `http://127.0.0.1:5001`) and run folders 00-03 in order. The first request generates fresh local fixture identities; subsequent requests store local tokens. Keep populated environment values private. The export contains no credentials. The complete collection has 38 requests and 114 assertions.

Public GET `/api/products` returns `{products: [...]}` for active products. Seller GET `/api/products/mine` includes their archived records. GET `/api/products/:id` returns `{product: {...}}`; only its authenticated owner can read an archived item. Seller POST creates an active product; owner PATCH updates allowed fields or archives it. Money is positive safe-integer AUD cents. Do not submit owner, initial status, IDs or timestamps.

The Postman collection does not stop/restart the server or directly inspect MongoDB. The optional Newman wrapper records a separate final DB check and cleans its own generated fixtures. The browser verifier separately checks React interactions, three identities and genuine backend process replacement. Both require explicit opt-in to the dedicated test DB and separately installed test tools; see the verification document for commands. Postman Desktop screenshots and university EC2 validation are separate steps.

## Source and assistance

Authentication/bcrypt/JWT and the React/Express/Mongoose scaffold extend [the supplied course starter](https://github.com/nahaQUT/sampleapp_IFQ636). S07 was implemented and tested with Codex assistance under the user's explicit instruction. Retain accurate course GenAI disclosure; these technical records are not a student reflection or a claim of human user research.

The inherited README contained committed merge-conflict markers and older assessment/admin/CI descriptions. This operational README replaces those with the actual current increment; previous content remains in Git history. Current assignment requirements come from the course's current criteria.
