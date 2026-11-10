# Production readiness and release runbook

Date: 11 November 2026, Australia/Brisbane. Jira: HM-66; verification dependency HM-61. Scope: the merged Product and Order workflows. S16 prepares and verifies a local candidate; S17 selects the final tag, updates university EC2 and performs external acceptance.

## 1. Runtime and architecture

The browser runs React. One Express process serves the production build and `/api/auth`, `/api/products`, `/api/orders` and `/api/health`; MongoDB Atlas persists Users, Products and Orders. There is no separate CRA server or development proxy in production. The root concurrently scripts are development orchestration, not the production service.

| Item | Contract |
| --- | --- |
| Node | 22; record the actual local and Ubuntu patch versions separately |
| Local preparation baseline | macOS 26.5, Node 22.23.2, npm 10.9.8 |
| MONGO_URI | Private URI for the intended application database; not committed or printed |
| JWT_SECRET | Private signing secret; independent of test secrets |
| PORT | Integer 1–65535; default 5001; use the school-approved external port |
| NODE_ENV | Explicitly production for static hosting; script names do not set it |
| Environment file | Absolute backend/.env path derived from server.js; existing process environment takes precedence |
| Static files | Absolute frontend/build path; only the build directory is public |
| Local test preview | 127.0.0.1:5004 with hm_s12_s14_test; HTTP verifier 5005; Newman 5006 |
| Known Ubuntu app path | /home/ubuntu/apps/handmade-crafts-marketplace; verify before changing anything |
| Existing process name | crafts-a1; verify its script/cwd and owner on the actual host |

Backend startup verifies configuration, port and production index.html, connects to MongoDB, initializes all three models, then listens. API 404 precedes static/HTML handling. Production only serves allowlisted frontend routes; missing assets/private files/unknown paths remain 404. The health endpoint reports minimal driver readiness without exposing configuration. A 200 response is not complete workflow acceptance.

Private env files should be mode 600. Keep existing configuration; never replace a valid file with `.env.example`. Changing an env file requires a fresh process. Do not put AWS credentials, SSH keys or test credentials in the frontend, package or repository.

## 2. Install and develop locally

From the repository root with Node 22:

```sh
npm ci --prefix backend --include=dev
npm ci --prefix frontend --include=dev
```

For development, use `npm run dev --prefix backend` and `npm start --prefix frontend` in separate terminals. React usually uses 3000 and proxies API requests to 5001. Root tooling is optional unless its development scripts are used. The inherited package names are not a configuration diagnostic.

For a normal application preview, use the private backend/.env with an intentional application database:

```sh
npm run build --prefix frontend
NODE_ENV=production PORT=5002 npm start --prefix backend
```

This example uses 5002 only when free. The dedicated test preview below uses a different environment and port. Do not run the two commands against the same occupied port or assume terminal variables are shared.

## 3. Isolated production preview and acceptance

The ignored `backend/.env.s12-s14-test.local` contains ORDER_TEST_MONGO_URI naming exactly `hm_s12_s14_test` and a separate ORDER_TEST_JWT_SECRET of at least 32 characters. The helper refuses missing opt-in, wrong database and incomplete private configuration. It maps the private test values into the child's runtime environment, so backend/.env remains unchanged.

Build first, then start a foreground preview:

```sh
RUN_ORDER_DB_TESTS=1 node backend/scripts/start-s12-test-server.cjs --production
```

Open http://127.0.0.1:5004/products. Read `/api/health` and `/release.json`; known deep links must load, private APIs must still require authentication, and unknown APIs must return JSON 404. Stop this preview with Ctrl+C before starting browser acceptance.

From the repository root, the existing verifiers use their own local processes:

```sh
RUN_ORDER_DB_TESTS=1 node backend/scripts/verify-s14-routing.cjs
RUN_ORDER_DB_TESTS=1 node backend/scripts/verify-s14-browser.cjs
```

Set S14_ARTIFACT_DIR to the candidate run's evidence directory; relative paths resolve against the repository root. Chrome verification requires a separately installed Playwright module (PLAYWRIGHT_MODULE) and installed Chrome (CHROME_PATH, with the existing macOS application as default). No Playwright runtime dependency is added to the app.

Routing currently covers 27 cases; Chrome currently covers 18 scenarios. Record actual results rather than pre-filling those as passes. Chrome uses four disposable identities, runs WF1 and WF2, exercises validation/isolation/conflict/uncertain writes, and replaces its own Node child to compare both Product and Order data. Cleanup removes only generated fixtures. An occupied port is a reason to stop and identify its owner, not kill unrelated services.

Required acceptance includes Seller publish→Buyer read→owner edit→Buyer read→archive/history, plus Buyer request→Seller accept→complete→Buyer read and a separate rejection branch. Controlled response substitution after a real saved write is labelled failure injection. It is not a naturally observed outage. Health, process status, database reconnect and real process replacement are distinct checks.

The [S14 verification record](../orders/s14-verification.md) contains historical source-linked results. New candidates retain new records. Re-run relevant unit/integration tests if runtime code changes; documentation-only preparation does not manufacture new feature tests.

## 4. Candidate identity and package

Commit intended source changes before building. The S16 plan generates public release.json with exactly stage, tag, candidateId, commit and builtAtUtc. Stage is s16-candidate and tag is null. The local candidate pointer/run directory is not included in public metadata.

Record the clean source SHA, build log, exact served metadata, JS/CSS hashes, HTTP/browser reports and cleanup. Archive only frontend/build and save archive SHA-256, source-sha text and a manifest. Never transfer Mac node_modules: native backend dependencies must be installed on Ubuntu.

Candidate records and packages are kept under the sibling coursework directory `../result/a1-s12-s14/a1-s16/`. Candidate IDs identify immutable local packages, not Git refs. A new source/build requires a new candidate. Do not move an existing trial tag, relabel an older bundle with a newer SHA or overwrite a verified archive.

The final submitted release tag is pending. After the S16 PR is merged, S17 must build and verify the actual final main/tag commit. A merge commit has a different identity even if runtime files match, so final release metadata must identify the source actually selected for release.

## 5. University EC2 release procedure — S17 only

This section is a procedure to execute later, not evidence of S16 cloud changes. Use only the school-provided instance and approved existing profile/subnet/security-group arrangements. Previously recorded instance: i-02f8632761b1a4b3b, region ap-southeast-2, profile IFQ636-EC2-Role. Recheck all current values and permissions in the authenticated university Console.

The last recorded public trial URL was http://3.26.221.223:5001/products and its release was iteration1-demo-20261109-01 / d2b46ab. These are historical identifiers. They do not establish the current public IP, reachability or marking-window access. Agree assessor access within the university rules; do not create new IAM/security resources or broad inbound rules as a workaround.

### Before interrupting the old service

1. Complete the applicable review, traceability and prototype evidence, merge the intended source, and create an actual final release tag in S17.
2. Record the final tag, commit, build metadata and matching static archive/checksum/source-sha file. This is a new final build, not an S16 archive silently renamed.
3. Verify current instance/OS, approved application port, profile/subnet, SSH access and Atlas access for the approved egress source. Do not expose URI, tokens or keys in screenshots.
4. Preserve the previous verified tag, matching build/archive, current process configuration and private env. Confirm there is a workable rollback package before updating.
5. Confirm the app path and `pm2 describe crafts-a1` as ubuntu. Resolve unexpected script/cwd/process names before stopping anything. Do not use sudo for the ordinary PM2 app process.

### Checkout, dependencies and matching build

The following commands are for an authorised Ubuntu Bash session during S17. The interactive prompt requires a real tag that has already been created and transferred with its matching files; there is no placeholder ref to copy.

```bash
cd /home/ubuntu/apps/handmade-crafts-marketplace
git status --short
git fetch --tags origin
git tag --list --sort=-creatordate
read -r -p 'Verified final release tag: ' CRAFTS_RELEASE_TAG
git rev-parse --verify "refs/tags/${CRAFTS_RELEASE_TAG}^{commit}"
```

The working tree must be clean. Use a versioned transfer location such as `/home/ubuntu/releases/<actual-tag>/`; the directory and matching final files must be prepared during S17. Verify the checksum there before changing the running app. The actual archive name, tag and source-sha filename must agree.

Stop only the verified application process before changing source/build. Then perform the following as ubuntu, using the real verified tag from that session:

```bash
pm2 stop crafts-a1
git checkout --detach "refs/tags/${CRAFTS_RELEASE_TAG}"
git rev-parse HEAD
npm ci --prefix backend --omit=dev
```

Compare HEAD to the transferred source-sha text. Extract the archive into a temporary staging directory, inspect that entries are confined to build/, and verify staged release.json matches the chosen tag and commit. Retain the previous build before replacing frontend/build with the staged directory. Preserve backend/.env and database records. Use a same-filesystem rename where practical; do not overlay a new bundle onto an unchecked mixture of old assets.

Before restarting the managed app, run the new backend in the foreground with production mode and the approved port. If the approved port remains 5001:

```bash
NODE_ENV=production PORT=5001 npm start --prefix backend
```

In another Ubuntu terminal, verify health, release metadata, Product reads and API/private-path boundaries. Complete the required externally accessible workflows from an approved client. Stop the foreground process before giving the port back to PM2.

### PM2 and external acceptance

For the previously verified existing crafts-a1 process, restart with the intended environment:

```bash
NODE_ENV=production PORT=5001 pm2 restart crafts-a1 --update-env
pm2 save
pm2 status
systemctl is-enabled pm2-ubuntu
```

Only use these values when the existing process and approved port were confirmed. On a genuine first setup with no such process, start backend/server.js with an explicit absolute script/cwd and one process name, then save it; do not run both first-setup and restart paths.

`pm2 startup` prints a host-specific command that may require sudo. Use the actual generated command only when the approved host needs startup setup. Do not copy a stale Node binary path or run a second root-owned PM2 application. Recheck the startup mechanism if the Node path changes.

PM2 online proves process state. A saved process list plus startup enabled supports recovery setup; a real process restart and an EC2 reboot recovery test are separate evidence. Do not claim an OS reboot test unless it actually occurred and was allowed.

Record the current external URL, timestamp, tag/commit, served build identity, both workflows, important denied/error paths and authorised account screenshots. An EC2 loopback 200 does not prove external access. A healthy API does not prove that the browser loaded the intended bundle. University shutdown and dynamic-address arrangements require a marking-window availability plan.

## 6. Rollback procedure — S17 contingency

Rollback is an operational recovery action, not a database reset:

1. Select the previous verified tag and matching static package; check the checksum and source identity.
2. Stop only crafts-a1 (and any foreground process started for this application).
3. Checkout that tag, install its compatible backend runtime dependencies on Ubuntu, and restore its matching build through staging.
4. Preserve private env and all database records. Do not use git clean -fdx, dropDatabase or unscoped deletion as deployment steps.
5. Start/verify the old version in the foreground, then restore the single PM2 process and save its configuration.
6. Verify readiness, served metadata and the workflows that version actually supports; record the reason, chosen version, timing and remaining limitations.

If the only previous deployed version is the S11 trial, rollback restores WF1 and removes Order UI/API access. Existing Orders remain in MongoDB. That fallback does not meet final two-workflow submission scope; repair/release the intended application before claiming final acceptance.

## 7. Evidence and known limits

Retain actual source/build IDs, environment/OS versions, safe configuration booleans, installation/build output, source-linked HTTP/browser results, before/after persistence checks, fixture cleanup, archive manifest/checksum and review links. Fresh S16 records live outside the app repo unless explicitly added later as a separate records commit. That records commit must not be confused with the candidate's tested source.

Jira HM-66 remains open until its full release/deployment acceptance is met. Native design/prototype playback, platform-username screenshots, Postman Desktop captures and formal iteration review are tracked separately; production preparation does not establish them.

Requests take no payment and reserve no stock. No server-side idempotency, general Product edit-version protocol, cancel/refund/reopen or server JWT revocation is added. Product snapshot read and Order insertion are not globally serialised with concurrent Product edits/archive. Retain accurate starter provenance and actual development-assistance disclosure.
