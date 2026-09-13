# Inkbase

Turns a stack of second-hand books into Shopify listings.

Scan or paste an ISBN, and Inkbase looks the book up through the Google Books API,
optionally checks what it is selling for elsewhere, and creates or updates the
product in a Shopify store through the Admin API. It exists because listing books
one at a time by hand is slow and error-prone, and the data needed to do it well
is already sitting in a public API.

```
ISBN  ->  Google Books lookup  ->  (optional price check)  ->  Shopify Admin API
```

## What it does

- **Single scan** — scan or type one ISBN, review the matched book, push it to Shopify
- **Manual list** — paste a list of books and upload them together
- **Batch** — send bare ISBNs and let the server do the Google Books lookup for each,
  up to 50 per request
- **Price comparison** — optional lookup against Google Shopping (via SerpApi) to help
  set a price before listing
- **OAuth bootstrap** — walks through the Shopify OAuth exchange and persists the
  resulting Admin API token, so you are not pasting tokens by hand

Products are written using Shopify's GraphQL Admin API, setting the ISBN as the
variant barcode and a `BOOK-<isbn>` SKU so repeat scans update the existing product
rather than creating duplicates.

## Stack

- **Backend** — Node.js (ESM), Express 5, native `fetch`, `dotenv`
- **Frontend** — React 18 + Vite
- **External APIs** — Shopify Admin (GraphQL), Google Books, SerpApi

No database. State lives in Shopify.

## Requirements

- Node.js 18 or newer
- A Shopify store and a custom app with `read_products,write_products` scope
- Optionally a Google Books API key and a SerpApi key

## Setup

```bash
# backend
cd backend
npm install
cp .env.example .env      # then fill in the values
npm start                 # http://localhost:3000

# frontend, in a second terminal
cd frontend
npm install
npm run dev
```

On Windows, `start-book-scanner.bat` starts the backend and serves a production
frontend build in one go. Edit the paths in it if the project does not live in
the same place on your machine.

### Getting a Shopify token

The Dev Dashboard gives you a client ID and secret, not an API token. To get the
token:

1. Fill in `SHOPIFY_STORE`, `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` in `.env`
2. Start the backend and visit <http://localhost:3000/auth>
3. Approve the app

The callback stores the resulting Admin API access token. Confirm it worked with
`GET /auth/status`, and check the store connection with `GET /shopify-test`.

## Configuration

| Variable                | Required | Default                    | Notes                                          |
| ----------------------- | -------- | -------------------------- | ---------------------------------------------- |
| `SHOPIFY_STORE`         | yes      | —                          | Full domain, e.g. `my-store.myshopify.com`     |
| `SHOPIFY_CLIENT_ID`     | yes      | —                          | From the Shopify Dev Dashboard                 |
| `SHOPIFY_CLIENT_SECRET` | yes      | —                          | From the Shopify Dev Dashboard                 |
| `SHOPIFY_ADMIN_TOKEN`   | after auth | —                        | Written once you complete `/auth`              |
| `SHOPIFY_SCOPES`        | no       | `read_products,write_products` |                                            |
| `SHOPIFY_API_VERSION`   | no       | `2026-01`                  | Pin to a stable version                        |
| `PORT`                  | no       | `3000`                     |                                                |
| `GOOGLE_BOOKS_API_KEY`  | no       | —                          | Without one you share Google's anonymous quota |
| `SERPAPI_KEY`           | no       | —                          | Only needed for price comparison               |

`backend/.env` is gitignored and must stay that way. It holds live store credentials.

## API

| Method | Route               | Purpose                                          |
| ------ | ------------------- | ------------------------------------------------ |
| POST   | `/upload-books`     | Create or update products from full book records |
| POST   | `/api/manual`       | Upload a manually entered list                   |
| POST   | `/api/batch`        | Upload bare ISBNs, server does the lookups (max 50) |
| GET    | `/api/book-lookup`  | Look up a single ISBN via Google Books           |
| GET    | `/api/price-check`  | Price comparison for an ISBN                     |
| GET    | `/auth`             | Begin the Shopify OAuth flow                     |
| GET    | `/auth/callback`    | OAuth callback, persists the token               |
| GET    | `/auth/status`      | Whether a token is held                          |
| GET    | `/shopify-test`     | Check the store connection                       |
| GET    | `/health`           | Liveness check                                   |
| GET    | `/_routes`          | List registered routes                           |

## Known limitations

- No automated test suite. Verification is manual, by running the server and
  exercising the routes.
- Batches are capped at 50 items per request.
- Google Books does not have every ISBN, particularly older and self-published
  titles. Those need entering by hand.
- The Admin API token is held in memory and in `.env`, which is fine for a local
  single-user tool and not suitable for a shared deployment.

## Licence

ISC.
