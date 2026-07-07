import { useRef, useState } from "react";
import TabNav from "./components/TabNav.jsx";
import ShopifyConnectButton from "./components/ShopifyConnectButton.jsx";
import SingleScanPanel from "./pages/SingleScanPanel.jsx";
import BatchScanPanel from "./pages/BatchScanPanel.jsx";
import ManualEntryPanel from "./pages/ManualEntryPanel.jsx";

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
  const [manualPrefill, setManualPrefill] = useState(null);

  const singleInputRef = useRef(null);
  const batchInputRef = useRef(null);
  const manualInputRef = useRef(null);
  const refsByTab = { single: singleInputRef, batch: batchInputRef, manual: manualInputRef };

  function handleBlurbChange(value) {
    setBlurb(value);
    localStorage.setItem(BLURB_KEY, value);
  }

  function handleSelectTab(tabId) {
    setActiveTab(tabId);
    setTimeout(() => refsByTab[tabId].current?.focus(), 0);
  }

  function handleEditInManual(book) {
    setManualPrefill({ ...book, createdAt: new Date().toISOString() });
    handleSelectTab("manual");
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Inkbase</h1>
        <ShopifyConnectButton />
      </div>
      <div className="hint">Use tabs to switch between modes. Scanner focus stays on the active tab.</div>
      <TabNav tabs={TABS} activeTab={activeTab} onSelect={handleSelectTab} />

      <div style={{ display: activeTab === "single" ? "block" : "none" }}>
        <SingleScanPanel
          blurb={blurb}
          onBlurbChange={handleBlurbChange}
          onEditInManual={handleEditInManual}
          inputRef={singleInputRef}
        />
      </div>
      <div style={{ display: activeTab === "batch" ? "block" : "none" }}>
        <BatchScanPanel inputRef={batchInputRef} />
      </div>
      <div style={{ display: activeTab === "manual" ? "block" : "none" }}>
        <ManualEntryPanel
          blurb={blurb}
          onBlurbChange={handleBlurbChange}
          prefill={manualPrefill}
          inputRef={manualInputRef}
        />
      </div>
    </div>
  );
}
