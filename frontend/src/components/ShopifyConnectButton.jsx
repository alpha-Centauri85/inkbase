import { useEffect, useState } from "react";
import { getJSON, API_BASE } from "../lib/api.js";

export default function ShopifyConnectButton() {
  const [connected, setConnected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getJSON("/auth/status")
      .then((data) => {
        if (!cancelled) setConnected(Boolean(data.connected));
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (connected === null) {
    return <span className="muted">Checking Shopify connection…</span>;
  }

  if (connected) {
    return <span className="muted">Shopify connected ✓</span>;
  }

  return (
    <a className="muted" href={`${API_BASE}/auth`} target="_blank" rel="noreferrer">
      Connect to Shopify
    </a>
  );
}
