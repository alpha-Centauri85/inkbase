export default function TabNav({ tabs, activeTab, onSelect }) {
  return (
    <div className="tabs" role="tablist" aria-label="Scanner modes">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className="tab-btn"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
