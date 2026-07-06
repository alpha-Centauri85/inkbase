/**
 * BookScanner backend (Express)
 *
 * What this server does:
 * 1) Exposes local endpoints your frontend calls:
 *    - POST /upload-books   (single or batch upload to Shopify)
 *    - POST /api/manual     (manual list upload to Shopify)
 *    - GET  /shopify-test   (sanity test: can we talk to Shopify?)
 *    - GET  /health         (basic "server alive")
 *    - GET  /_routes        (debug: list available routes)
 *
 * 2) OAuth bootstrap endpoints to obtain a real Admin API access token:
 *    - GET /auth
 *    - GET /auth/callback
 *
 * Important Shopify auth note:
 * - The Dev Dashboard app gives you CLIENT_ID + CLIENT_SECRET (OAuth credentials).
 * - You MUST visit /auth once, approve, then Shopify returns an ACCESS TOKEN.
 * - That ACCESS TOKEN is what you store in SHOPIFY_ADMIN_TOKEN and use for Admin API calls.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ------------------------------------------------------------
// ENV CONFIG (single source of truth)
// ------------------------------------------------------------

// Use FULL domain in .env:
//   SHOPIFY_STORE=chromatic-photography-2.myshopify.com
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

// OAuth credentials from Dev Dashboard app settings
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES || "read_products,write_products";

// This is the *Admin API access token* you get AFTER doing OAuth once.
// Put it in .env after you run /auth.
let SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || "";

// Shopify API version (pin to a stable one)
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-01";

// Server port
const PORT = Number(process.env.PORT || 3000);

const variantUpdateMutation = `
  mutation VariantBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id barcode sku price }
      userErrors { field message }
    }
  }
`;
function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToHtmlParagraphs(text) {
  // Turn plain text into <p> blocks, respecting blank lines
  const t = String(text || "").trim();
  if (!t) return "";
  return t
    .split(/\n{2,}/)                 // blank line = new paragraph
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`) // single \n = <br>
    .join("\n");
}

//STEP 4: Synopsis > Custom Text > Book Size (each on new line/paragraph)
function buildDescriptionHtml({ synopsis, customBlurb, bookSize }) {
  const synHtml = textToHtmlParagraphs(synopsis);
  const blurbHtml = textToHtmlParagraphs(customBlurb);

  const size = (bookSize || "").trim();
  const sizeHtml = size ? `<p><strong>Book Size:</strong> ${escapeHtml(size)}</p>` : "";

  return [synHtml, blurbHtml, sizeHtml].filter(Boolean).join("\n");
}

// ------------------------------------------------------------
// Startup logs + validation
// ------------------------------------------------------------
console.log("SHOPIFY_STORE:", SHOPIFY_STORE);
console.log("ADMIN_TOKEN present:", Boolean(SHOPIFY_ADMIN_TOKEN), "length:", SHOPIFY_ADMIN_TOKEN?.length || 0);

if (!SHOPIFY_STORE) {
  console.error("Missing SHOPIFY_STORE env var. Example: chromatic-photography-2.myshopify.com");
  process.exit(1);
}

if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
  console.warn("Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET. /auth will not work until these are set.");
}

// Do NOT exit if token missing, because we need /auth to generate it.
if (!SHOPIFY_ADMIN_TOKEN) {
  console.warn("SHOPIFY_ADMIN_TOKEN is missing. Generate it by visiting: http://localhost:3000/auth");
}

// ------------------------------------------------------------
// Helper: call Shopify GraphQL Admin API
// ------------------------------------------------------------
async function shopifyGraphQL(query, variables) {
  // Guard: give a helpful response instead of crashing the whole server
  if (!SHOPIFY_ADMIN_TOKEN) {
    return {
      status: 401,
      json: { error: "Missing SHOPIFY_ADMIN_TOKEN. Visit /auth to generate one, then paste into .env and restart." },
    };
  }

  // IMPORTANT: SHOPIFY_STORE should already be "xxx.myshopify.com"
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

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

// ------------------------------------------------------------
// OAuth bootstrap (run once to obtain SHOPIFY_ADMIN_TOKEN)
// ------------------------------------------------------------

// In-memory nonce (fine for prototype; in production you'd store per-session)
let pendingState = null;

/**
 * Step 1: Visit /auth in browser.
 * Shopify will ask you to approve scopes, then redirect to /auth/callback.
 */
app.get("/auth", (req, res) => {
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    return res.status(500).send("Missing SHOPIFY_CLIENT_ID/SHOPIFY_CLIENT_SECRET in .env");
  }

  const state = crypto.randomBytes(16).toString("hex");
  pendingState = state;

  const redirectUri = `http://localhost:${PORT}/auth/callback`;

  const installUrl =
    `https://${SHOPIFY_STORE}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(SHOPIFY_CLIENT_ID)}` +
    `&scope=${encodeURIComponent(SHOPIFY_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(installUrl);
});

/**
 * Step 2: Shopify redirects back here with a `code`.
 * We exchange code + client secret for a real access token.
 */
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

// ------------------------------------------------------------
// Routes: Shopify operations
// ------------------------------------------------------------

app.post("/upload-books", async (req, res) => {
  const books = req.body?.books;

  // ✅ STEP 4: read add-ons from request body (applies to all books in this upload)
  const customBlurb = req.body?.customBlurb || "";
  const bookSize = req.body?.bookSize || "";

  if (!Array.isArray(books)) {
    return res.status(400).json({ error: "Expected JSON body: { books: [...] }" });
  }
  if (books.length > 50) {
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

  for (const book of books) {
    const title = (book.title || "").trim();
    const isbn = (book.isbn || "").trim();

    if (!title || !isbn) {
      results.push({ ok: false, book, error: "Missing title or isbn" });
      continue;
    }

    // ✅ STEP 4: compose description in required order
    const descriptionHtml = buildDescriptionHtml({
      synopsis: book.description,
      customBlurb,
      bookSize,
    });

    const input = {
      title,
      vendor: (book.author || "").trim(),
      productType: (book.genre || "").trim(),
      descriptionHtml, // ✅ STEP 4
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
        ok: status === 200 && userErrors.length === 0 && product,
        isbn,
        title,
        product,
        userErrors,
        variantUpdate,
        rawErrors: Array.isArray(json?.errors) ? json.errors : [], // normalize
      });
    } catch (err) {
      results.push({ ok: false, isbn, title, error: err.message });
    }
  }

  res.json({ count: books.length, results });
});

app.post("/api/manual", async (req, res) => {
  const items = req.body?.items;

  // ✅ STEP 4: read add-ons from request body (applies to all items in this upload)
  const customBlurb = req.body?.customBlurb || "";
  const bookSize = req.body?.bookSize || "";

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: "Expected JSON body: { items: [...] }" });
  }
  if (items.length > 50) {
    return res.status(400).json({ error: "Max 50 manual items per batch." });
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

  for (const item of items) {
    const isbn = (item.isbn || "").trim();
    const title = (item.title || "").trim();
    const author = (item.author || "").trim();
    const genre = (item.genre || "").trim();
    const description = (item.description || "").trim();
    const createdAt = (item.createdAt || "").trim();

    const clientKey = `${isbn}|${title}|${createdAt}`;

    if (!isbn && !title) {
      results.push({ clientKey, ok: false, error: "Manual entry requires at least a title or ISBN" });
      continue;
    }

    if (isbn && !(isbn.length === 10 || isbn.length === 13)) {
      results.push({ clientKey, ok: false, error: "ISBN must be 10 or 13 characters" });
      continue;
    }

    // ✅ STEP 4: compose description in required order for manual items
    const descriptionHtml = buildDescriptionHtml({
      synopsis: description,
      customBlurb,
      bookSize,
    });

    const input = {
      title: title || `Untitled Book (${isbn || "manual"})`,
      vendor: author || "Unknown Author",
      productType: genre || "Manual Entry",
      descriptionHtml, // ✅ STEP 4
      tags: ["Book", "Used", "Manual"].concat(genre ? [genre] : []),
      status: "DRAFT",
    };

    try {
      const { status, json } = await shopifyGraphQL(mutation, { input });

      const userErrors = json?.data?.productCreate?.userErrors || [];
      const product = json?.data?.productCreate?.product || null;
      const variantId = product?.variants?.nodes?.[0]?.id || null;

      let variantUpdate = null;
      if (product && variantId && isbn) {
        const vRes = await shopifyGraphQL(variantUpdateMutation, {
          productId: product.id,
          variants: [{ id: variantId, barcode: isbn, sku: `BOOK-${isbn}` }],
        });
        variantUpdate = vRes.json;
      }

      results.push({
        clientKey,
        ok: status === 200 && userErrors.length === 0 && product,
        product,
        userErrors,
        variantUpdate,
        rawErrors: Array.isArray(json?.errors) ? json.errors : [],
      });
    } catch (err) {
      results.push({ clientKey, ok: false, error: err.message });
    }
  }

  res.json({ count: items.length, results });
});

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

// ------------------------------------------------------------
// Diagnostics
// ------------------------------------------------------------

app.get("/shopify-test", async (req, res) => {
  const query = `{ shop { name myshopifyDomain } }`;
  const { status, json } = await shopifyGraphQL(query, {});
  res.status(status).json(json);
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/", (req, res) => {
  res.send("Backend is running. Try /health, /auth, /shopify-test, or POST /upload-books");
});

app.get("/_routes", (req, res) => {
  const routes = [];
  app._router?.stack?.forEach((m) => {
    if (m.route && m.route.path) {
      const methods = Object.keys(m.route.methods).join(",").toUpperCase();
      routes.push(`${methods} ${m.route.path}`);
    }
  });
  res.type("text/plain").send(routes.sort().join("\n"));
});

// ------------------------------------------------------------
// Start server (ONE listen only)
// ------------------------------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
