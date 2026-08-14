'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Timestamp } from '@/components/timestamp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import { formatDuration, formatRelative } from '@/lib/format';
import { useCrmInteractions, useCrmSnapshot, useRefreshCrm } from '@/lib/queries';
import { refName } from '@/lib/schemas';

type Sort = 'score' | 'time';

/**
 * Walk-ins from the CRM, joined to the recording of each and what it scored.
 *
 * This is the one screen where the two systems meet, so it says plainly when
 * they do not: an interaction with no recording, or a recording with no CRM
 * row, is visible rather than quietly missing from a total.
 */
export default function CrmPage() {
  const [sort, setSort] = useState<Sort>('time');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [band, setBand] = useState<'' | 'poor' | 'good'>('');

  const snapshot = useCrmSnapshot();
  const refresh = useRefreshCrm();

  const interactions = useCrmInteractions({
    sort,
    order,
    minScore: band === 'good' ? 70 : undefined,
    maxScore: band === 'poor' ? 69 : undefined,
  });

  const toggle = (next: Sort) => {
    if (sort === next) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(next);
      setOrder('desc');
    }
  };

  return (
    <>
      <PageHeader
        title="CRM"
        description="Walk-ins from the CRM sheet, with the recording and score for each."
        actions={
          <div className="flex items-center gap-2">
            {snapshot.data?.fetchedAt ? (
              <span className="text-xs text-muted-foreground" data-testid="crm-fetched-at">
                Synced {formatRelative(snapshot.data.fetchedAt)}
              </span>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={refresh.isPending}
              onClick={() => refresh.mutate()}
              data-testid="crm-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${refresh.isPending ? 'animate-spin' : ''}`} />
              Refresh CRM data
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {snapshot.data && !snapshot.data.connected ? (
          // Said out loud rather than shown as an empty table, which would read
          // as a CRM with no walk-ins in it.
          <p className="rounded-md border border-amber-500/40 bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            No CRM is connected — the adapter is set to <code>{snapshot.data.adapter}</code>. The
            rows below come from recordings alone, and coverage percentages will read as zero.
          </p>
        ) : null}

        {refresh.isError ? <ErrorBlock error={refresh.error} /> : null}

        {refresh.data ? (
          <p className="text-xs text-muted-foreground" data-testid="crm-refresh-result">
            {refresh.data.connected
              ? `Read ${refresh.data.rows} rows from the sheet.`
              : refresh.data.message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1">
          {[
            { key: '' as const, label: 'All' },
            { key: 'poor' as const, label: 'Scored below 70' },
            { key: 'good' as const, label: 'Scored 70 and above' },
          ].map((option) => (
            <button
              key={option.key || 'all'}
              type="button"
              onClick={() => setBand(option.key)}
              aria-pressed={band === option.key}
              data-testid={`crm-band-${option.key || 'all'}`}
              className={`rounded-md px-3 py-1.5 text-sm ${
                band === option.key ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {interactions.isPending ? <LoadingBlock /> : null}
        {interactions.isError ? <ErrorBlock error={interactions.error} /> : null}

        {interactions.data && interactions.data.items.length === 0 ? (
          <EmptyBlock>No interactions match these filters.</EmptyBlock>
        ) : null}

        {interactions.data && interactions.data.items.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortButton active={sort === 'time'} order={order} onClick={() => toggle('time')}>
                        When
                      </SortButton>
                    </TableHead>
                    <TableHead>Counsellor</TableHead>
                    <TableHead>CRM</TableHead>
                    <TableHead>
                      <SortButton
                        active={sort === 'score'}
                        order={order}
                        onClick={() => toggle('score')}
                      >
                        Score
                      </SortButton>
                    </TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {interactions.data.items.map((item) => (
                    <TableRow key={item.conversationId} data-testid="crm-row">
                      <TableCell>
                        <div className="flex flex-col">
                          <Timestamp value={item.startUtc} />
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(item.durationSec)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>{refName(item.counsellor, '—')}</TableCell>

                      <TableCell>
                        {item.matched ? (
                          <div className="flex flex-col">
                            <span className="text-sm">{item.crmLink?.leadId}</span>
                            {item.crmLink?.disposition ? (
                              <span className="text-xs text-muted-foreground">
                                {item.crmLink.disposition}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {item.crmLink?.status === 'AMBIGUOUS' ? 'Ambiguous' : 'No CRM match'}
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <ScoreCell item={item} />
                      </TableCell>

                      <TableCell>
                        {item.flagCount > 0 ? (
                          <span
                            className="flex items-center gap-1 text-sm text-destructive"
                            data-testid="crm-flag-count"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {item.flagCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <Link
                          href={`/conversations/${item.conversationId}`}
                          className="text-sm underline-offset-2 hover:underline"
                          data-testid="crm-open"
                        >
                          Review
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

const SortButton = ({
  active,
  order,
  onClick,
  children,
}: {
  active: boolean;
  order: 'asc' | 'desc';
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={`crm-sort-${String(children).toLowerCase()}`}
    className="flex items-center gap-1 hover:underline"
  >
    {children}
    {active ? <span aria-hidden>{order === 'asc' ? '▲' : '▼'}</span> : null}
  </button>
);

/**
 * An unscored interaction reads as unknown, not as zero.
 *
 * Sorting by score puts these last in both directions for the same reason: they
 * are not the worst performers, and burying them at the bottom of an ascending
 * list would say they were.
 */
const ScoreCell = ({
  item,
}: {
  item: { score: number | null; band: string | null; provisional: boolean };
}) => {
  if (item.score === null) {
    return <span className="text-xs text-muted-foreground">Not scored</span>;
  }

  const tone =
    item.score >= 85
      ? 'text-emerald-600'
      : item.score >= 70
        ? 'text-sky-600'
        : item.score >= 55
          ? 'text-amber-600'
          : 'text-destructive';

  return (
    <div className="flex items-center gap-1.5">
      <span className={`tabular font-medium ${tone}`} data-testid="crm-score">
        {item.score}
      </span>
      {item.band ? <span className="text-xs text-muted-foreground">{item.band}</span> : null}
      {item.provisional ? (
        // The AI score is advisory until a person has looked at it, and a
        // number that has not been reviewed should not read like one that has.
        <Badge variant="outline" className="text-xs" data-testid="crm-score-provisional">
          AI
        </Badge>
      ) : null}
    </div>
  );
};
