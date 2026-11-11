# API reference

Send JSON request bodies with `Content-Type: application/json`. Protected routes require `Authorization: Bearer <token>`. Authentication uses the current persisted account role; client-supplied ownership fields are not trusted. IDs use 24 hexadecimal characters.

## Accounts

| Method / route | Access | Request body | Success |
| --- | --- | --- | --- |
| `POST /api/auth/register` | Public | `name`, `email`, `password`; optional `role`, `address` | `201` User |
| `POST /api/auth/login` | Public | `email`, `password` | `200` User with `token` |
| `GET /api/auth/profile` | Authenticated | None | `200` User |
| `PUT /api/auth/profile` | Authenticated | One or more of `name`, `email`, `address` | `200` User |

Roles are `buyer` and `seller`; an omitted registration role defaults to `buyer`. Profile updates cannot change roles or passwords. A User response contains `id`, `name`, `email`, `role` and `address`; password hashes are never returned.

## Products

| Method / route | Access | Request body | Success |
| --- | --- | --- | --- |
| `GET /api/products` | Public | None | `200 {products}`; active listings |
| `GET /api/products/mine` | Seller | None | `200 {products}`; owned active and archived listings |
| `GET /api/products/:id` | Public for active; owning Seller for archived | None | `200 {product}` |
| `POST /api/products` | Seller | `title`, `description`, `category`, `priceCents` | `201 {product}` |
| `PATCH /api/products/:id` | Owning Seller | One or more editable fields; optional `status: "archived"` | `200 {product}` |

Title, description and category are trimmed, nonempty strings with maximum lengths of 120, 2000 and 60 characters respectively. Prices are positive safe-integer AUD cents: `2500` represents AUD 25.00. Ownership, initial status, IDs and timestamps are server-controlled. Unsupported body fields are rejected.

Products are created as `active`. Archiving is permanent through this API; archived records cannot be edited or reopened. They leave public reads but remain available to their owning Seller. Sending an Authorization header to a public Product route still requires that header to be valid.

A Product response contains `id`, `sellerId`, `title`, `description`, `category`, `priceCents`, `status`, `createdAt` and `updatedAt`.

## Order requests

| Method / route | Access | Request body | Success |
| --- | --- | --- | --- |
| `POST /api/orders` | Buyer | `productId`, `quantity` | `201 {order}` |
| `GET /api/orders/mine` | Buyer | None | `200 {orders}`; own requests |
| `GET /api/orders/seller` | Seller | None | `200 {orders}`; requests for owned products |
| `GET /api/orders/:id` | Related Buyer or Seller | None | `200 {order}` |
| `PATCH /api/orders/:id/status` | Owning Seller | `status`, `expectedStatus` | `200 {order}` |

Quantity must be a JSON integer from 1 to 100. The backend derives Buyer, Seller, product title, unit price and total; clients submit only the listed request fields. Totals must remain positive safe integers. Unsupported body fields and Order read query filters are rejected.

| Current status | Permitted next status |
| --- | --- |
| `pending` | `accepted` or `rejected` |
| `accepted` | `completed` |
| `rejected`, `completed` | None |

The update is conditional on the persisted `expectedStatus`. A stale or disallowed transition returns `409`; reload the request before deciding on another action. An unknown status value returns `400`. Archived products cannot receive new requests. Existing requests retain their saved title and price after Product edits or archive.

An Order response contains `id`, `buyerId`, `sellerId`, `productId`, `productTitle`, `unitPriceCents`, `quantity`, `totalCents`, `status`, `createdAt` and `updatedAt`.

## Errors and availability

Errors contain `code` and `message`; validation errors can also contain a field-keyed `errors` object.

| HTTP status | Meaning / representative codes |
| --- | --- |
| `400` | Invalid fields, JSON or IDs: `VALIDATION_ERROR`, `INVALID_PRODUCT_ID`, `INVALID_ORDER_ID` |
| `401` | Missing, invalid or expired authentication; unavailable account or incorrect login credentials |
| `403` | Wrong role, unrelated ownership or unavailable persisted role |
| `404` | Missing/inaccessible Product, absent Order or unknown API route |
| `409` | Duplicate email, archived Product action or stale/illegal Order transition |
| `413` | Request body exceeds the accepted size |
| `500` | Safe service failure; do not infer whether a write committed |

`GET /api/health` is public and uncached. It returns `200` when the database driver is connected and `503` otherwise, without exposing credentials or configuration.
