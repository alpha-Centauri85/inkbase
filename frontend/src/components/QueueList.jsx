export default function QueueList({ items, renderLabel, renderSub, onRemove }) {
  return (
    <ul className="list">
      {items.map((item, idx) => (
        <li className="item" key={item.key ?? idx}>
          <div className="item-left">
            <div><strong>{renderLabel(item)}</strong></div>
            <div className="muted">{renderSub(item)}</div>
            {item.status === "failed" && item.error && (
              <div className="error">{item.error}</div>
            )}
          </div>
          <div>
            <button onClick={() => onRemove(item)}>Remove</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
