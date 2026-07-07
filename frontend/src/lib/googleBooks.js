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
