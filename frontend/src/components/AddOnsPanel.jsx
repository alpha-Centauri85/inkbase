const BOOK_SIZES = [
  "Pocket Paperback",
  "Standard Paperback",
  "Trade Paperback",
  "Hardcover",
  "Large Format",
];

export default function AddOnsPanel({ groupName, blurb, onBlurbChange, bookSize, onBookSizeChange }) {
  return (
    <section className="config-section">
      <h3>Listing Add-ons</h3>
      <label>
        Custom Blurb (appears under synopsis):
        <textarea
          rows={6}
          value={blurb}
          onChange={(e) => onBlurbChange(e.target.value)}
          placeholder="Condition notes, store message, shipping info..."
        />
      </label>
      <div style={{ marginTop: 10 }}>
        <div className="muted" style={{ marginBottom: 6 }}>Book Size:</div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="radio-grid">
          {BOOK_SIZES.map((size) => (
            <label key={size}>
              <input
                type="radio"
                name={`${groupName}-bookSize`}
                value={size}
                checked={bookSize === size}
                onChange={() => onBookSizeChange(size)}
              />
              {size}
            </label>
          ))}
        </fieldset>
      </div>
    </section>
  );
}
