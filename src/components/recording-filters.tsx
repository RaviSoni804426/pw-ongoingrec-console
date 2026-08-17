'use client';

import { Input } from '@/components/ui/input';

export interface RecordingWindow {
  from: string;
  to: string;
  fromTime: string;
  toTime: string;
}

export const EMPTY_WINDOW: RecordingWindow = { from: '', to: '', fromTime: '', toTime: '' };

/** Windows a reviewer actually asks for, rather than making them type 10:00 each time. */
const PRESETS: { label: string; fromTime: string; toTime: string }[] = [
  { label: 'Morning (9–1)', fromTime: '09:00', toTime: '13:00' },
  { label: 'Afternoon (1–5)', fromTime: '13:00', toTime: '17:00' },
  { label: 'Evening (5–9)', fromTime: '17:00', toTime: '21:00' },
];

/**
 * Narrows a counsellor's recordings to a date range and a time of day.
 *
 * The time is centre-local — 10:00 means 10 in the morning where the counsellor
 * is sitting. It matches recordings that *overlap* the window rather than only
 * those starting inside it, so a call running from 09:50 to 10:40 appears in a
 * 10-to-2 search. Those are usually the long conversations worth reviewing, and
 * filtering on start time alone would hide exactly those.
 */
export const RecordingFilters = ({
  value,
  onChange,
  resultCount,
}: {
  value: RecordingWindow;
  onChange: (next: RecordingWindow) => void;
  resultCount?: number;
}) => {
  const set = (patch: Partial<RecordingWindow>) => onChange({ ...value, ...patch });
  const active = Object.values(value).some(Boolean);

  return (
    <div className="space-y-2" data-testid="recording-filters">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          From date
          <Input
            type="date"
            value={value.from}
            onChange={(e) => set({ from: e.target.value })}
            className="h-8 w-40"
            data-testid="filter-from-date"
          />
        </label>

        <label className="text-xs text-muted-foreground">
          To date
          <Input
            type="date"
            value={value.to}
            onChange={(e) => set({ to: e.target.value })}
            className="h-8 w-40"
            data-testid="filter-to-date"
          />
        </label>

        <label className="text-xs text-muted-foreground">
          From time
          <Input
            type="time"
            value={value.fromTime}
            onChange={(e) => set({ fromTime: e.target.value })}
            className="h-8 w-32"
            data-testid="filter-from-time"
          />
        </label>

        <label className="text-xs text-muted-foreground">
          To time
          <Input
            type="time"
            value={value.toTime}
            onChange={(e) => set({ toTime: e.target.value })}
            className="h-8 w-32"
            data-testid="filter-to-time"
          />
        </label>

        {active ? (
          <button
            type="button"
            onClick={() => onChange(EMPTY_WINDOW)}
            className="h-8 rounded-md border px-3 text-sm hover:bg-muted"
            data-testid="filter-clear"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => set({ fromTime: preset.fromTime, toTime: preset.toTime })}
            aria-pressed={value.fromTime === preset.fromTime && value.toTime === preset.toTime}
            data-testid={`filter-preset-${preset.fromTime}`}
            className={`rounded-md px-2.5 py-1 text-xs ${
              value.fromTime === preset.fromTime && value.toTime === preset.toTime
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-muted'
            }`}
          >
            {preset.label}
          </button>
        ))}

        {active && resultCount !== undefined ? (
          <span className="text-xs text-muted-foreground" data-testid="filter-result-count">
            {resultCount} recording{resultCount === 1 ? '' : 's'} in this window
          </span>
        ) : null}
      </div>

      {value.fromTime || value.toTime ? (
        // Said explicitly, because a reviewer who assumes UTC will misread every
        // result, and a reviewer who assumes start-time-only will think a
        // recording is missing when it is right there.
        <p className="text-xs text-muted-foreground">
          Times are local to the centre. A recording that overlaps the window is included, even if
          it started before it.
        </p>
      ) : null}
    </div>
  );
};
