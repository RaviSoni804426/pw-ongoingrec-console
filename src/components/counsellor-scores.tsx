'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AlertOctagon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyBlock, LoadingBlock } from '@/components/ui/spinner';
import { useCounsellorHistory, usePublishedRubric } from '@/lib/queries';
import type { Audit, AuditFlag } from '@/lib/schemas';

/**
 * How this person is doing, over time.
 *
 * The point of the screen is the answer to "where is this person weak", so the
 * per-criterion breakdown is the part that matters — a single average tells a
 * reviewer nothing they can coach on.
 */
export const CounsellorScores = ({ counsellorUserId }: { counsellorUserId: string }) => {
  const history = useCounsellorHistory(counsellorUserId);
  const rubricQuery = usePublishedRubric();

  // Memoised so the derived lists below do not recompute on every render.
  const audits = useMemo(() => history.data?.audits ?? [], [history.data]);
  const flags = history.data?.flags ?? [];
  const rubric = rubricQuery.data;

  const scored = useMemo(
    () => audits.filter((a) => typeof a.normalisedScore === 'number'),
    [audits],
  );

  const weakest = useMemo(() => {
    if (!rubric) return [];

    const labels = new Map(
      rubric.sections.flatMap((s) => s.criteria.map((c) => [c.key, c.label] as const)),
    );

    const totals = new Map<string, { sum: number; count: number }>();
    for (const audit of audits) {
      for (const score of audit.criterionScores) {
        const current = totals.get(score.criterionKey) ?? { sum: 0, count: 0 };
        current.sum += score.score;
        current.count += 1;
        totals.set(score.criterionKey, current);
      }
    }

    return [...totals.entries()]
      .map(([key, { sum, count }]) => ({
        key,
        label: labels.get(key) ?? key,
        mean: sum / count,
        count,
      }))
      // Two observations is not a trend. Reporting a weakness off one
      // conversation would send a reviewer to coach a bad day.
      .filter((row) => row.count >= 2)
      .sort((a, b) => a.mean - b.mean)
      .slice(0, 4);
  }, [audits, rubric]);

  if (history.isPending) return <LoadingBlock />;

  if (scored.length === 0 && flags.length === 0) {
    return (
      <EmptyBlock>
        Nothing has been scored for this counsellor yet. Scores appear once a recording has been
        transcribed and reviewed.
      </EmptyBlock>
    );
  }

  return (
    <div className="space-y-4" data-testid="counsellor-scores">
      {scored.length > 0 ? (
        <>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-semibold tabular" data-testid="counsellor-mean-score">
              {Math.round(scored.reduce((sum, a) => sum + a.normalisedScore!, 0) / scored.length)}
            </span>
            <span className="text-sm text-muted-foreground">
              mean across {scored.length} scored recording{scored.length === 1 ? '' : 's'}
            </span>
          </div>

          <ScoreTrend audits={scored} />
        </>
      ) : null}

      {weakest.length > 0 ? (
        <div>
          <h4 className="mb-1 text-sm font-medium">Weakest criteria</h4>
          <ul className="space-y-1" data-testid="weakest-criteria">
            {weakest.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
                <span>{row.label}</span>
                <span className="tabular text-muted-foreground">
                  {row.mean.toFixed(1)} / 5 · {row.count} recordings
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {flags.length > 0 ? (
        <div>
          <h4 className="mb-1 text-sm font-medium">Compliance flags</h4>
          <ul className="space-y-1" data-testid="counsellor-flags">
            {flags.slice(0, 8).map((item) => (
              <li key={item._id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-1.5">
                  {item.severity === 'CRITICAL' ? (
                    <AlertOctagon className="h-3 w-3 text-destructive" />
                  ) : null}
                  <Link
                    href={`/conversations/${item.conversationId}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {item.ruleKey}
                  </Link>
                </span>
                <Badge variant={item.state === 'CONFIRMED' ? 'bad' : 'outline'}>
                  {item.state === 'OPEN' ? 'Awaiting review' : item.state}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Oldest to newest, left to right.
 *
 * A bare sparkline with no scale invites reading a wobble as a trend, so the
 * range is stated underneath.
 */
const ScoreTrend = ({ audits }: { audits: Audit[] }) => {
  const points = [...audits].reverse();

  return (
    <div>
      <div className="flex items-end gap-1" role="img" aria-label="Score over time">
        {points.map((audit) => {
          const score = audit.normalisedScore ?? 0;
          const tone =
            score >= 85
              ? 'bg-emerald-500'
              : score >= 70
                ? 'bg-sky-500'
                : score >= 55
                  ? 'bg-amber-500'
                  : 'bg-destructive';

          return (
            <div
              key={audit._id}
              title={`${score} (${audit.band ?? 'unbanded'})${audit.type === 'AI' ? ' · AI, not yet reviewed' : ''}`}
              style={{ height: `${Math.max(4, score * 0.48)}px` }}
              className={`min-w-[6px] flex-1 rounded-sm ${tone} ${
                // An unreviewed AI score is advisory. Showing it identically to
                // a human judgement would overstate what is actually known.
                audit.type === 'AI' ? 'opacity-50' : ''
              }`}
            />
          );
        })}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Oldest to newest. Faded bars are AI scores a person has not confirmed.
      </p>
    </div>
  );
};

export type { AuditFlag };
