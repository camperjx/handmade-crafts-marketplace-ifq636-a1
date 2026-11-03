# Handmade Crafts Marketplace — IFQ636 Assignment 1

MERN application extending the course authentication starter. The current S07 increment implements Buyer/Seller accounts, guarded profile access and verified browser sessions. Product pages are navigation shells; product CRUD/ownership and orders are later increments.

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
CI=true npm test --prefix frontend -- --watchAll=false --runInBand
npm run build --prefix frontend
```

The integration command explicitly opts in to creating UUID-namespaced temporary accounts in the configured development DB and cleans only those generated email addresses. Browser automation is optional and requires a separately installed Playwright package and Chrome; see [verification](docs/auth/s07-verification.md).

See [authentication decisions](docs/auth/s07-auth-decisions.md) for API/role/session choices, actual checks and limitations. No server-side JWT revocation, payments, production deployment or completed Product/Order workflows are claimed.

## Source and assistance

Authentication/bcrypt/JWT and the React/Express/Mongoose scaffold extend [the supplied course starter](https://github.com/nahaQUT/sampleapp_IFQ636). S07 was implemented and tested with Codex assistance under the user's explicit instruction. Retain accurate course GenAI disclosure; these technical records are not a student reflection or a claim of human user research.

The inherited README contained committed merge-conflict markers and older assessment/admin/CI descriptions. This operational README replaces those with the actual current increment; previous content remains in Git history. Current assignment requirements come from the course's current criteria.
