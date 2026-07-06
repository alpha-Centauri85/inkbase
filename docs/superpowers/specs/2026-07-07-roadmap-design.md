# Book Scanner App — Roadmap Design

## Context

Book Scanner is a local tool for cataloguing used books: scan an ISBN, look up
metadata via Google Books, review it, and upload a DRAFT product to Shopify.
No database is used or needed — the only persisted state is a small amount of
`localStorage` data in the browser (batch queue, manual queue, saved default
blurb text).

Current state:
- **Backend**: `backend/server.mjs`, a single 434-line Express file. Handles
  Shopify OAuth bootstrap and two working routes: `POST /upload-books`
  (single/batch-by-array) and `POST /api/manual`.
- **Frontend**: `frontend/index.html`, a single 944-line file with inline
  CSS/JS, three tabs (Single Scan, Batch Scan, Manual Entry).
- **Dead code**: `.venv/` (unused empty Python venv) and `shopify-uploader/`
  (empty scaffold, package.json only, no source).
- **No version control** exists on the project at all.
- **Security issue**: `backend/.env` and `backend/Server start sequence.txt`
  contain live plaintext Shopify secrets (admin token, client secret, client
  ID).
- **Known bug**: the Batch Scan tab's upload button calls `POST /api/batch`,
  which does not exist on the backend — batch upload is currently broken.

Goal: make the frontend a lot nicer, enrich it with new features, and clean up
the codebase. This roadmap sequences that into three phases, each de-risking
the next.

## Phase 1: Foundation & Cleanup

**Why first:** version control and secret hygiene should exist before any
further changes accumulate, and the dead code / broken route should be
cleared out before the redesign touches the same files.

- `git init` in the project root; create a **private GitHub repository** and
  push the initial commit.
- Add `.gitignore` covering `node_modules/`, `backend/.env`, `.venv/`,
  `.superpowers/`.
- Delete `.venv/` and `shopify-uploader/` — both are unused dead weight with
  no source code depending on them.
- **Auto-persist OAuth tokens**: update the `/auth/callback` handler in
  `server.mjs` to write the newly-obtained `SHOPIFY_ADMIN_TOKEN` directly
  into `backend/.env` (and update the in-memory `SHOPIFY_ADMIN_TOKEN`
  variable) instead of just logging it to the console for manual copy-paste.
  This removes the manual step that caused the token to end up duplicated in
  plaintext in `Server start sequence.txt` in the first place.
- **Rotate Shopify credentials**: revoke the current `SHOPIFY_ADMIN_TOKEN`
  and `SHOPIFY_CLIENT_SECRET` from the Shopify admin/partner dashboard,
  delete the plaintext token from `backend/Server start sequence.txt`, then
  re-run `/auth` once (manually, via URL — the Phase 2 UI button is a nicer
  front-end for this same endpoint) to mint and auto-persist a fresh token
  using the updated callback above. `.env` stays local-only and gitignored
  going forward.
- Add a `GET /auth/status` endpoint returning whether a valid token is
  currently configured, so the frontend can show connection state (used by
  the Phase 2 "Connect to Shopify" button).
- **Fix the batch upload bug**: add a `POST /api/batch` route to
  `server.mjs`. It should accept `{ items: [...] }` (matching what the
  frontend already sends), and reuse the existing `buildDescriptionHtml` /
  `shopifyGraphQL` helpers and `productCreate` + variant-update mutation
  pattern already used by `/api/manual`.

## Phase 2: Frontend Redesign

**Why second:** a nicer UI is the top-requested outcome, and doing it after
Phase 1 means it's built on clean, version-controlled ground with no lurking
dead code.

- Replace `frontend/index.html` with a Vite + React app under `frontend/`.
- Component breakdown (one clear purpose each):
  - `TabNav` — switches between Single / Batch / Manual, manages focus
    handoff to the active panel's primary input (matches current behavior).
  - `ScanInput` — barcode/ISBN input with the existing Enter-or-timeout
    submit behavior (`SCAN_DONE_DELAY_MS`).
  - `BookCard` — displays fetched book metadata (title, author, ISBN, genre,
    publisher, published date, description).
  - `AddOnsPanel` — custom blurb textarea (persisted default, synced across
    tabs) + book size radio group.
  - `BatchQueue` — batch scan list with per-item status (pending/uploading/
    ok/failed), dedupe toggle, upload/clear actions. Backed by
    `localStorage`.
  - `ManualEntryForm` — manual add form + manual queue list, same
    status/upload/clear pattern as `BatchQueue`.
  - `SubmitStatus` — inline status/result messaging shared by Single Scan
    submissions.
  - `ShopifyConnectButton` — shown in the header; checks `GET /auth/status`
    on load, shows connected/not-connected state, and opens `/auth` (the
    OAuth consent flow) when clicked if not connected. Removes the need to
    manually visit a URL to (re)authenticate.
- Preserve all existing behavior 1:1 during the rewrite: Google Books lookup
  on scan, `localStorage`-backed batch/manual queues (`batch_scans_v1`,
  `manual_list_v1`), default-blurb persistence and cross-tab sync
  (`default_custom_blurb_v1`), ISBN normalization/text-cleanup helpers.
- Visual style: **Warm Bookshop** — cream background (`#fdfbf7`), serif
  headings (Georgia), muted brown/tan accent palette (`#b5834a` primary,
  `#e8e1d3` borders), light borders rather than heavy drop shadows. Matches
  the approved mockup.
- Build step: `npm run dev` for local development (hot reload); `npm run
  build` produces static output servable the same way as today (`npx serve`
  in `start-book-scanner.bat`, with its path updated to point at the Vite
  build output directory, e.g. `frontend/dist`).

## Phase 3: Feature Enrichment

**Why third:** both features below extend the Shopify upload flow, so they
land more easily once that flow lives in clean, componentized frontend code
plus a fixed/complete backend route set from Phase 1.

### Condition photos

- Add a photo capture/upload control to Single Scan and Manual Entry,
  accepting camera capture or file picker input, 1–3 images per book.
- On submit, images are sent to the backend and uploaded to the Shopify
  DRAFT product via the Admin API `productCreateMedia` mutation, run right
  after the existing `productCreate` call for that book.
- Backend: extend `/upload-books`, `/api/manual`, and the new `/api/batch`
  to accept image data (base64-encoded in the JSON body, consistent with the
  existing request shape) and perform the media-attach mutation per book
  after product creation.
- Net effect: when you open a draft product in Shopify admin to review it,
  the condition photos are already attached — review becomes "check and
  publish" rather than "check, then separately go find and upload photos."

### Price comparison (on-demand)

- Add a **price field** to the book review UI in Single Scan and Manual
  Entry — currently no price is set at all when a product is created.
- Add a "Check price" button next to each reviewed book. It calls a new
  backend endpoint, e.g. `GET /api/price-check?isbn=...&title=...`, which
  queries **SerpApi's Google Shopping API** and returns 3–5 comparable
  listings with prices.
- Frontend displays the results in a small popover/list; selecting one (or
  typing a custom value) fills the price field.
- The price field's value is included in the `productCreate` /
  `productVariantsBulkUpdate` calls so the Shopify variant gets a real price.
- The lookup is **on-demand only** (button click), not automatic per scan,
  to avoid spending API quota/cost on books that might get rejected or whose
  price is already known.
- New `SERPAPI_KEY` env var stored in `backend/.env`, alongside the existing
  Shopify secrets (already gitignored per Phase 1).

## Error Handling

- All new backend routes (`/api/batch`, `/api/price-check`, media-attach
  calls) follow the existing pattern in `server.mjs`: catch per-item errors,
  return partial success results (`{ ok: false, error }` per item) rather
  than failing the whole batch — consistent with `/upload-books` and
  `/api/manual` today.
- SerpApi failures degrade gracefully: if the price-check call fails or
  returns no results, the UI shows an inline error and the price field
  remains manually editable — it never blocks submission to Shopify.
- Photo upload failures are reported per-book (matching the existing
  results-array pattern) without blocking the rest of a batch.

## Testing

- No automated test suite exists today; this roadmap does not introduce one.
  Verification is manual: exercise each tab's flow end-to-end against a real
  (rotated) Shopify dev store after each phase, matching how the project has
  been validated so far.
- Phase 1's `/api/batch` fix should be manually verified against the actual
  Batch Scan tab before moving to Phase 2.
- Phase 2's rewrite should be checked screen-by-screen against the current
  `index.html` behavior to confirm no regressions before Phase 3 features are
  layered on.

## Out of Scope

- No database — confirmed not needed; `localStorage` remains the only
  client-side persistence.
- No automated test suite (not requested; revisit if the app grows further).
- No multi-user/auth system — this remains a single-operator local tool.
- Session history/dashboard and duplicate-listing detection were considered
  for Phase 3 and explicitly deferred (not selected).
