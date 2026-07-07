import { normalizeText } from "./isbn.js";
import { getJSON } from "./api.js";

export async function fetchBookByIsbn(isbn) {
  const data = await getJSON(`/api/book-lookup?isbn=${encodeURIComponent(isbn)}`);
  if (!data.found) return null;

  return {
    isbn: data.isbn,
    title: (data.title || "").trim(),
    author: data.author || "",
    genre: data.genre || "",
    description: normalizeText(data.description || ""),
    publisher: data.publisher || "",
    publishedDate: data.publishedDate || "",
  };
}
