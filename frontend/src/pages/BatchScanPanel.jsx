import { useEffect, useState } from "react";
import ScanInput from "../components/ScanInput.jsx";
import QueueList from "../components/QueueList.jsx";
import { normalizeIsbn } from "../lib/isbn.js";
import { loadJSON, saveJSON } from "../lib/storage.js";
import { postJSON } from "../lib/api.js";

const STORAGE_KEY = "batch_scans_v1";

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
        const idx = prev.findIndex((x) => x.isbn === isbn && x.status !== "ok");
        if (idx !== -1) {
          const updated = { ...prev[idx], scannedAt: new Date().toISOString() };
          const rest = prev.filter((_, i) => i !== idx);
          return [updated, ...rest];
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

    const pendingIsbns = new Set(pending.map((x) => x.isbn));

    setItems((prev) =>
      prev.map((it) =>
        pendingIsbns.has(it.isbn) && it.status !== "ok"
          ? { ...it, status: "uploading", error: undefined }
          : it
      )
    );

    try {
      const data = await postJSON("/api/batch", {
        items: pending.map((x) => ({ isbn: x.isbn, scannedAt: x.scannedAt })),
      });

      const byIsbn = new Map((data.results || []).map((r) => [r.isbn, r]));

      setItems((prev) =>
        prev.map((it) => {
          if (!pendingIsbns.has(it.isbn) || it.status !== "uploading") return it;
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
