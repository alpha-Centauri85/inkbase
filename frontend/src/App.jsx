import { useState } from "react";
import TabNav from "./components/TabNav.jsx";
import ShopifyConnectButton from "./components/ShopifyConnectButton.jsx";
import SingleScanPanel from "./pages/SingleScanPanel.jsx";

const TABS = [
  { id: "single", label: "Single Scan" },
  { id: "batch", label: "Batch Scan" },
  { id: "manual", label: "Manual Entry" },
];

const BLURB_KEY = "default_custom_blurb_v1";
const DEFAULT_BLURB = "Your default blurb goes here.";

function loadInitialBlurb() {
  const saved = localStorage.getItem(BLURB_KEY);
  return (saved ?? DEFAULT_BLURB).trim();
}

export default function App() {
  const [activeTab, setActiveTab] = useState("single");
  const [blurb, setBlurb] = useState(loadInitialBlurb);

  function handleBlurbChange(value) {
    setBlurb(value);
    localStorage.setItem(BLURB_KEY, value);
  }

  function handleEditInManual() {
    // Wired up fully in Task 6/7; no-op placeholder for now.
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Inkbase</h1>
        <ShopifyConnectButton />
      </div>
      <div className="hint">Use tabs to switch between modes. Scanner focus stays on the active tab.</div>
      <TabNav tabs={TABS} activeTab={activeTab} onSelect={setActiveTab} />

      {activeTab === "single" && (
        <SingleScanPanel blurb={blurb} onBlurbChange={handleBlurbChange} onEditInManual={handleEditInManual} />
      )}
      {activeTab === "batch" && <div className="card">Batch Scan panel coming soon.</div>}
      {activeTab === "manual" && <div className="card">Manual Entry panel coming soon.</div>}
    </div>
  );
}
