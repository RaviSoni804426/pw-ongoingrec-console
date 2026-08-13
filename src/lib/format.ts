/**
 * Display formatting.
 *
 * Every timestamp from the backend is UTC (hard rule 7). Local time exists only
 * here, and always in the *centre's* timezone rather than the viewer's — a
 * manager in Delhi reviewing a Kota centre must see Kota's clock, or every
 * coverage conversation becomes an argument about which day it was.
 */

export const DEFAULT_TZ = 'Asia/Kolkata';

export const formatInCentreTz = (
  iso: string | Date | undefined,
  timezone = DEFAULT_TZ,
  options: Intl.DateTimeFormatOptions = {},
): string => {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options,
  }).format(date);
};

export const formatTimeOnly = (iso: string | Date | undefined, timezone = DEFAULT_TZ): string =>
  formatInCentreTz(iso, timezone, {
    year: undefined,
    month: undefined,
    day: undefined,
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatDateOnly = (iso: string | Date | undefined, timezone = DEFAULT_TZ): string =>
  formatInCentreTz(iso, timezone, {
    hour: undefined,
    minute: undefined,
    weekday: 'short',
  });

/** The exact UTC value, for the hover title on every rendered timestamp. */
export const utcTitle = (iso: string | Date | undefined): string => {
  if (!iso) return '';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toISOString()} (UTC)`;
};

export const formatDuration = (seconds: number | undefined): string => {
  if (seconds === undefined || Number.isNaN(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};

/** mm:ss for the player transport, where hours never appear. */
export const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const formatBytes = (bytes: number | undefined): string => {
  if (bytes === undefined) return '—';
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
};

export const formatRelative = (iso: string | undefined): string => {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';

  const deltaSec = Math.round((Date.now() - then) / 1000);
  if (deltaSec < 60) return `${deltaSec}s ago`;
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`;
  if (deltaSec < 86_400) return `${Math.floor(deltaSec / 3600)}h ago`;
  return `${Math.floor(deltaSec / 86_400)}d ago`;
};

/**
 * RAG band for a coverage percentage.
 *
 * `none` is distinct from `bad` on purpose: no CRM walk-ins logged means there
 * is nothing to be covered, which is a data gap rather than a recording
 * failure. Painting it red would train people to ignore red.
 */
export type RagBand = 'good' | 'warn' | 'bad' | 'none';

export const ragBand = (coveragePct: number, crmWalkIns: number): RagBand => {
  if (crmWalkIns === 0) return 'none';
  if (coveragePct >= 95) return 'good';
  if (coveragePct >= 80) return 'warn';
  return 'bad';
};

export const ragClass: Record<RagBand, string> = {
  good: 'bg-rag-good text-white',
  warn: 'bg-rag-warn text-black',
  bad: 'bg-rag-bad text-white',
  none: 'bg-rag-none text-black/70',
};

/** Human label for a FR-G2 gap cause. */
export const gapCauseLabel: Record<string, string> = {
  MACHINE_OFF: 'Machine off',
  SLEEP: 'Sleep',
  AGENT_DOWN: 'Agent down',
  DEVICE_REMOVED: 'Device removed',
  DEVICE_MISSING: 'No device',
  DEVICE_MUTED: 'Device muted',
  PERMISSION_DENIED: 'Mic permission denied',
  EXCLUSIVE_LOCK: 'Device locked by another app',
  DEVICE_FAULT: 'Device fault',
  SILENCE: 'Sustained silence',
  UPLOAD_PENDING: 'Upload pending',
  SHORT_CONVERSATION: 'Below minimum duration',
  CRM_DATA_ERROR: 'CRM data error',
  UNKNOWN: 'Unknown',
};
