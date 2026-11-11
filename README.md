# Handmade Crafts Marketplace

A React, Express and MongoDB application with Buyer and Seller accounts. Sellers publish, update and archive handmade products. Buyers browse active listings and submit requests; the related Seller accepts, rejects or completes each request. Data and historical order prices persist in MongoDB.

## Setup

Use Node.js 22, as specified in `.nvmrc`. From the repository root:

```sh
npm ci --prefix backend --include=dev
npm ci --prefix frontend --include=dev
```

Create a private `backend/.env` using `backend/.env.example` as the key reference. Preserve existing configuration when updating an installation.

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection URI for the intended application database |
| `JWT_SECRET` | Private signing secret |
| `PORT` | Backend port; default `5001` |
| `NODE_ENV` | `development` or explicitly `production` |

Keep credentials outside Git and restrict private configuration files to mode `600`.

Run development services in separate terminals:

```sh
npm run dev --prefix backend
npm start --prefix frontend
```

Open http://localhost:3000. The development frontend proxies API requests to `127.0.0.1:5001`.

## Architecture

| Layer | Responsibility |
| --- | --- |
| React frontend | Catalogue, account screens, Seller products and Buyer/Seller requests |
| Express backend | Validation, authentication, permissions and workflow rules |
| MongoDB / Mongoose | Users, Products and Orders |

Production uses one Express origin for the built frontend and `/api` routes. The server resolves `backend/.env` and `frontend/build` relative to its own directory; existing process environment takes precedence. Startup connects to MongoDB and initializes models before accepting requests.

Buyer pages include `/products`, `/products/:id/request` and `/orders`. Seller pages include `/seller/products`, `/seller/products/new` and `/seller/orders`. Both roles can use `/profile` and read their related `/orders/:id` records. API permissions are enforced independently of frontend navigation.

See the [API reference](docs/api.md) for routes, request fields, permissions and error rules.

## Production

Build the frontend, then start the backend with explicit production mode. This local example uses port `5002`:

```sh
npm run build --prefix frontend
NODE_ENV=production PORT=5002 npm start --prefix backend
```

Open http://localhost:5002. Production does not require a React development server. Root `npm start` starts development services and is not the production entry point.

Recorded EC2 application URL: http://3.26.221.223:5001/products. Availability and the currently deployed version have not been reverified; the EC2 public address may change. Deployment requires the approved host configuration and a frontend build matching the backend source version.

`GET /api/health` returns `200` while the database driver is connected and `503` otherwise. A healthy response alone does not verify a complete user workflow. Unknown API paths return JSON `404`; private server files are not served.

## Tests

```sh
npm test --prefix backend
CI=true npm test --prefix frontend -- --watchAll=false --runInBand
```

Database integration checks require separate test configuration and explicit opt-in. Optional browser and Postman checks also require their local tools and inputs; these are not production dependencies.

## Known limitations

- Requests do not take payment or reserve inventory. Cancellation, refunds and reopening are not implemented.
- There is no server-side JWT revocation or general version protocol for concurrent Product edits.
- Order creation is not serialized with an overlapping Product update or archive.
- A failed response may follow a committed write. Read back the latest state before repeating a submission; the UI does not automatically retry uncertain writes.
- Accounts without a valid persisted Buyer/Seller role require correction before use.

## Source and assistance

The application extends the [course authentication starter](https://github.com/nahaQUT/sampleapp_IFQ636), including its React/Express/Mongoose scaffold and bcrypt/JWT authentication. Development, testing and documentation have involved generative-tool assistance. Required coursework disclosures are maintained separately.
