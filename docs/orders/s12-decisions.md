# Order workflow decisions

Date: 10 November 2026, Australia/Brisbane. Jira: HM-46, HM-51, HM-56, HM-61.

Requests cover one product and quantity 1–100. They take no payment and reserve no stock. The API rejects client-supplied identity, prices, totals, initial status and unknown fields. The server derives identity and pricing, saves immutable snapshots and uses safe integer AUD cents.

The related Buyer and Seller can read their requests. An unrelated authenticated account receives 403; missing resources receive 404. Lists reject unsupported query filters. DTOs contain identifiers and request fields rather than populated accounts.

Seller transitions require status and expectedStatus. Legal transitions are pending→accepted/rejected and accepted→completed. A single conditional update includes Order ID, Seller ID and expectedStatus. Stale, repeated and illegal transitions return 409. Unknown enum values return 400. No upsert or reopening is supported.

Product eligibility and price are determined by the Product snapshot read during creation. An already archived Product is rejected; overlapping archive/reprice after that read is not serialised with the Order insert. Single-document transition atomicity does not guarantee cross-document consistency. Existing requests retain snapshots and remain accessible after archive.

In-flight UI locks are not server idempotency. A timeout or 5xx may follow a committed write; preserve input, offer read-back and never retry the mutation automatically. The application has no general duplicate-request prevention.

The S11 cloud trial remains a separate release until the new increment is explicitly deployed and verified. Development and verification involved generative-tool assistance; retain accurate course disclosure and evidence boundaries.
