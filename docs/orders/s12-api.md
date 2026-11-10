# Order API contract

All routes require existing Bearer authentication. Responses explicitly whitelist DTO fields: id, buyerId, sellerId, productId, productTitle, unitPriceCents, quantity, totalCents, status, createdAt and updatedAt.

| Method / path | Role | Body | Success |
| --- | --- | --- | --- |
| POST /api/orders | Buyer | productId, quantity | 201 {order} |
| GET /api/orders/mine | Buyer | None | 200 {orders} |
| GET /api/orders/seller | Seller | None | 200 {orders} |
| GET /api/orders/:id | Related Buyer/Seller | None | 200 {order} |
| PATCH /api/orders/:id/status | Owning Seller | status, expectedStatus | 200 {order} |

Quantity must be a JSON number and integer from 1–100. Create bodies with malformed productId return 400 VALIDATION_ERROR. Order URL IDs require 24 hex characters (400 INVALID_ORDER_ID). Unknown fields and unsupported list query filters return 400. Missing/invalid authentication returns 401, wrong role or unrelated owner returns 403, absent records return 404, archived-product creation and stale/illegal transitions return 409. Unexpected failures use the existing safe 500 contract.

For example, status=accepted and expectedStatus=pending accepts a pending request. completed→pending is a well-formed illegal transition (409); cancelled is an unknown enum value (400). See the decision record for concurrency, historical snapshots and retry boundaries.
