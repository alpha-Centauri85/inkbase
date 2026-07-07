import { useState } from "react";
import TabNav from "./components/TabNav.jsx";

const TABS = [
  { id: "single", label: "Single Scan" },
  { id: "batch", label: "Batch Scan" },
  { id: "manual", label: "Manual Entry" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("single");

  return (
    <div>
      <h1>Inkbase</h1>
      <div className="hint">Use tabs to switch between modes. Scanner focus stays on the active tab.</div>
      <TabNav tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />
      {activeTab === "single" && <div className="card">Single Scan panel coming soon.</div>}
      {activeTab === "batch" && <div className="card">Batch Scan panel coming soon.</div>}
      {activeTab === "manual" && <div className="card">Manual Entry panel coming soon.</div>}
    </div>
  );
}
