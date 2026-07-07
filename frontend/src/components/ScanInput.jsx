import { useEffect, useRef } from "react";

const SCAN_DONE_DELAY_MS = 80;

export default function ScanInput({ value, onChange, onSubmit, placeholder, autoFocus, inputRef }) {
  const timerRef = useRef(null);
  const localRef = useRef(null);
  const ref = inputRef || localRef;

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(timerRef.current);
      onSubmit();
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onSubmit, SCAN_DONE_DELAY_MS);
  }

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
  );
}
