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
