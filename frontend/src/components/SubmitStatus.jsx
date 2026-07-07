export default function SubmitStatus({ message }) {
  if (!message) return null;
  return <div className="muted">{message}</div>;
}
