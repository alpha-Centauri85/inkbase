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
