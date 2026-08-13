import { formatInCentreTz, utcTitle } from '@/lib/format';

/**
 * Every timestamp in the console renders in the centre's timezone with the
 * exact UTC value on hover (PRD §10.6). Using this component everywhere is what
 * keeps that promise true rather than aspirational.
 */
export const Timestamp = ({
  value,
  timezone,
  options,
  className,
}: {
  value: string | Date | undefined;
  timezone?: string;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
}) => (
  <time dateTime={typeof value === 'string' ? value : value?.toISOString()} title={utcTitle(value)} className={className}>
    {formatInCentreTz(value, timezone, options)}
  </time>
);
