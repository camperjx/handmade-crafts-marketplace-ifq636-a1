# S11 production hosting and first EC2 trial

This increment addresses HM-35 / HM-37: serve the existing WF1 from one Express origin, expose a minimal database readiness check and prepare a versioned React build for Ubuntu EC2. Order workflow and external deployment verification remain separate work.

## Runtime contract

| Setting | Meaning |
| --- | --- |
| Node | 22, as pinned by `.nvmrc` |
| `MONGO_URI` | Private URI for the intended application database |
| `JWT_SECRET` | Private, independently generated signing secret |
| `PORT` | Integer 1–65535; default 5001; local smoke uses 5002 |
| `NODE_ENV` | `production` enables static hosting; example defaults to `development` |

API routes are registered before static hosting. Only `frontend/build` is public. The known frontend routes receive an uncached HTML entry document; a valid 24-character Product ID supports detail/edit refresh. An unknown API returns JSON 404 `API_NOT_FOUND`; a missing asset, malformed direct frontend Product URL or private source path returns JSON 404 `RESOURCE_NOT_FOUND`. The Product API still returns 400 for a malformed ID. These deliberate boundaries avoid returning HTML with status 200 for a missing script.

`/api/health` is uncached and exposes only `service` and `status`. HTTP 200 means Mongoose connection state 1; states 0/2/3 produce 503. This checks driver state, not a database query or all application dependencies. Startup validates configuration, port and the presence of `frontend/build/index.html` before connecting, then initializes models before listening. A listen failure closes its own database connection and exits 1 with a safe message.

## Local checks

From the repository root with Node22 and dependencies installed:

```sh
NODE_ENV=test npm test --prefix backend
CI=true npm test --prefix frontend -- --watchAll=false --runInBand
npm run build --prefix frontend
NODE_ENV=production PORT=5002 npm start --prefix backend
```

The final command uses the locally configured application database. Stop only this process after manual checks. Do not stop another developer's process on 5001.

For isolated, repeatable production HTTP verification, configure ignored `backend/.env.s08-test.local` with `PRODUCT_TEST_MONGO_URI` naming exactly `hm_s08_test`. The script refuses to replace an occupied port, makes no database writes and stops its own child process:

```sh
RUN_PRODUCT_DB_TESTS=1 S11_PORT=5002 node backend/scripts/verify-s11-routing.cjs
```

Reports default to ignored `artifacts/s11/`; set `S11_ARTIFACT_DIR` for another destination. Cases cover real HTML/JS/CSS, API routing, private files, content negotiation, invalid port and an occupied-port child that must exit safely.

The existing browser verifier also works with the production server. Install Playwright separately, use installed Chrome and run the following from the repository root. It registers UUID-scoped test users and products, checks database persistence, replaces its own backend process and removes only its generated fixtures. Passwords and tokens stay in memory. The 27 selected cases include explicitly identified injected failures; they are not all real outages.

```sh
export S09_CASE_FILTER='SETUP-01,SEC-01,VAL-UI,WF1-01,WF1-02,WF1-03,WF1-04,WF1-05,SEC-02-06,VAL-API,UX-READ,UX-EMPTY,UX-SERVER-FIELD,UX-UNCONFIRMED,UX-5XX,SES-403,RACE-01,RACE-03,RACE-02,WF1-06,WF1-07,WF1-08,WF1-09,WF1-10,UX-RESPONSIVE,SES-ROLE,SES-401'
NODE_ENV=production RUN_PRODUCT_DB_TESTS=1 \
S09_FRONTEND_URL=http://localhost:5002 S09_BACKEND_PORT=5002 \
S09_BROWSER_MODULE=/absolute/path/to/playwright \
node frontend/scripts/verify-s09-s10.cjs
```

The old `READ-01` development-server case is excluded because its direct malformed frontend URL intentionally returns a server 404 in production. The new routing verifier checks both that 404 and the unchanged API 400 contract. This exclusion does not represent a passing execution of the old case.

## Recorded local verification — 2026-11-09, Australia/Brisbane

| Check | Actual result |
| --- | --- |
| Backend unit/HTTP contracts | 154 passing |
| Frontend | 70 passing across 7 suites |
| React production build | Compiled successfully; Browserslist data age warning retained |
| Real production routing | 31/31 passing; [report](evidence/s11-routing-results.json) |
| Production Chrome WF1 and selected regression cases | 27/27 passing; [report](evidence/s11-browser-results.json) |
| Genuine backend replacement | PID 6024 → 6095; saved active/archived records retained |
| Fixture cleanup | 0 generated users and 0 generated products remaining |

The first readiness-test attempt failed because Mongoose 6's `readyState` accessor cannot be redefined by Sinon. The corrected test replaces the configurable `mongoose.connection` getter with a state double. The full 154-test backend run then passed. This is a test-double correction, not a claim that a real database outage was exercised.

Tests ran on the modified working tree based on `ccb105ed073c7331a1e21058d2fba161577120e1`, before the production increment was committed. [Source SHA-256 manifest](evidence/s11-tested-source.json) identifies the exact files; the later release record must verify them against the committed release. [Published product](evidence/s11-published.png) and [owner history after process replacement](evidence/s11-restarted-owner-history.png) are local production browser evidence. External EC2 evidence is still pending.

## Release and transfer

1. Review and merge the tested branch into `main`. Confirm the checkout is clean and record the merge SHA.
2. Create a new immutable trial tag, for example `iteration1-demo-YYYYMMDD-01`; never move an existing tag.
3. On the Mac, install from the frontend lockfile and build at that tag. Add public `frontend/build/release.json` containing only the tag, commit and UTC build timestamp.
4. Archive only `frontend/build` as `<tag>-frontend-build.tgz`. Save `<tag>.source-sha.txt` and the archive's SHA-256 checksum in `<tag>-frontend-build.tgz.sha256`. Generated builds are ignored by Git.
5. On Ubuntu, clone this repository and checkout the same tag. Run `npm ci --prefix backend --omit=dev` on Ubuntu; never transfer Mac `node_modules`.
6. Transfer the three release files with SCP. Verify the archive checksum and source SHA against the clean EC2 checkout before extracting the build.
7. Create private `backend/.env` on EC2 with the four runtime keys above, `NODE_ENV=production` and the school-approved port. Do not put AWS credentials or the Mac SSH key in application configuration.
8. Run the server in the foreground, verify health and Product reads, then configure PM2 and its approved startup mechanism. Verify actual restart behaviour separately.
9. From an approved external browser, complete Seller publish 25.00 → Buyer read → owner update 30.00 → archive → owner retained history. Record the actual URL, time, tag/SHA and screenshots.

Use the existing approved security group and course access controls. The local package and local WF1 checks are preparation evidence; EC2 connection, network access, PM2 boot persistence, external WF1 and Jira updates require their own evidence. A local production pass does not establish any of those outcomes.

## Rollback

Retain the previous tag and matching static archive. Stop only this application's PM2 process, checkout the previous tag, install its backend runtime dependencies and restore its matching build. Preserve private `.env` and database records. Validate readiness and a Product read before resuming access. Do not use `git clean -fdx` or database deletion as deployment steps.

Technical references: [Express static hosting](https://expressjs.com/en/starter/static-files/), [Mongoose 6 connection state](https://mongoosejs.com/docs/6.x/docs/api/connection.html), [PM2 startup](https://pm2.keymetrics.io/docs/usage/startup/).
