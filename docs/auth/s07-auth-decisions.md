# S07 authentication decisions

Date: 2026-11-04 (Australia/Brisbane). Implemented with Codex assistance, following the user's instruction to execute S07 including code and Git. This is an implementation record, not a student reflection or user-research report.

| Decision | Implementation and reason |
| --- | --- |
| Roles | Persist buyer or seller; only an omitted registration field defaults to buyer. Registration remains open to either business role. |
| Legacy users | No bulk migration. New demonstration accounts are used; lean DB reads reject missing or unsupported persisted roles. |
| Input | Explicit body/field/type validation. Name 1–80; email normalized and up to254; registration password at least8 Unicode code points and at most72 UTF-8 bytes, without trimming; optional address up to300. These are project choices. |
| DTO | Explicit id/name/email/role/address. Only login includes a token. No hash, university or raw document response. |
| Profile | Reject unknown fields, including role/password, before any write. Validated whitelisted query updates; empty address is meaningful. |
| Auth failures | 400 validation;401 missing/invalid/expired JWT or deleted account;403 unsupported DB role or denied business role;409 duplicate email;500 service failure. Malformed JSON400; oversized JSON413. |
| Passwords | Preserve the course starter bcrypt save hook, using pure async and one hash. Profile updates never change passwords. |
| JWT | HS256 allowlist, ID payload, existing30d expiry. Read current role from MongoDB on each protected request. |
| Session | Token-only sessionStorage with a Provider-owned controller. A closure stores the revision and AbortController; equivalent to the plan's refs, with lifecycle cleanup and stale-response protection. |
| Refresh | Profile verification precedes protected rendering. Service/network failure preserves token but grants no access until retry succeeds. |
| Logout | Clear local session and invalidate in-flight results. No server-side JWT revocation or global logout is claimed. |
| UI scope | Public catalogue and Seller products are route shells. Product CRUD/ownership belong to S08/S09; orders to S12 onward. |
| Origin | Relative /api paths and CRA development proxy. Production static hosting is deferred to S16/S17. |
| Source | User/auth routes/controllers, bcrypt/JWT and React scaffolding extend the supplied course starter. |

S07 does not close HM-15 AC4: a Buyer must still be rejected by a real Seller-only Product action after S08 wiring. Middleware tests are a separate layer of evidence. No Jira updates, prototype completion, deployment or external participant feedback are implied.
