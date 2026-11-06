# Handmade Crafts Marketplace — IFQ636 Assignment 1

MERN application extending the course authentication starter. S07 implements Buyer/Seller accounts, guarded profile access and verified browser sessions. S08 adds the Product backend: active catalogue/detail, Seller-owned lists and creation, owner-only updates, strict input validation and soft archive. React product pages remain navigation shells until S09; orders are later work.

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

Open `/register`, choose Buyer or Seller, then sign in. Buyer goes to `/products`; Seller goes to `/seller/products`; both can use `/profile`. Existing DB users without a persisted valid role are rejected rather than silently migrated. This application uses `frontend/src`; the legacy root HTML marketing mockup is not the React app.

## Verification

```sh
npm test --prefix backend
npm run test:integration --prefix backend
npm run test:products:integration --prefix backend
CI=true npm test --prefix frontend -- --watchAll=false --runInBand
npm run build --prefix frontend
```

The original auth integration command opts in to UUID-namespaced temporary accounts in the configured development DB. The Product integration command instead requires ignored `backend/.env.s08-test.local` with `PRODUCT_TEST_MONGO_URI` pointing specifically to `hm_s08_test`; it cleans only its generated accounts/products. No real configuration values are committed. See [Product verification](docs/products/s08-verification.md) for the separate process-restart check and evidence boundaries. Browser automation is optional and requires a separately installed Playwright package and Chrome; see [auth verification](docs/auth/s07-verification.md).

See [authentication decisions](docs/auth/s07-auth-decisions.md) and [Product decisions](docs/products/s08-decisions.md) for API/role/session choices and limitations. No server-side JWT revocation, payments, deployment or completed Product/Order UI workflows are claimed.

## Product API and Postman

Import the [collection](docs/products/postman/s08-products.postman_collection.json) and [blank local environment](docs/products/postman/s08-local.postman_environment.json). Select S08 Local, use the running backend origin (normally `http://127.0.0.1:5001`) and run folders in order. The first request generates fresh local fixture identities; subsequent requests store local tokens. Keep populated environment values private. The export contains no credentials.

Public GET `/api/products` returns `{products: [...]}` for active products. Seller GET `/api/products/mine` includes their archived records. GET `/api/products/:id` returns `{product: {...}}`; only its authenticated owner can read an archived item. Seller POST creates an active product; owner PATCH updates allowed fields or archives it. Money is positive safe-integer AUD cents. Do not submit owner, initial status, IDs or timestamps.

The Postman collection does not stop/restart the server or directly inspect MongoDB. Those evidence steps must be recorded separately. Full React product interactions remain S09 work.

## Source and assistance

Authentication/bcrypt/JWT and the React/Express/Mongoose scaffold extend [the supplied course starter](https://github.com/nahaQUT/sampleapp_IFQ636). S07 was implemented and tested with Codex assistance under the user's explicit instruction. Retain accurate course GenAI disclosure; these technical records are not a student reflection or a claim of human user research.

The inherited README contained committed merge-conflict markers and older assessment/admin/CI descriptions. This operational README replaces those with the actual current increment; previous content remains in Git history. Current assignment requirements come from the course's current criteria.
