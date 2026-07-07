import { useState } from "react";
import { checkPrice } from "../lib/api.js";

export default function PriceCheck({ price, onPriceChange, title, author }) {
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  async function handleCheck() {
    setChecking(true);
    setError("");
    setResults(null);

    try {
      const data = await checkPrice({ title, author });
      setResults(data.results || []);
    } catch (err) {
      setError(err.message || "Price check failed");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <label className="muted">Price</label>
      <div className="row" style={{ alignItems: "center" }}>
        <input
          value={price}
          onChange={(e) => onPriceChange(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
        />
        <button onClick={handleCheck} disabled={checking || !title}>
          {checking ? "Checking…" : "Check price"}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {results && results.length === 0 && (
        <div className="muted">No comparable listings found.</div>
      )}
      {results && results.length > 0 && (
        <ul className="list">
          {results.map((r, idx) => (
            <li
              key={idx}
              className="item"
              onClick={() => onPriceChange(r.price.toFixed(2))}
              style={{ cursor: "pointer" }}
            >
              <div className="item-left">
                <strong>${r.price.toFixed(2)} {r.currency}</strong>
                <div className="muted">{r.source}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
