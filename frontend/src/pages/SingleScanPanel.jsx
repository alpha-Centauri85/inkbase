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
