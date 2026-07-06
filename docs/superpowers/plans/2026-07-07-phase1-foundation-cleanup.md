# Phase 1: Foundation & Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Book Scanner App under version control, remove dead code and exposed secrets, and fix the broken batch-upload route, so Phases 2 and 3 build on clean ground.

**Architecture:** No architectural change — this phase is git setup, deletion of unused directories/files, and two additive changes to the existing single-file Express backend (`backend/server.mjs`): a new `/api/batch` route that mirrors the existing `/api/manual` pattern (with server-side Google Books lookup, since the Batch tab only sends bare ISBNs), and an auto-persisting OAuth callback.

**Tech Stack:** Node.js (ESM, `type: "module"`), Express 5, native `fetch`, `dotenv`, git, GitHub CLI (`gh`).

## Global Constraints

- No automated test suite exists or is being introduced — verification in this plan is manual (curl / running the server), matching the spec's Testing section.
- `backend/.env` must never be committed to git (contains live Shopify secrets).
- Existing endpoints (`/upload-books`, `/api/manual`, `/health`, `/shopify-test`, `/_routes`, `/auth`, `/auth/callback`) must keep working exactly as before — this phase only adds to `server.mjs`, it does not change existing route behavior except the two callback changes described in Task 4.
- Max batch size is 50 items per request, matching the existing limit in `/upload-books` and `/api/manual`.

---

### Task 1: Git init, `.gitignore`, first commit

**Files:**
- Create: `.gitignore` (project root: `C:\Users\leesa\OneDrive - Marque Group Solutions\Personal\BookScannerApp\.gitignore`)

**Interfaces:** None — this task has no code interfaces, only repo state.

- [ ] **Step 1: Create `.gitignore`**

```
node_modules/
backend/.env
.venv/
.superpowers/
```

- [ ] **Step 2: Initialize the repo**

Run (from the project root):
```bash
git init
```
Expected: `Initialized empty Git repository in .../BookScannerApp/.git/`

- [ ] **Step 3: Verify `.env` is excluded**

Run:
```bash
git status --porcelain
```
Expected: output does NOT contain `backend/.env`, `.venv/`, or `node_modules/` paths. It should list `.gitignore`, `backend/`, `frontend/`, `docs/`, `package.json`, `package-lock.json`, `start-book-scanner.bat`, `shopify-uploader/` as untracked.

- [ ] **Step 4: Stage and commit everything except gitignored paths**

```bash
git add .gitignore backend frontend docs package.json package-lock.json start-book-scanner.bat shopify-uploader
git status --porcelain
```
Expected: staged list does NOT include `backend/.env`. If it does, stop — do not commit — and re-check `.gitignore` for a typo before proceeding.

```bash
git commit -m "Initial commit"
```
Expected: a commit is created; `git log --oneline -1` shows it.

---

### Task 2: Remove dead code and the secret-exposing file

**Files:**
- Delete: `.venv/` (entire directory)
- Delete: `shopify-uploader/` (entire directory)
- Delete: `backend/Server start sequence.txt`

**Interfaces:** None.

- [ ] **Step 1: Confirm these paths have no code depended on elsewhere**

Run:
```bash
grep -rl "shopify-uploader" --include="*.js" --include="*.mjs" --include="*.json" --include="*.html" --include="*.bat" . 2>/dev/null | grep -v node_modules
```
Expected: no output (nothing references `shopify-uploader/`).

```bash
grep -rl "\.venv" --include="*.js" --include="*.mjs" --include="*.json" --include="*.html" --include="*.bat" . 2>/dev/null | grep -v node_modules
```
Expected: no output.

- [ ] **Step 2: Delete the directories and file**

```bash
rm -rf .venv shopify-uploader "backend/Server start sequence.txt"
```

- [ ] **Step 3: Verify removal**

```bash
ls -la
ls backend
```
Expected: `.venv` and `shopify-uploader` are gone from the root listing; `Server start sequence.txt` is gone from `backend/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git status --porcelain
```
Expected: shows deletions (`D`) for the removed paths, and no `backend/.env` entry.

```bash
git commit -m "Remove unused .venv, empty shopify-uploader scaffold, and plaintext secret file"
```

---

### Task 3: Push to a private GitHub repository

**Files:** None.

**Interfaces:** None.

- [ ] **Step 1: Create the private repo and push using `gh`**

```bash
gh repo create BookScannerApp --private --source=. --remote=origin
```
Expected: output confirms repo creation and shows the new repo URL (e.g. `https://github.com/<your-username>/BookScannerApp`).

- [ ] **Step 2: Push the current branch**

```bash
git branch -M main
git push -u origin main
```
Expected: push succeeds; output ends with something like `branch 'main' set up to track 'origin/main'.`

- [ ] **Step 3: Verify**

```bash
git remote -v
```
Expected: `origin` listed with the GitHub URL for both fetch and push.

No commit step here — nothing changed locally, this task only sets up the remote.

---

### Task 4: Fix the broken batch upload route (`/api/batch`)

**Context:** The frontend's Batch Scan tab (`frontend/index.html`) only accumulates bare `{ isbn, scannedAt }` pairs — it does not fetch book metadata client-side (unlike Single Scan). It then `POST`s to `/api/batch` with `{ items: [{ isbn, scannedAt }, ...] }`, expecting back `{ results: [{ isbn, ok, error? }, ...] }`. That route does not exist on the backend today (only `/upload-books` and `/api/manual` exist), so batch upload always fails. This task adds it, including a server-side Google Books lookup per ISBN (since the frontend didn't do one).

**Files:**
- Modify: `backend/server.mjs` (insert a new route after the existing `/api/manual` route, i.e. after line 400, before the `// Diagnostics` comment at line 402)

**Interfaces:**
- Consumes: `buildDescriptionHtml({ synopsis, customBlurb, bookSize })` (existing, `backend/server.mjs:84-92`), `shopifyGraphQL(query, variables)` (existing, `backend/server.mjs:117-140`), the existing `variantUpdateMutation` string (`backend/server.mjs:54-61`).
- Produces: `POST /api/batch` — request body `{ items: [{ isbn: string, scannedAt: string }] }`; response body `{ count: number, results: [{ ok: boolean, isbn: string, title?: string, product?: object, userErrors?: array, variantUpdate?: object, rawErrors?: array, error?: string }] }`.

- [ ] **Step 1: Manually verify the route is currently missing**

With the backend running (`cd backend && npm start` in one terminal), in another terminal run:
```bash
curl -s -X POST http://localhost:3000/api/batch -H "Content-Type: application/json" -d "{\"items\":[{\"isbn\":\"9780743273565\",\"scannedAt\":\"2026-07-07T00:00:00.000Z\"}]}"
```
Expected: `Cannot POST /api/batch` (Express 404 HTML/JSON) — confirming the route doesn't exist yet.

- [ ] **Step 2: Add a Google Books lookup helper and the `/api/batch` route**

In `backend/server.mjs`, insert the following immediately after the `/api/manual` route's closing `});` (after line 400, before the `// ------------------------------------------------------------\n// Diagnostics` block):

```javascript
// ------------------------------------------------------------
// Batch upload (bare ISBNs -> Google Books lookup -> Shopify)
// ------------------------------------------------------------

async function fetchGoogleBooksByIsbn(isbn) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Books HTTP ${res.status}`);

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  const v = item.volumeInfo || {};
  return {
    isbn,
    title: (v.title || "").trim(),
    author: (v.authors && v.authors.join(", ")) || "",
    genre: (v.categories && v.categories.join(", ")) || "",
    description: v.description || "",
  };
}

app.post("/api/batch", async (req, res) => {
  const items = req.body?.items;

  const customBlurb = req.body?.customBlurb || "";
  const bookSize = req.body?.bookSize || "";

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "Expected JSON body: { items: [...] }" });
  }
  if (items.length > 50) {
    return res.status(400).json({ error: "Max 50 books per batch (for now)." });
  }

  const mutation = `
    mutation CreateProduct($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
          variants(first: 1) {
            nodes { id }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const results = [];

  for (const rawItem of items) {
    const isbn = (rawItem.isbn || "").trim();

    if (!isbn) {
      results.push({ ok: false, isbn, error: "Missing isbn" });
      continue;
    }

    let book;
    try {
      book = await fetchGoogleBooksByIsbn(isbn);
    } catch (err) {
      results.push({ ok: false, isbn, error: `Book lookup failed: ${err.message}` });
      continue;
    }

    if (!book || !book.title) {
      results.push({ ok: false, isbn, error: "No book found for that ISBN" });
      continue;
    }

    const descriptionHtml = buildDescriptionHtml({
      synopsis: book.description,
      customBlurb,
      bookSize,
    });

    const input = {
      title: book.title,
      vendor: book.author,
      productType: book.genre,
      descriptionHtml,
      tags: ["Book", "Used"].concat(book.genre ? [book.genre] : []),
      status: "DRAFT",
    };

    try {
      const { status, json } = await shopifyGraphQL(mutation, { input });

      const userErrors = json?.data?.productCreate?.userErrors || [];
      const product = json?.data?.productCreate?.product || null;
      const variantId = product?.variants?.nodes?.[0]?.id || null;

      let variantUpdate = null;
      if (product && variantId) {
        const vRes = await shopifyGraphQL(variantUpdateMutation, {
          productId: product.id,
          variants: [{ id: variantId, barcode: isbn, sku: `BOOK-${isbn}` }],
        });
        variantUpdate = vRes.json;
      }

      results.push({
        ok: status === 200 && userErrors.length === 0 && Boolean(product),
        isbn,
        title: book.title,
        product,
        userErrors,
        variantUpdate,
        rawErrors: Array.isArray(json?.errors) ? json.errors : [],
      });
    } catch (err) {
      results.push({ ok: false, isbn, title: book.title, error: err.message });
    }
  }

  res.json({ count: items.length, results });
});
```

- [ ] **Step 3: Restart the backend and re-run the manual check**

```bash
curl -s -X POST http://localhost:3000/api/batch -H "Content-Type: application/json" -d "{\"items\":[{\"isbn\":\"9780743273565\",\"scannedAt\":\"2026-07-07T00:00:00.000Z\"}]}"
```
Expected: JSON response with `"count":1` and a `results` array containing one entry with `"isbn":"9780743273565"` and `"title":"The Great Gatsby"` (or similar — this ISBN is a real published book). If `SHOPIFY_ADMIN_TOKEN` is not yet valid/rotated, `ok` may be `false` with a Shopify auth error in `rawErrors`/`userErrors` — that's expected until Task 6 (credential rotation) is done; the important thing to verify here is that the route exists, the Google Books lookup worked, and the response shape matches what the frontend expects (`count`, `results[].isbn`, `results[].ok`).

- [ ] **Step 4: Verify existing routes still work (no regression)**

```bash
curl -s http://localhost:3000/_routes
```
Expected: output now includes `POST /api/batch` alongside the previously existing routes (`GET /`, `GET /auth`, `GET /auth/callback`, `POST /api/manual`, `POST /upload-books`, `GET /shopify-test`, `GET /health`, `GET /_routes`).

- [ ] **Step 5: Commit**

```bash
git add backend/server.mjs
git commit -m "Add missing /api/batch route with server-side Google Books lookup"
```

---

### Task 5: Auto-persist OAuth tokens and add `/auth/status`

**Context:** Today, `/auth/callback` only logs the new access token to the console; you have to copy it out of the terminal and paste it into `backend/.env` by hand. That manual step is what caused the token to also get pasted into `backend/Server start sequence.txt` (removed in Task 2) as a plaintext backup. This task makes the callback write the token straight into `backend/.env` and adds a small status endpoint the Phase 2 frontend will use to show connection state.

**Files:**
- Modify: `backend/server.mjs`
  - Add an import near the top (after line 25, `import crypto from "crypto";`)
  - Modify the `/auth/callback` handler (currently `backend/server.mjs:177-208`)
  - Add a new `/auth/status` route (insert after the modified `/auth/callback` route, before the `// ------------------------------------------------------------\n// Routes: Shopify operations` comment at line 210)

**Interfaces:**
- Consumes: `SHOPIFY_ADMIN_TOKEN` (existing mutable `let` binding, `backend/server.mjs:46`).
- Produces: `GET /auth/status` — response `{ connected: boolean }`. Updates `backend/.env` in place on successful OAuth callback.

- [ ] **Step 1: Manually verify current behavior (no auto-persist)**

Read the current callback code:
```bash
grep -n "SHOPIFY_ADMIN_TOKEN =" backend/server.mjs
```
Expected: only one match, inside the callback body assigning to a local `const accessToken`, not writing to `backend/.env` — confirming there is no persistence today (the global `SHOPIFY_ADMIN_TOKEN` binding is `let` and never reassigned anywhere yet).

- [ ] **Step 2: Add the `fs` import**

In `backend/server.mjs`, change line 25 from:
```javascript
import crypto from "crypto";
```
to:
```javascript
import crypto from "crypto";
import fs from "fs";
```

- [ ] **Step 3: Add an `.env` update helper**

Add this function immediately after the `shopifyGraphQL` function (after its closing `}` at line 140, before the `// ------------------------------------------------------------\n// OAuth bootstrap` comment at line 142):

```javascript
function persistAdminTokenToEnvFile(token) {
  const envPath = new URL("./.env", import.meta.url);
  let contents = "";
  try {
    contents = fs.readFileSync(envPath, "utf8");
  } catch {
    contents = "";
  }

  const line = `SHOPIFY_ADMIN_TOKEN=${token}`;
  const pattern = /^SHOPIFY_ADMIN_TOKEN=.*$/m;

  if (pattern.test(contents)) {
    contents = contents.replace(pattern, line);
  } else {
    contents = contents.length && !contents.endsWith("\n") ? `${contents}\n${line}\n` : `${contents}${line}\n`;
  }

  fs.writeFileSync(envPath, contents, "utf8");
}
```

- [ ] **Step 4: Wire the helper into `/auth/callback` and add `/auth/status`**

In `backend/server.mjs`, replace the `/auth/callback` handler (lines 177-208) with:

```javascript
app.get("/auth/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || state !== pendingState) {
    return res.status(400).send("Invalid OAuth callback (missing/invalid state).");
  }

  const tokenRes = await fetch(`https://${SHOPIFY_STORE}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  const tokenJson = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok) {
    return res.status(tokenRes.status).json(tokenJson);
  }

  const accessToken = tokenJson.access_token;

  SHOPIFY_ADMIN_TOKEN = accessToken;
  persistAdminTokenToEnvFile(accessToken);

  console.log("Shopify connected — token saved to backend/.env");

  res.send("OAuth complete. Token saved automatically — you can close this tab.");
});

app.get("/auth/status", (req, res) => {
  res.json({ connected: Boolean(SHOPIFY_ADMIN_TOKEN) });
});
```

- [ ] **Step 5: Restart the backend and verify `/auth/status`**

```bash
curl -s http://localhost:3000/auth/status
```
Expected: `{"connected":true}` if `.env` currently has a token, or `{"connected":false}` if not — either is fine, this just confirms the route responds correctly given current state.

- [ ] **Step 6: Verify existing routes still work (no regression)**

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/_routes
```
Expected: `{"ok":true}` from `/health`; `/_routes` output now also includes `GET /auth/status`.

- [ ] **Step 7: Commit**

```bash
git add backend/server.mjs
git commit -m "Auto-persist OAuth token to .env and add /auth/status endpoint"
```

---

### Task 6: Rotate Shopify credentials (manual, operator action)

**Context:** This task cannot be scripted — it requires logging into the Shopify partner/admin dashboard with your own credentials. Do this last, after Tasks 4 and 5 are committed, so the fresh token benefits from the auto-persist behavior.

**Files:** `backend/.env` (updated automatically by the flow below, not hand-edited).

- [ ] **Step 1: Revoke the current credentials**

In the Shopify Partner Dashboard (or the store's Admin → Settings → Apps and sales channels → Develop apps, depending on how this app was set up), find the app tied to `SHOPIFY_CLIENT_ID=aa06ed5eb784aeccc30e4475ff661e75` and revoke/regenerate its client secret, and uninstall/reinstall or revoke the existing access token if the UI offers that option.

- [ ] **Step 2: Update `backend/.env` with the new client secret (if it changed)**

If Shopify issued a new `SHOPIFY_CLIENT_SECRET`, edit `backend/.env` by hand to update that one line (this is the only secret still requiring manual entry — the admin token itself will be handled automatically in the next step).

- [ ] **Step 3: Restart the backend and re-run OAuth**

```bash
cd backend
npm start
```
Then visit `http://localhost:3000/auth` in a browser, approve the requested scopes, and let it redirect through `/auth/callback`.
Expected: browser shows "OAuth complete. Token saved automatically — you can close this tab." and the terminal running the backend prints `Shopify connected — token saved to backend/.env`.

- [ ] **Step 4: Verify the new token works**

```bash
curl -s http://localhost:3000/auth/status
curl -s http://localhost:3000/shopify-test
```
Expected: `{"connected":true}`, and `/shopify-test` returns a JSON body with your shop's `name` and `myshopifyDomain` (confirms the new token authenticates successfully against the real Shopify Admin API).

- [ ] **Step 5: Confirm `.env` is still gitignored (no accidental commit of the new token)**

```bash
git status --porcelain
```
Expected: no output mentioning `backend/.env` (it should not appear as untracked or modified-and-staged, since it was already gitignored in Task 1).

No commit needed for this task — `.env` is intentionally never committed.
