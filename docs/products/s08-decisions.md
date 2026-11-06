# Product API decisions

Date: 6 November 2026, Australia/Brisbane. Increment: S08, following the S07 authentication baseline.

| Area | Decision |
| --- | --- |
| Identity | `protect` reads the current DB User; writes additionally require `authorize('seller')`. The server supplies `sellerId`. Client identity fields are rejected, even if equal to the current user. |
| Text | Trimmed title 1–120, description 1–2000, category 1–60 JavaScript string units. Category is text rather than a new business enum. |
| Money | Positive JSON safe-integer AUD cents. A string such as `"2500"` is invalid; 2500 represents AUD 25.00. Multiplication checks for future orders remain S12 work. |
| Creation | The server assigns active status. Client status, IDs, owner, timestamps and image fields are not accepted. |
| Patch | Whitelisted, non-empty object; validate the whole request before writing. Missing fields are retained. Owner cannot change. |
| Archive | Soft archive via PATCH status=archived. Archived products are read-only and cannot reopen. A valid repeated change conflicts with 409; status=active is an invalid input (400). |
| Visibility | Public list is always active-only. The owner can read archived records using an authenticated detail request or the Seller-only mine list. Other archived detail reads return 404. |
| Optional authentication | No Authorization is anonymous. A supplied header must pass the existing verification, including DB role availability; invalid credentials do not silently become anonymous. |
| Responses | Lists use `{products: [...]}`, item responses use `{product: {...}}`. DTOs explicitly select fields without a populated User or Mongoose internals. |
| Mutation | Owner is checked before body validation and again in the update filter. ID + sellerId + active status constrain a single atomic document update. No cross-document transaction or edit-version protocol is claimed. |
| Scope | Backend Product operations only. Existing React product pages remain shells until S09. No Order, payment, inventory, upload, reopening or deployment is added. |

These concrete field limits and conflict choices refine the earlier design draft. They are project choices, not additional requirements imposed by the assignment. The existing structural design remains applicable; update its contract notes and traceability with the actual S08 evidence.

Implementation references: [Mongoose 6 validation](https://mongoosejs.com/docs/6.x/docs/validation.html) and [findOneAndUpdate](https://mongoosejs.com/docs/6.x/docs/tutorials/findoneandupdate.html). The repository retains Mongoose 6.13.5; no dependency upgrade is part of this increment.
