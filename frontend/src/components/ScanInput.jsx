import { useEffect, useRef } from "react";

const SCAN_DONE_DELAY_MS = 80;

export default function ScanInput({ value, onChange, onSubmit, placeholder, autoFocus, inputRef }) {
  const timerRef = useRef(null);
  const localRef = useRef(null);
  const ref = inputRef || localRef;

  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(timerRef.current);
      onSubmitRef.current();
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onSubmitRef.current(), SCAN_DONE_DELAY_MS);
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
