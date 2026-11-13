export default function StatusMark({ group, label }: { group: string; label: string }) {
  return <p className={`status-mark status-${group}`}>{label}</p>;
}
