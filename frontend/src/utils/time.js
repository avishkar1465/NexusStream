const IST_TIME_ZONE = 'Asia/Kolkata';

function parseUtcTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;

  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)
    ? timestamp
    : `${timestamp}Z`;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatIstTimestamp(timestamp) {
  const parsed = parseUtcTimestamp(timestamp);
  if (!parsed) return '--';

  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(parsed)} IST`;
}
