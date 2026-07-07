# Phase 2: Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single 944-line `frontend/index.html` with a componentized Vite + React app in the "Warm Bookshop" visual style, preserving all existing scanning/upload behavior.

**Architecture:** A Vite-built React SPA with three always-mounted tab panels (Single Scan, Batch Scan, Manual Entry) toggled via CSS `display`, matching the original single-page-with-hidden-panels approach so in-progress state isn't lost on tab switch. Shared logic (ISBN normalization, Google Books lookup, backend API calls, localStorage persistence) lives in small `src/lib/*.js` modules; UI is decomposed into small presentational components (`TabNav`, `ScanInput`, `AddOnsPanel`, `BookCard`, `SubmitStatus`, `QueueList`, `ShopifyConnectButton`) composed by three page-level components (`SingleScanPanel`, `BatchScanPanel`, `ManualEntryPanel`).

**Tech Stack:** Vite 5, React 18, plain CSS (no CSS framework/preprocessor), native `fetch`, `localStorage`. No automated test framework — this project deliberately has none (see Phase 1 spec); verification throughout this plan is manual (a Node one-off check for pure logic, browser-based checks for UI/integration).

## Global Constraints

- No automated test suite/framework is being introduced. Pure-logic modules are verified with a throwaway Node script (deleted after verification, never committed). UI/integration behavior is verified manually against a running dev server and the real backend from Phase 1.
- Visual style is "Warm Bookshop": cream background (`#fdfbf7`), serif headings (Georgia), muted brown/tan accent (`#b5834a` primary, `#e8e1d3` borders), light borders rather than heavy drop shadows.
- All existing functional behavior must be preserved: ISBN normalization, Google Books lookup, `localStorage`-backed batch queue (`batch_scans_v1`) and manual queue (`manual_list_v1`), default-blurb persistence and cross-tab sync (`default_custom_blurb_v1`), tab-click focuses that tab's primary input.
- Backend base URL is `http://localhost:3000` (matches `API_BASE` in the current `frontend/index.html` and Phase 1's `backend/server.mjs`). Backend routes consumed: `POST /upload-books`, `POST /api/batch`, `POST /api/manual`, `GET /auth/status`, `GET /auth` (all from Phase 1, already implemented and committed).
- Deliberate simplification (recorded here, not a missing requirement): the old per-tab "Last scan" list under Single Scan's input (which only ever showed the single most recent scan) is dropped — `BookCard` immediately below already shows the same ISBN/title info, making the old list purely redundant.
- One clear responsibility per file; `src/lib/*.js` modules hold logic, `src/components/*.jsx` hold small reusable presentational pieces, `src/pages/*.jsx` hold the three tab panels that compose everything.

---

### Task 1: Vite/React scaffold, Warm Bookshop theme, static tab shell

**Files:**
- Create: `frontend/package.json` (overwrite — replaces the plain static-serve setup with a Vite project)
- Create: `frontend/vite.config.js`
- Create: `frontend/index.html` (overwrite — becomes the Vite entry point instead of the old inline app)
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/styles/theme.css`
- Create: `frontend/src/components/TabNav.jsx`

**Interfaces:**
- Produces: `TabNav({ tabs: {id, label}[], activeTab: string, onSelect: (id: string) => void })` — renders the tab bar; later tasks reuse this shape.
- Produces: CSS classes available globally via `theme.css`: `.hint`, `.muted`, `.error`, `.row`, `.card`, `.tabs`, `.tab-btn`, `.list`, `.item`, `.item-left`, `.radio-grid`, `button.primary`. Later components rely on these class names existing.

- [ ] **Step 1: Remove the old static frontend**

```bash
rm "frontend/index.html"
```

- [ ] **Step 2: Create `frontend/package.json`**

```json
{
  "name": "inkbase-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.1"
  }
}
```

- [ ] **Step 3: Create `frontend/vite.config.js`**

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8000,
  },
});
```

- [ ] **Step 4: Create the new `frontend/index.html` (Vite entry point)**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Inkbase</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `frontend/src/styles/theme.css`**

```css
:root {
  --ink-bg: #fdfbf7;
  --ink-border: #e8e1d3;
  --ink-accent: #b5834a;
  --ink-text: #3d2e1f;
  --ink-muted: #8a7a63;
}

* {
  box-sizing: border-box;
}

body {
  margin: 40px auto;
  padding: 0 16px;
  max-width: 820px;
  background: var(--ink-bg);
  color: var(--ink-text);
  font-family: Georgia, "Times New Roman", serif;
}

h1, h2, h3 {
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 600;
}

.hint {
  color: var(--ink-muted);
  margin-top: 6px;
  font-family: system-ui, sans-serif;
  font-size: 14px;
}

.muted {
  color: var(--ink-muted);
  font-size: 13px;
  font-family: system-ui, sans-serif;
}

.error {
  color: #a00;
  font-size: 12px;
  margin-top: 4px;
  font-family: system-ui, sans-serif;
}

input, textarea, button {
  font-size: 16px;
  font-family: system-ui, sans-serif;
}

input, textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--ink-border);
  border-radius: 4px;
  background: #fff;
  color: var(--ink-text);
}

textarea {
  min-height: 110px;
  resize: vertical;
}

button {
  padding: 8px 14px;
  border: 1px solid var(--ink-border);
  border-radius: 3px;
  background: #fff;
  color: var(--ink-text);
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.primary {
  background: var(--ink-accent);
  color: #fff;
  border-color: var(--ink-accent);
}

.row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 12px 0;
}

.row > * {
  flex: 1;
  min-width: 220px;
}

.card {
  background: #fff;
  border: 1px solid var(--ink-border);
  border-radius: 4px;
  padding: 14px;
  margin: 10px 0;
}

.tabs {
  display: flex;
  gap: 16px;
  margin: 16px 0;
  border-bottom: 1px solid var(--ink-border);
  padding-bottom: 8px;
  font-family: system-ui, sans-serif;
}

.tab-btn {
  padding: 0 0 6px 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--ink-muted);
  font-size: 13px;
  cursor: pointer;
}

.tab-btn[aria-selected="true"] {
  color: var(--ink-text);
  font-weight: 600;
  border-bottom-color: var(--ink-accent);
}

.list {
  list-style: none;
  padding: 0;
  margin: 12px 0 0 0;
  font-family: system-ui, sans-serif;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--ink-border);
  border-radius: 4px;
  margin-bottom: 8px;
  background: #fff;
}

.item-left {
  display: flex;
  flex-direction: column;
}

.radio-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(200px, 1fr));
  gap: 6px 16px;
  font-family: system-ui, sans-serif;
}

.radio-grid label {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

input[type="radio"], input[type="checkbox"] {
  width: auto;
  padding: 0;
  border: none;
}
```

- [ ] **Step 6: Create `frontend/src/components/TabNav.jsx`**

```jsx
export default function TabNav({ tabs, activeTab, onSelect }) {
  return (
    <div className="tabs" role="tablist" aria-label="Scanner modes">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className="tab-btn"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Create `frontend/src/App.jsx` (static placeholder panels for now)**

```jsx
import { useState } from "react";
import TabNav from "./components/TabNav.jsx";

const TABS = [
  { id: "single", label: "Single Scan" },
  { id: "batch", label: "Batch Scan" },
  { id: "manual", label: "Manual Entry" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("single");

  return (
    <div>
      <h1>Inkbase</h1>
      <div className="hint">Use tabs to switch between modes. Scanner focus stays on the active tab.</div>
      <TabNav tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />
      {activeTab === "single" && <div className="card">Single Scan panel coming soon.</div>}
      {activeTab === "batch" && <div className="card">Batch Scan panel coming soon.</div>}
      {activeTab === "manual" && <div className="card">Manual Entry panel coming soon.</div>}
    </div>
  );
}
```

- [ ] **Step 8: Create `frontend/src/main.jsx`**

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/theme.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: Install dependencies and run the dev server**

```bash
cd frontend
npm install
npm run dev
```
Expected: Vite prints a local URL (e.g. `http://localhost:8000/`).

- [ ] **Step 10: Manually verify in a browser**

Open the printed URL. Expected:
- Cream background, serif "Inkbase" heading, three tabs ("Single Scan", "Batch Scan", "Manual Entry") with the active tab underlined in the tan accent color.
- Clicking each tab shows that tab's placeholder card and underlines the clicked tab.

Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 11: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/index.html frontend/src
git commit -m "Scaffold Vite/React frontend with Warm Bookshop theme and static tab shell"
```

---

### Task 2: `lib/isbn.js` — ISBN and text normalization helpers

**Files:**
- Create: `frontend/src/lib/isbn.js`

**Interfaces:**
- Produces: `normalizeIsbn(raw: string): string`, `normalizeText(str: string): string` — consumed by `googleBooks.js` (Task 4), `SingleScanPanel` (Task 4), `BatchScanPanel` (Task 5), `ManualEntryPanel` (Task 6).

- [ ] **Step 1: Create `frontend/src/lib/isbn.js`**

```javascript
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(str) {
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, ent) => {
    if (ent[0] === "#") {
      const code =
        ent[1] === "x" || ent[1] === "X"
          ? parseInt(ent.slice(2), 16)
          : parseInt(ent.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[ent] ?? match;
  });
}

export function normalizeIsbn(raw) {
  return String(raw || "").toUpperCase().replace(/[^0-9X]/g, "");
}

export function normalizeText(str) {
  if (!str) return "";
  let s = str
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");
  s = decodeHtmlEntities(s);
  s = s.normalize("NFC");
  s = s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-");
  s = s
    .replace(/ /g, " ")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  s = s.replace(/�/g, "");
  return s;
}
```

- [ ] **Step 2: Write a throwaway verification script**

Create a temporary file `frontend/src/lib/_verify-isbn.mjs`:

```javascript
import assert from "node:assert/strict";
import { normalizeIsbn, normalizeText } from "./isbn.js";

assert.equal(normalizeIsbn("978-0-14-303943-3"), "9780143039433");
assert.equal(normalizeIsbn("x123abc"), "X123");
assert.equal(
  normalizeText("<p>Hello &amp; welcome</p><p>Line two</p>"),
  "Hello & welcome\n\nLine two"
);
assert.equal(normalizeText("Curly &#8216;quotes&#8217;"), "Curly 'quotes'");
assert.equal(normalizeText(""), "");

console.log("isbn.js checks passed");
```

- [ ] **Step 3: Run it and confirm it passes**

```bash
node frontend/src/lib/_verify-isbn.mjs
```
Expected: `isbn.js checks passed` with no assertion errors.

- [ ] **Step 4: Delete the throwaway script**

```bash
rm frontend/src/lib/_verify-isbn.mjs
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/isbn.js
git commit -m "Add ISBN and text normalization helpers"
```

---

### Task 3: `lib/api.js` + `ShopifyConnectButton`

**Files:**
- Create: `frontend/src/lib/api.js`
- Create: `frontend/src/components/ShopifyConnectButton.jsx`
- Modify: `frontend/src/App.jsx` (add the button to the header)

**Interfaces:**
- Consumes: backend `GET /auth/status` → `{ connected: boolean }`, `GET /auth` (redirect-based OAuth start) — both from Phase 1.
- Produces: `API_BASE: string`, `getJSON(path: string): Promise<object>`, `postJSON(path: string, body: object): Promise<object>`, `uploadSingleBook(book: object, addOns?: { customBlurb?: string, bookSize?: string }): Promise<object>` — consumed by `SingleScanPanel` (Task 4), `BatchScanPanel` (Task 5), `ManualEntryPanel` (Task 6).
- Produces: `<ShopifyConnectButton />` (no props) — consumed by `App.jsx`.

- [ ] **Step 1: Create `frontend/src/lib/api.js`**

```javascript
export const API_BASE = "http://localhost:3000";

export async function getJSON(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function postJSON(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function uploadSingleBook(book, addOns = {}) {
  const data = await postJSON("/upload-books", { books: [book], ...addOns });
  const r = data?.results?.[0];

  if (!r?.ok) {
    const userErrorsText = Array.isArray(r?.userErrors)
      ? r.userErrors.map((e) => e?.message).filter(Boolean).join("; ")
      : "";
    const rawErrorsText = Array.isArray(r?.rawErrors)
      ? r.rawErrors.map((e) => e?.message || String(e)).filter(Boolean).join("; ")
      : r?.rawErrors
      ? String(r.rawErrors)
      : "";

    throw new Error(userErrorsText || rawErrorsText || r?.error || "Unknown Shopify error");
  }

  return r;
}
```

- [ ] **Step 2: Create `frontend/src/components/ShopifyConnectButton.jsx`**

```jsx
import { useEffect, useState } from "react";
import { getJSON, API_BASE } from "../lib/api.js";

export default function ShopifyConnectButton() {
  const [connected, setConnected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getJSON("/auth/status")
      .then((data) => {
        if (!cancelled) setConnected(Boolean(data.connected));
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (connected === null) {
    return <span className="muted">Checking Shopify connection…</span>;
  }

  if (connected) {
    return <span className="muted">Shopify connected ✓</span>;
  }

  return (
    <a className="muted" href={`${API_BASE}/auth`} target="_blank" rel="noreferrer">
      Connect to Shopify
    </a>
  );
}
```

- [ ] **Step 3: Wire it into `frontend/src/App.jsx`**

Replace the `<h1>Inkbase</h1>` line with:

```jsx
import ShopifyConnectButton from "./components/ShopifyConnectButton.jsx";

// ...inside the returned JSX, replacing the old <h1>Inkbase</h1> line:
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Inkbase</h1>
        <ShopifyConnectButton />
      </div>
```

(Add the `import` line alongside the existing `TabNav` import at the top of the file.)

- [ ] **Step 4: Manually verify against the real backend**

```bash
cd backend
npm start
```
In another terminal:
```bash
cd frontend
npm run dev
```
Open the dev server URL. Expected: the header shows either "Shopify connected ✓" or a "Connect to Shopify" link, matching whatever `curl http://localhost:3000/auth/status` returns. Stop both servers once confirmed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.js frontend/src/components/ShopifyConnectButton.jsx frontend/src/App.jsx
git commit -m "Add API helper module and Shopify connection status button"
```

---

### Task 4: `AddOnsPanel`, `BookCard`, `SubmitStatus`, `ScanInput`, `lib/googleBooks.js`, `SingleScanPanel`

**Files:**
- Create: `frontend/src/lib/googleBooks.js`
- Create: `frontend/src/components/ScanInput.jsx`
- Create: `frontend/src/components/AddOnsPanel.jsx`
- Create: `frontend/src/components/BookCard.jsx`
- Create: `frontend/src/components/SubmitStatus.jsx`
- Create: `frontend/src/pages/SingleScanPanel.jsx`
- Modify: `frontend/src/App.jsx` (replace the Single Scan placeholder with the real panel; lift shared blurb state)

**Interfaces:**
- Consumes: `normalizeIsbn`, `normalizeText` (Task 2); `uploadSingleBook` (Task 3).
- Produces: `fetchBookByIsbn(isbn: string): Promise<{isbn, title, author, genre, description, publisher, publishedDate} | null>` — reused by nothing else in this plan, but kept in `lib/` per the file-structure convention (one clear responsibility per module).
- Produces: `ScanInput({ value, onChange, onSubmit, placeholder, autoFocus?, inputRef? })` — reused by `BatchScanPanel` (Task 5).
- Produces: `AddOnsPanel({ groupName, blurb, onBlurbChange, bookSize, onBookSizeChange })` — reused by `ManualEntryPanel` (Task 6).
- Produces: `<SingleScanPanel blurb={string} onBlurbChange={(v: string) => void} onEditInManual={(book: object) => void} inputRef={ref} />` — consumed by `App.jsx`.
- Produces (on `App.jsx`): shared `blurb` state (`useState` + `localStorage` key `default_custom_blurb_v1`) — consumed by `ManualEntryPanel` (Task 6) via the same props shape.

- [ ] **Step 1: Create `frontend/src/lib/googleBooks.js`**

```javascript
import { normalizeText } from "./isbn.js";

export async function fetchBookByIsbn(isbn) {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`
  );
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
    description: normalizeText(v.description || ""),
    publisher: v.publisher || "",
    publishedDate: v.publishedDate || "",
  };
}
```

- [ ] **Step 2: Create `frontend/src/components/ScanInput.jsx`**

```jsx
import { useEffect, useRef } from "react";

const SCAN_DONE_DELAY_MS = 80;

export default function ScanInput({ value, onChange, onSubmit, placeholder, autoFocus, inputRef }) {
  const timerRef = useRef(null);
  const localRef = useRef(null);
  const ref = inputRef || localRef;

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(timerRef.current);
      onSubmit();
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onSubmit, SCAN_DONE_DELAY_MS);
  }

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/AddOnsPanel.jsx`**

```jsx
const BOOK_SIZES = [
  "Pocket Paperback",
  "Standard Paperback",
  "Trade Paperback",
  "Hardcover",
  "Large Format",
];

export default function AddOnsPanel({ groupName, blurb, onBlurbChange, bookSize, onBookSizeChange }) {
  return (
    <section className="config-section">
      <h3>Listing Add-ons</h3>
      <label>
        Custom Blurb (appears under synopsis):
        <textarea
          rows={6}
          value={blurb}
          onChange={(e) => onBlurbChange(e.target.value)}
          placeholder="Condition notes, store message, shipping info..."
        />
      </label>
      <div style={{ marginTop: 10 }}>
        <div className="muted" style={{ marginBottom: 6 }}>Book Size:</div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="radio-grid">
          {BOOK_SIZES.map((size) => (
            <label key={size}>
              <input
                type="radio"
                name={`${groupName}-bookSize`}
                value={size}
                checked={bookSize === size}
                onChange={() => onBookSizeChange(size)}
              />
              {size}
            </label>
          ))}
        </fieldset>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create `frontend/src/components/BookCard.jsx`**

```jsx
export default function BookCard({ book, onSubmit, onEdit, submitDisabled }) {
  if (!book) return null;

  return (
    <div className="card">
      <h3 style={{ margin: "0 0 8px 0" }}>{book.title || "Unknown title"}</h3>
      <p><strong>Author:</strong> {book.author || "Unknown author"}</p>
      <p><strong>ISBN:</strong> {book.isbn || ""}</p>
      <p><strong>Genre:</strong> {book.genre || ""}</p>
      <p><strong>Publisher:</strong> {book.publisher || ""}</p>
      <p><strong>Published:</strong> {book.publishedDate || ""}</p>
      <pre style={{ whiteSpace: "pre-wrap" }}>{book.description || ""}</pre>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" onClick={onSubmit} disabled={submitDisabled}>Submit to Shopify</button>
        <button onClick={onEdit} disabled={submitDisabled}>Edit in Manual</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `frontend/src/components/SubmitStatus.jsx`**

```jsx
export default function SubmitStatus({ message }) {
  if (!message) return null;
  return <div className="muted">{message}</div>;
}
```

- [ ] **Step 6: Create `frontend/src/pages/SingleScanPanel.jsx`**

```jsx
import { useState } from "react";
import ScanInput from "../components/ScanInput.jsx";
import AddOnsPanel from "../components/AddOnsPanel.jsx";
import BookCard from "../components/BookCard.jsx";
import SubmitStatus from "../components/SubmitStatus.jsx";
import { normalizeIsbn } from "../lib/isbn.js";
import { fetchBookByIsbn } from "../lib/googleBooks.js";
import { uploadSingleBook } from "../lib/api.js";

export default function SingleScanPanel({ blurb, onBlurbChange, onEditInManual, inputRef }) {
  const [rawInput, setRawInput] = useState("");
  const [book, setBook] = useState(null);
  const [lookupStatus, setLookupStatus] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookSize, setBookSize] = useState("");

  async function handleScan() {
    const raw = rawInput.trim();
    setRawInput("");
    if (!raw) return;

    const isbn = normalizeIsbn(raw);
    setBook(null);
    setSubmitStatus("");
    setLookupStatus("Looking up book data...");

    try {
      const found = await fetchBookByIsbn(isbn);
      if (!found) {
        setBook({ isbn, title: "Not found" });
        setLookupStatus("");
        setSubmitStatus("Not found — use Manual Entry tab to add this book.");
        return;
      }
      setBook(found);
      setLookupStatus("");
      setSubmitStatus("Ready to submit. Confirm the details match the book in your hand.");
    } catch (err) {
      setBook({ isbn, title: "Error", description: String(err) });
      setLookupStatus("");
      setSubmitStatus(`Lookup failed: ${err.message || String(err)}`);
    }
  }

  async function handleSubmit() {
    if (!book || !book.title || book.title === "Not found" || book.title === "Error") return;

    setSubmitting(true);
    setSubmitStatus("Uploading to Shopify…");

    try {
      const result = await uploadSingleBook(
        {
          isbn: book.isbn,
          title: book.title,
          author: book.author,
          genre: book.genre,
          description: book.description,
        },
        { customBlurb: blurb, bookSize }
      );
      setSubmitStatus(`Uploaded ✓ Shopify Product ID: ${result.product?.id || "unknown"}`);
    } catch (err) {
      setSubmitStatus(`Upload failed: ${err.message || String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit() {
    if (!book) return;
    onEditInManual(book);
  }

  const canSubmit =
    Boolean(book?.title) && book.title !== "Not found" && book.title !== "Error" && !submitting;

  return (
    <div>
      <p>Click the box, then scan a barcode.</p>
      <ScanInput
        value={rawInput}
        onChange={setRawInput}
        onSubmit={handleScan}
        placeholder="Scan ISBN/barcode here..."
        autoFocus
        inputRef={inputRef}
      />
      <div className="hint">
        If your scanner sends Enter, it will submit immediately. Otherwise it uses a short timer.
      </div>

      <AddOnsPanel
        groupName="single"
        blurb={blurb}
        onBlurbChange={onBlurbChange}
        bookSize={bookSize}
        onBookSizeChange={setBookSize}
      />

      {lookupStatus && <p className="muted">{lookupStatus}</p>}

      <BookCard book={book} onSubmit={handleSubmit} onEdit={handleEdit} submitDisabled={!canSubmit} />
      <SubmitStatus message={submitStatus} />
    </div>
  );
}
```

- [ ] **Step 7: Wire shared blurb state and the real panel into `frontend/src/App.jsx`**

Replace the entire contents of `frontend/src/App.jsx` with:

```jsx
import { useState } from "react";
import TabNav from "./components/TabNav.jsx";
import ShopifyConnectButton from "./components/ShopifyConnectButton.jsx";
import SingleScanPanel from "./pages/SingleScanPanel.jsx";

const TABS = [
  { id: "single", label: "Single Scan" },
  { id: "batch", label: "Batch Scan" },
  { id: "manual", label: "Manual Entry" },
];

const BLURB_KEY = "default_custom_blurb_v1";
const DEFAULT_BLURB = "Your default blurb goes here.";

function loadInitialBlurb() {
  const saved = localStorage.getItem(BLURB_KEY);
  return (saved ?? DEFAULT_BLURB).trim();
}

export default function App() {
  const [activeTab, setActiveTab] = useState("single");
  const [blurb, setBlurb] = useState(loadInitialBlurb);

  function handleBlurbChange(value) {
    setBlurb(value);
    localStorage.setItem(BLURB_KEY, value);
  }

  function handleEditInManual() {
    // Wired up fully in Task 6/7; no-op placeholder for now.
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Inkbase</h1>
        <ShopifyConnectButton />
      </div>
      <div className="hint">Use tabs to switch between modes. Scanner focus stays on the active tab.</div>
      <TabNav tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />

      {activeTab === "single" && (
        <SingleScanPanel blurb={blurb} onBlurbChange={handleBlurbChange} onEditInManual={handleEditInManual} />
      )}
      {activeTab === "batch" && <div className="card">Batch Scan panel coming soon.</div>}
      {activeTab === "manual" && <div className="card">Manual Entry panel coming soon.</div>}
    </div>
  );
}
```

- [ ] **Step 8: Manually verify end-to-end against the real backend**

With `backend` running (`npm start`) and `frontend` running (`npm run dev`):
1. On the Single Scan tab, type a real ISBN (e.g. `9780743273565`) and press Enter.
   Expected: "Looking up book data..." then a card showing "The Great Gatsby" by F. Scott Fitzgerald.
2. Type text into the Custom Blurb box and select a Book Size radio.
3. Click "Submit to Shopify".
   Expected: status changes to "Uploading to Shopify…" then either "Uploaded ✓ Shopify Product ID: ..." or an error message (an error is fine here if Shopify credentials aren't rotated yet per Phase 1 Task 6 — what matters is the request completes and shows *some* result, not a crash).
4. Scan an ISBN that doesn't exist (e.g. `0000000000`).
   Expected: "Not found — use Manual Entry tab to add this book." and the Submit button stays disabled.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/googleBooks.js frontend/src/components/ScanInput.jsx frontend/src/components/AddOnsPanel.jsx frontend/src/components/BookCard.jsx frontend/src/components/SubmitStatus.jsx frontend/src/pages frontend/src/App.jsx
git commit -m "Add Single Scan panel with Google Books lookup and Shopify submit"
```

---

### Task 5: `lib/storage.js`, `QueueList`, `BatchScanPanel`

**Files:**
- Create: `frontend/src/lib/storage.js`
- Create: `frontend/src/components/QueueList.jsx`
- Create: `frontend/src/pages/BatchScanPanel.jsx`
- Modify: `frontend/src/App.jsx` (replace the Batch Scan placeholder with the real panel)

**Interfaces:**
- Consumes: `normalizeIsbn` (Task 2), `ScanInput` (Task 4), `postJSON` (Task 3).
- Produces: `loadJSON(key: string, fallback: any): any`, `saveJSON(key: string, value: any): void` — consumed by `ManualEntryPanel` (Task 6).
- Produces: `QueueList({ items: object[], renderLabel: (item) => string, renderSub: (item) => string, onRemove: (item) => void })` — consumed by `ManualEntryPanel` (Task 6). Items with `status === "failed"` and an `error` string render an inline `.error` line automatically.
- Produces: `<BatchScanPanel inputRef={ref} />` — consumed by `App.jsx`.

- [ ] **Step 1: Create `frontend/src/lib/storage.js`**

```javascript
export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
```

- [ ] **Step 2: Create `frontend/src/components/QueueList.jsx`**

```jsx
export default function QueueList({ items, renderLabel, renderSub, onRemove }) {
  return (
    <ul className="list">
      {items.map((item, idx) => (
        <li className="item" key={item.key ?? idx}>
          <div className="item-left">
            <div><strong>{renderLabel(item)}</strong></div>
            <div className="muted">{renderSub(item)}</div>
            {item.status === "failed" && item.error && (
              <div className="error">{item.error}</div>
            )}
          </div>
          <div>
            <button onClick={() => onRemove(item)}>Remove</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Create `frontend/src/pages/BatchScanPanel.jsx`**

```jsx
import { useEffect, useState } from "react";
import ScanInput from "../components/ScanInput.jsx";
import QueueList from "../components/QueueList.jsx";
import { normalizeIsbn } from "../lib/isbn.js";
import { loadJSON, saveJSON } from "../lib/storage.js";
import { postJSON } from "../lib/api.js";

const STORAGE_KEY = "batch_scans_v1";

function moveToTop(list, isbn) {
  const idx = list.findIndex((x) => x.isbn === isbn);
  if (idx <= 0) return list;
  const copy = [...list];
  const [it] = copy.splice(idx, 1);
  copy.unshift(it);
  return copy;
}

function statusLabel(it) {
  switch (it.status) {
    case "pending":
      return "Pending";
    case "uploading":
      return "Uploading…";
    case "ok":
      return "Uploaded ✓";
    case "failed":
      return "Failed ✕";
    default:
      return it.status;
  }
}

export default function BatchScanPanel({ inputRef }) {
  const [rawInput, setRawInput] = useState("");
  const [items, setItems] = useState(() => loadJSON(STORAGE_KEY, []));
  const [dedupe, setDedupe] = useState(true);

  useEffect(() => {
    saveJSON(STORAGE_KEY, items);
  }, [items]);

  function handleScan() {
    const raw = rawInput.trim();
    setRawInput("");
    if (!raw) return;

    const isbn = normalizeIsbn(raw);

    setItems((prev) => {
      if (dedupe) {
        const existing = prev.find((x) => x.isbn === isbn && x.status !== "ok");
        if (existing) {
          existing.scannedAt = new Date().toISOString();
          return moveToTop(prev, isbn);
        }
      }
      return [{ isbn, scannedAt: new Date().toISOString(), status: "pending" }, ...prev];
    });
  }

  function handleClear() {
    setItems([]);
  }

  function handleRemove(item) {
    setItems((prev) => prev.filter((x) => x !== item));
  }

  async function handleUpload() {
    const pending = items.filter((x) => x.status === "pending" || x.status === "failed");
    if (pending.length === 0) return;

    setItems((prev) =>
      prev.map((it) => (pending.includes(it) ? { ...it, status: "uploading", error: undefined } : it))
    );

    try {
      const data = await postJSON("/api/batch", {
        items: pending.map((x) => ({ isbn: x.isbn, scannedAt: x.scannedAt })),
      });

      const byIsbn = new Map((data.results || []).map((r) => [r.isbn, r]));

      setItems((prev) =>
        prev.map((it) => {
          if (!pending.includes(it)) return it;
          const r = byIsbn.get(it.isbn);
          return r?.ok
            ? { ...it, status: "ok" }
            : { ...it, status: "failed", error: r?.error || "Unknown error" };
        })
      );
    } catch (err) {
      setItems((prev) =>
        prev.map((it) =>
          it.status === "uploading"
            ? { ...it, status: "failed", error: err.message || "Network error" }
            : it
        )
      );
    }
  }

  const total = items.length;
  const pendingCount = items.filter((x) => x.status === "pending").length;
  const uploadingCount = items.filter((x) => x.status === "uploading").length;
  const okCount = items.filter((x) => x.status === "ok").length;
  const failedCount = items.filter((x) => x.status === "failed").length;

  return (
    <div>
      <p>Scan multiple ISBNs. They accumulate in a list. Upload when ready.</p>
      <ScanInput
        value={rawInput}
        onChange={setRawInput}
        onSubmit={handleScan}
        placeholder="Scan ISBN…"
        inputRef={inputRef}
      />
      <div className="row" style={{ alignItems: "center" }}>
        <div>
          <button onClick={handleUpload}>Upload batch</button>
          <button onClick={handleClear}>Clear list</button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />
          Dedupe duplicates
        </label>
      </div>
      <div className="muted">
        Total: {total} | Pending: {pendingCount} | Uploading: {uploadingCount} | OK: {okCount} | Failed: {failedCount}
      </div>
      <QueueList
        items={items}
        renderLabel={(it) => it.isbn}
        renderSub={(it) => `${new Date(it.scannedAt).toLocaleTimeString()} — ${statusLabel(it)}`}
        onRemove={handleRemove}
      />
    </div>
  );
}
```

- [ ] **Step 4: Wire it into `frontend/src/App.jsx`**

Add the import:
```jsx
import BatchScanPanel from "./pages/BatchScanPanel.jsx";
```
Replace the line `{activeTab === "batch" && <div className="card">Batch Scan panel coming soon.</div>}` with:
```jsx
{activeTab === "batch" && <BatchScanPanel />}
```

- [ ] **Step 5: Manually verify**

With `frontend` dev server running:
1. Switch to Batch Scan tab, type an ISBN and press Enter. Expected: it appears in the list with status "Pending", and the "Total/Pending" counts update.
2. Type the same ISBN again. Expected: with "Dedupe duplicates" checked, it moves to the top rather than duplicating.
3. Reload the browser page. Expected: the list persists (backed by `localStorage`).
4. With `backend` also running, click "Upload batch". Expected: status flips to "Uploading…" then to either "Uploaded ✓" or "Failed ✕" per item.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/storage.js frontend/src/components/QueueList.jsx frontend/src/pages/BatchScanPanel.jsx frontend/src/App.jsx
git commit -m "Add Batch Scan panel with persisted queue and dedupe"
```

---

### Task 6: `ManualEntryPanel`

**Files:**
- Create: `frontend/src/pages/ManualEntryPanel.jsx`
- Modify: `frontend/src/App.jsx` (replace the Manual Entry placeholder with the real panel; wire up "Edit in Manual" handoff from Single Scan)

**Interfaces:**
- Consumes: `AddOnsPanel` (Task 4), `QueueList` (Task 5), `loadJSON`/`saveJSON` (Task 5), `postJSON` (Task 3), `normalizeIsbn` (Task 2).
- Produces: `<ManualEntryPanel blurb={string} onBlurbChange={(v) => void} prefill={object | null} inputRef={ref} />` — consumed by `App.jsx`.

- [ ] **Step 1: Create `frontend/src/pages/ManualEntryPanel.jsx`**

```jsx
import { useEffect, useState } from "react";
import AddOnsPanel from "../components/AddOnsPanel.jsx";
import QueueList from "../components/QueueList.jsx";
import { normalizeIsbn } from "../lib/isbn.js";
import { loadJSON, saveJSON } from "../lib/storage.js";
import { postJSON } from "../lib/api.js";

const STORAGE_KEY = "manual_list_v1";

function clientKey(it) {
  return `${it.isbn || ""}|${it.title || ""}|${it.createdAt || ""}`;
}

export default function ManualEntryPanel({ blurb, onBlurbChange, prefill, inputRef }) {
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [bookSize, setBookSize] = useState("");
  const [items, setItems] = useState(() => loadJSON(STORAGE_KEY, []));

  useEffect(() => {
    saveJSON(STORAGE_KEY, items);
  }, [items]);

  useEffect(() => {
    if (!prefill) return;
    setIsbn(prefill.isbn || "");
    setTitle(prefill.title || "");
    setAuthor(prefill.author || "");
    setGenre(prefill.genre || "");
    setDescription(prefill.description || "");
  }, [prefill]);

  function clearForm() {
    setIsbn("");
    setTitle("");
    setAuthor("");
    setGenre("");
    setDescription("");
  }

  function handleAdd() {
    const cleanIsbn = normalizeIsbn(isbn);
    const cleanTitle = title.trim();
    if (!cleanIsbn && !cleanTitle) return;

    setItems((prev) => [
      {
        isbn: cleanIsbn,
        title: cleanTitle,
        author: author.trim(),
        genre: genre.trim(),
        description: description.trim(),
        createdAt: new Date().toISOString(),
        status: "pending",
      },
      ...prev,
    ]);
    clearForm();
  }

  function handleClearList() {
    setItems([]);
    clearForm();
  }

  function handleRemove(item) {
    setItems((prev) => prev.filter((x) => x !== item));
  }

  async function handleUpload() {
    const pending = items.filter((x) => x.status === "pending" || x.status === "failed");
    if (pending.length === 0) return;

    const pendingKeys = new Set(pending.map((x) => clientKey(x)));

    setItems((prev) =>
      prev.map((it) =>
        pendingKeys.has(clientKey(it)) && it.status !== "ok"
          ? { ...it, status: "uploading", error: undefined }
          : it
      )
    );

    try {
      const data = await postJSON("/api/manual", {
        items: pending,
        customBlurb: blurb,
        bookSize,
      });

      const byKey = new Map((data.results || []).map((r) => [r.clientKey, r]));

      setItems((prev) =>
        prev.map((it) => {
          if (!pendingKeys.has(clientKey(it)) || it.status !== "uploading") return it;
          const r = byKey.get(clientKey(it));
          return r?.ok
            ? { ...it, status: "ok" }
            : { ...it, status: "failed", error: r?.error || "Unknown error" };
        })
      );
    } catch (err) {
      setItems((prev) =>
        prev.map((it) =>
          it.status === "uploading"
            ? { ...it, status: "failed", error: err.message || "Network error" }
            : it
        )
      );
    }
  }

  return (
    <div>
      <p>Type details manually (useful when a book has no barcode or it's damaged).</p>
      <div className="row">
        <div>
          <label className="muted">ISBN</label>
          <input ref={inputRef} value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978..." />
        </div>
        <div>
          <label className="muted">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" />
        </div>
      </div>
      <div className="row">
        <div>
          <label className="muted">Author</label>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" />
        </div>
        <div>
          <label className="muted">Genre</label>
          <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre" />
        </div>
      </div>
      <label className="muted">Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short synopsis / notes..."
      />

      <AddOnsPanel
        groupName="manual"
        blurb={blurb}
        onBlurbChange={onBlurbChange}
        bookSize={bookSize}
        onBookSizeChange={setBookSize}
      />

      <div className="row">
        <button onClick={handleAdd}>Add to Manual List</button>
        <button onClick={handleUpload}>Upload Manual List</button>
        <button onClick={handleClearList}>Clear Manual List</button>
      </div>

      <div className="muted">Manual items: {items.length}</div>
      <QueueList
        items={items}
        renderLabel={(it) => it.title || it.isbn || "Untitled"}
        renderSub={(it) =>
          `${new Date(it.createdAt).toLocaleTimeString()} — ${it.author || ""} ${
            it.genre ? "• " + it.genre : ""
          } • ${it.status}`
        }
        onRemove={handleRemove}
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `frontend/src/App.jsx`, including the Single Scan "Edit in Manual" handoff**

Replace the full contents of `frontend/src/App.jsx` with:

```jsx
import { useRef, useState } from "react";
import TabNav from "./components/TabNav.jsx";
import ShopifyConnectButton from "./components/ShopifyConnectButton.jsx";
import SingleScanPanel from "./pages/SingleScanPanel.jsx";
import BatchScanPanel from "./pages/BatchScanPanel.jsx";
import ManualEntryPanel from "./pages/ManualEntryPanel.jsx";

const TABS = [
  { id: "single", label: "Single Scan" },
  { id: "batch", label: "Batch Scan" },
  { id: "manual", label: "Manual Entry" },
];

const BLURB_KEY = "default_custom_blurb_v1";
const DEFAULT_BLURB = "Your default blurb goes here.";

function loadInitialBlurb() {
  const saved = localStorage.getItem(BLURB_KEY);
  return (saved ?? DEFAULT_BLURB).trim();
}

export default function App() {
  const [activeTab, setActiveTab] = useState("single");
  const [blurb, setBlurb] = useState(loadInitialBlurb);
  const [manualPrefill, setManualPrefill] = useState(null);

  const singleInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const manualInputRef = useRef(null);
  const refsByTab = { single: singleInputRef, batch: batchInputRef, manual: manualInputRef };

  function handleBlurbChange(value) {
    setBlurb(value);
    localStorage.setItem(BLURB_KEY, value);
  }

  function handleSelectTab(tabId) {
    setActiveTab(tabId);
    setTimeout(() => refsByTab[tabId].current?.focus(), 0);
  }

  function handleEditInManual(book) {
    setManualPrefill({ ...book, createdAt: new Date().toISOString() });
    handleSelectTab("manual");
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Inkbase</h1>
        <ShopifyConnectButton />
      </div>
      <div className="hint">Use tabs to switch between modes. Scanner focus stays on the active tab.</div>
      <TabNav tabs={TABS} activeTab={activeTab} onSelect={handleSelectTab} />

      <div style={{ display: activeTab === "single" ? "block" : "none" }}>
        <SingleScanPanel
          blurb={blurb}
          onBlurbChange={handleBlurbChange}
          onEditInManual={handleEditInManual}
          inputRef={singleInputRef}
        />
      </div>
      <div style={{ display: activeTab === "batch" ? "block" : "none" }}>
        <BatchScanPanel inputRef={batchInputRef} />
      </div>
      <div style={{ display: activeTab === "manual" ? "block" : "none" }}>
        <ManualEntryPanel
          blurb={blurb}
          onBlurbChange={handleBlurbChange}
          prefill={manualPrefill}
          inputRef={manualInputRef}
        />
      </div>
    </div>
  );
}
```

Note this also switches all three panels to always-mounted (`display: none/block`) rather than conditionally rendered — this is what actually preserves in-progress state (e.g. an unsent Batch queue draft, though that's persisted anyway; more importantly the current input text and scroll position) across tab switches, matching the Architecture section above. Earlier tasks' App.jsx used conditional rendering (`{activeTab === "x" && ...}`) as a simpler intermediate step — this final version is the one that matches the plan's stated architecture.

- [ ] **Step 3: Manually verify**

With `frontend` dev server running:
1. On Manual Entry, fill in Title + Author, click "Add to Manual List". Expected: it appears in the list below with status "pending".
2. Reload the browser. Expected: the manual list persists.
3. On Single Scan, scan a valid ISBN, then click "Edit in Manual". Expected: the app switches to the Manual Entry tab with the ISBN/Title/Author/Genre/Description fields pre-filled from the scanned book.
4. Edit the blurb text on the Manual Entry tab, then switch to Single Scan. Expected: the blurb textarea there shows the same updated text (shared/synced state).
5. With `backend` running, click "Upload Manual List". Expected: status per item flips to "Uploaded ✓" or "Failed ✕".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ManualEntryPanel.jsx frontend/src/App.jsx
git commit -m "Add Manual Entry panel with single-scan handoff and shared blurb sync"
```

---

### Task 7: Production build, `start-book-scanner.bat` update, full regression pass

**Files:**
- Modify: `start-book-scanner.bat`

**Interfaces:** None — this task wires up the build/serve path and performs final verification; it does not add new interfaces.

- [ ] **Step 1: Build the production bundle**

```bash
cd frontend
npm run build
```
Expected: a `frontend/dist/` directory is created containing bundled JS/CSS and an `index.html`.

- [ ] **Step 2: Serve the build output and smoke-test it**

```bash
npx serve dist -l 8000
```
Open `http://localhost:8000`. Expected: the same "Inkbase" app loads (this is the production build, not the dev server) — confirm the Single Scan tab still works end-to-end against the running backend (scan an ISBN, see the book card).

Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 3: Update `start-book-scanner.bat` to build and serve the production output**

Replace the file's contents with:

```bat
@echo off
echo Starting Inkbase...

REM Start backend
start "Inkbase Backend" cmd /k ^
  "cd /d C:\Users\leesa\OneDrive - Marque Group Solutions\Personal\Inkbase\backend && npm start"

REM Small delay to avoid race conditions
timeout /t 2 >nul

REM Build and serve the frontend production bundle
start "Inkbase Frontend" cmd /k ^
  "cd /d C:\Users\leesa\OneDrive - Marque Group Solutions\Personal\Inkbase\frontend && npm run build && npx serve dist -l 8000"

echo All services started.
```

(Note: the previous version of this file used `npx serve . -1 8000` — `-1` was not a valid `serve` flag; this task both fixes that typo and points it at the built `dist/` output instead of raw source.)

- [ ] **Step 4: Run the full regression checklist against the running app** (backend + `start-book-scanner.bat`, or dev server — either is fine for this pass)

- [ ] Single Scan: scan a real ISBN → book card appears with correct title/author.
- [ ] Single Scan: scan an unknown ISBN → "Not found" message, Submit stays disabled.
- [ ] Single Scan → Manual Entry: "Edit in Manual" correctly pre-fills the form and switches tabs.
- [ ] Batch Scan: scanning the same ISBN twice with dedupe on moves it to the top instead of duplicating.
- [ ] Batch Scan: list survives a page reload.
- [ ] Batch Scan: "Upload batch" changes item statuses based on the real `/api/batch` response.
- [ ] Manual Entry: "Add to Manual List" adds an item; list survives a page reload.
- [ ] Manual Entry: "Upload Manual List" changes item statuses based on the real `/api/manual` response.
- [ ] Custom Blurb text stays in sync between Single Scan and Manual Entry tabs, and survives a page reload.
- [ ] Header shows correct Shopify connection status.
- [ ] Visual style matches Warm Bookshop: cream background, serif "Inkbase" heading, tan tab underline.
- [ ] Clicking each tab moves keyboard focus into that tab's primary input (Single Scan's ISBN box, Batch Scan's ISBN box, Manual Entry's ISBN box) without needing an extra click.
- [ ] Typing partway into the Batch Scan queue, switching to another tab, and switching back does not clear the unsaved input text in the ISBN box (always-mounted panels preserve in-progress UI state, not just the persisted queue).

- [ ] **Step 5: Commit**

```bash
git add start-book-scanner.bat
git commit -m "Point start-book-scanner.bat at the production frontend build"
```
