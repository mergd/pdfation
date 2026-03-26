const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatRelativeDate = (iso: string): string => {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m}m ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h}h ago`;
  }
  if (diff < 3 * DAY) {
    const d = Math.floor(diff / DAY);
    return d === 1 ? "yesterday" : `${d}d ago`;
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
