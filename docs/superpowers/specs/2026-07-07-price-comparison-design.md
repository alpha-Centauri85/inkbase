# Phase 3a: Price Comparison — Design

## Context

This is the first of Phase 3's two feature-enrichment sub-projects (the
other, condition photos, is a separate spec). Today, books uploaded to
Shopify via Single Scan or Manual Entry get no price at all — the variant
is created with whatever Shopify's default is (effectively $0.00). This
feature adds an on-demand "Check price" lookup against comparable listings
via SerpApi's Google Shopping engine, and a price field that's included in
the Shopify upload.

The user already has a SerpApi account and API key.

## Scope

- **In scope:** Single Scan and Manual Entry, both of which have a
  per-book review/entry step before submission.
- **Out of scope:** Batch Scan. It has no per-item review UI today (it
  auto-processes bare ISBNs straight through for speed), and adding pricing
  there would require adding a review step that doesn't otherwise exist —
  a bigger, separate change not requested here. Batch-uploaded products
  continue to have no price, same as today.

## Architecture

A new shared `PriceCheck` component (price input + "Check price" button +
inline results list) is used by both `SingleScanPanel` and
`ManualEntryPanel`. Clicking "Check price" calls a new backend endpoint,
`GET /api/price-check?title=...&author=...`, which queries SerpApi's
Google Shopping engine **twice** — once scoped to NZ (`gl=nz`,
`google_domain=google.co.nz`) and once to AU (`gl=au`,
`google_domain=google.com.au`) — and returns the top 3 results from each
market (up to 6 total), each labeled with its currency (NZD/AUD). Results
render as a simple inline list — not a modal/popover overlay, matching the
app's existing lightweight style (no modals appear anywhere else in the
app). Clicking a result fills the price field with just the numeric value
(currency label is for context only, not stored); the field can also be
typed into directly at any time.

Price is **per-book data**, unlike the existing Custom Blurb / Book Size
fields, which apply as a single shared value across an entire upload batch.
Price is tracked per book in `SingleScanPanel`'s local review state, and as
a new field on each Manual Entry form/queue item, then included per-book in
the existing upload requests to `/upload-books` and `/api/manual`.

## Components

- **`frontend/src/components/PriceCheck.jsx`** (new, shared): controlled
  component with props `{ price, onPriceChange, title, author }`. Renders a
  price `<input>` plus a "Check price" button. Manages its own
  `checking` / `results` / `error` state internally — this is UI-local
  state, not lifted to the parent panel. On click, calls a new
  `checkPrice({ title, author })` helper. Renders up to 6 results (3 NZD +
  3 AUD) as rows like `$12.50 NZD — Trade Me`; clicking a row calls
  `onPriceChange(price)` with just the numeric value. Shows "No comparable
  listings found" or an inline error message on failure — the price field
  always stays directly editable regardless of lookup outcome.
- **`frontend/src/lib/api.js`** (modified): add
  `checkPrice({ title, author }): Promise<{ results: {price, currency, source}[] }>`,
  calling `GET /api/price-check?title=...&author=...` via the existing
  `getJSON` helper.
- **`frontend/src/pages/SingleScanPanel.jsx`** (modified): adds a `price`
  state (string, e.g. `"12.50"`), renders `<PriceCheck>` in the book-review
  area near `AddOnsPanel`, includes `price` in the book object passed to
  `uploadSingleBook`.
- **`frontend/src/pages/ManualEntryPanel.jsx`** (modified): adds a `price`
  form field alongside Title/Author/Genre/Description, with its own
  `<PriceCheck>` driven by the currently-typed Title/Author. Price is saved
  onto each queued item (`item.price`) and included in `QueueList`'s
  existing `renderSub` string (e.g. appending `• $12.50` after genre) — no
  changes needed to `QueueList.jsx` itself, since it just renders whatever
  string `renderSub` returns.
- **`backend/server.mjs`** (modified):
  - New `GET /api/price-check?title=&author=` route calling SerpApi twice
    (NZ + AU) and merging the results.
  - New `SERPAPI_KEY` env var (same pattern as the existing
    `GOOGLE_BOOKS_API_KEY`): read once at startup, a startup warning logged
    if missing (not a fatal exit, same as the other optional keys).
  - `/upload-books` and `/api/manual` extended to read an optional
    `price` / `item.price` field and pass it into the existing
    `variantUpdateMutation` call (which already sets `barcode` and `sku`
    on the same mutation) as a third optional field.

## Data Flow

**Price lookup:**
1. User has a Title + Author available (from a successful Single Scan
   lookup, or typed into the Manual Entry form).
2. User clicks "Check price".
3. Frontend calls `GET /api/price-check?title=...&author=...`.
4. Backend makes two parallel calls to SerpApi's `google_shopping` engine
   with `q={title} {author}`, using `SERPAPI_KEY`:
   - NZ: `gl=nz`, `google_domain=google.co.nz`
   - AU: `gl=au`, `google_domain=google.com.au`
5. From each response, backend extracts the top 3 entries from
   `shopping_results` as `{ price, currency, source }` (`currency` is set
   by the backend based on which call produced the result — `"NZD"` or
   `"AUD"` — not parsed from SerpApi's price string). Both sets are
   concatenated (NZ results first, then AU) into one `results` array of up
   to 6 entries and returned as `{ results: [...] }`. If one market's call
   fails while the other succeeds, the successful market's results are
   still returned (see Error Handling).
6. `PriceCheck` renders the results; clicking one fills the price field
   with the numeric value only.

**Price submission:**
1. On "Submit to Shopify" (Single Scan) or "Upload Manual List" (Manual
   Entry), the current price value for each book travels alongside the
   existing fields (`isbn`, `title`, `author`, etc.) in the same request
   shape already used today.
2. Backend's `/upload-books` and `/api/manual` routes pass `price` into the
   same `variantUpdateMutation` call that already sets `barcode`/`sku`.
3. If a price was entered, the Shopify variant gets that price. If left
   blank, the `price` key is omitted from the mutation input entirely and
   Shopify's own default applies (no hard-coded `$0.00`).

## Error Handling

- **Missing `SERPAPI_KEY`**: `/api/price-check` returns HTTP 500 with a
  clear error message (`"Missing SERPAPI_KEY. Set it in backend/.env."`),
  mirroring the existing `SHOPIFY_ADMIN_TOKEN` missing-key pattern.
  `PriceCheck` shows this message inline; the price field remains
  manually editable.
- **SerpApi network/API failure** (rate limit, timeout, malformed
  response): each of the two market calls (NZ/AU) is handled
  independently. If both fail, the endpoint returns a clean
  `{ error: "..." }` message with an appropriate non-200 status. If only
  one fails, the endpoint still returns HTTP 200 with whatever results the
  successful market produced (possibly an empty array for the failed
  market) — a single market's outage never blocks the other's results.
  Either way, this never crashes the request or blocks manual price
  entry/submission.
- **Zero results**: returned as `{ results: [] }` (success, not an error);
  `PriceCheck` shows "No comparable listings found" — an expected, normal
  outcome for obscure or self-published titles.
- **Price value on submit**: an empty price field is sent as `null` (or
  the key omitted) rather than `0`, so `variantUpdateMutation`'s input
  simply excludes `price` when none was entered.

## Testing

No automated test suite exists in this project (established in Phase 1)
and this feature does not introduce one. Verification is manual:
- "Check price" against the real SerpApi key for a well-known, popular book
  — should return up to 6 results (3 NZD + 3 AUD) with price + currency +
  seller.
- "Check price" for an obscure/fabricated title — should show "No
  comparable listings found".
- Temporarily unset `SERPAPI_KEY`, confirm the missing-key error displays
  and the price field is still directly editable.
- Submit a book with a manually-entered price (Single Scan and Manual
  Entry) and confirm the resulting Shopify draft product's variant shows
  that price.
- Submit a book with the price field left blank and confirm the resulting
  variant has no price forced to `$0.00` beyond Shopify's own default.

## Out of Scope

- Batch Scan pricing (see Scope section above).
- Caching of price-check results — each click is a fresh SerpApi call.
- Automatic/background price-checking on every scan — on-demand button
  only, to control SerpApi usage/cost.
- Currency conversion logic — NZ and AU results are shown side by side,
  each labeled with its own currency; no conversion between NZD and AUD is
  performed anywhere in the flow.
