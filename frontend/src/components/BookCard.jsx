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
