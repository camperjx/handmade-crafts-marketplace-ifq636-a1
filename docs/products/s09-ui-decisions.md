# Product UI decisions

Date: 6 November 2026, Australia/Brisbane. Scope: S09-S10, extending the S08 Product API.

| Decision | Reason and implementation | Trace |
| --- | --- | --- |
| Keep the existing React app, Axios instance and session controller | Product API helpers use relative `/api/products` paths; CRA keeps the existing 5001 development proxy. Product pages do not maintain another token store. | HM-23/27/33; REQ-N01 |
| Store the form amount as a decimal string | Integer arithmetic converts AUD to positive safe-integer cents and formats saved prices without floating-point loss. The HTTP body contains a JSON number, never BigInt. | HM-23; REQ-F02/N02 |
| Keep forms and page data separate | ProductForm owns its draft. ProductEditor owns API writes, navigation and conflict recovery. Catalogue and Seller pages read their respective public/owner endpoints. | HM-23/27/33; UI -> API -> Product -> MongoDB |
| Remount Product state when the session or resource changes | AbortController and session revision checks suppress late reads/writes. ProductSession also clears already-rendered private state when the account changes. | HM-28/33; REQ-N01 |
| Enforce owner eligibility before rendering an editor | Reading an active Product is public and does not confer write permission. The editor checks sellerId; the backend remains authoritative. | HM-33; REQ-F04/N01 |
| Use a labelled inline archive confirmation | Cancel/Escape sends no PATCH; focus moves to Cancel and returns to the trigger or list heading. Archived owner records remain read-only. | HM-33; S05 active -> archived; S06 maintenance flow |
| Preserve a draft after 409 | The editor fetches the latest status without replacing the draft. Saving is disabled until the user discards the draft and reloads. | HM-33/34 |
| Do not automatically repeat an unconfirmed write | The server might have committed before the response was lost. The UI offers My products for reconciliation. | HM-23/33; REQ-N02/N03 |
| Use category placeholders rather than an upload workflow | S08 has no image field. Existing paper/green styles and shared form controls are reused. UI behaviour follows the design; exact pixel reproduction is not required. | HM-27; S06 UI notes |
| Keep scope boundaries explicit | No orders, payment, stock reservation, reopening or general Product version locking is added. External EC2 verification is S11. | HM-34/35; S12 order rejection follow-up |

Source baseline: main `fa0b62140bf1e0e089ac90a16a928c7adf707f0c`. Verification results are recorded separately; this decision list does not establish that a browser case or deployment has passed.

Technical references: [React effect cleanup](https://react.dev/reference/react/useEffect), [Axios cancellation](https://axios-http.com/docs/cancellation). Existing dependency major versions are retained.
