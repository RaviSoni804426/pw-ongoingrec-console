'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDuration, gapCauseLabel, ragBand, ragClass } from '@/lib/format';
import { useCentres, useCoverage, useGapWorklist } from '@/lib/queries';
import { refId, refName, type CoverageDay } from '@/lib/schemas';

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export default function CoveragePage() {
  const [centreId, setCentreId] = useState('');
  const [days, setDays] = useState(14);

  const centres = useCentres();
  const from = isoDaysAgo(days);
  const to = isoDaysAgo(0);

  const coverage = useCoverage({ from, to, centreId: centreId || undefined });
  const worklist = useGapWorklist({ cause: 'UNKNOWN', centreId: centreId || undefined });

  // Centre rollup rows carry a null counsellor; per-counsellor rows do not.
  const { centreRows, counsellorRows, dates } = useMemo(() => {
    const rows = coverage.data ?? [];
    const centreRows = rows.filter((r) => !r.counsellorUserId);
    const counsellorRows = rows.filter((r) => r.counsellorUserId);
    const dates = [...new Set(rows.map((r) => r.date))].sort();
    return { centreRows, counsellorRows, dates };
  }, [coverage.data]);

  const centreGrid = useMemo(() => {
    const byCentre = new Map<string, { name: string; days: Map<string, CoverageDay> }>();
    for (const row of centreRows) {
      const id = refId(row.centreId) ?? 'unknown';
      if (!byCentre.has(id)) byCentre.set(id, { name: refName(row.centreId, id), days: new Map() });
      byCentre.get(id)!.days.set(row.date, row);
    }
    return [...byCentre.entries()];
  }, [centreRows]);

  return (
    <>
      <PageHeader
        title="Coverage"
        description="Captured conversations reconciled against CRM walk-ins, per centre-local day."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={centreId}
              onChange={(e) => setCentreId(e.target.value)}
              aria-label="Filter by centre"
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">All centres</option>
              {centres.data?.map((centre) => (
                <option key={centre._id} value={centre._id}>
                  {centre.name}
                </option>
              ))}
            </select>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label="Date range"
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <CrmCaveat />

        {coverage.isPending ? <LoadingBlock /> : null}
        {coverage.isError ? <ErrorBlock error={coverage.error} /> : null}

        {coverage.data && coverage.data.length === 0 ? (
          <EmptyBlock>
            No coverage has been computed for this range yet. The reconciliation worker runs hourly.
          </EmptyBlock>
        ) : null}

        {centreGrid.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Centre × day</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="sticky left-0 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Centre
                      </th>
                      {dates.map((date) => (
                        <th
                          key={date}
                          className="px-1 py-2 text-center text-xs font-medium text-muted-foreground"
                        >
                          {date.slice(5)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {centreGrid.map(([id, centre]) => (
                      <tr key={id} className="border-b last:border-0">
                        <td className="sticky left-0 bg-card px-3 py-2 font-medium">{centre.name}</td>
                        {dates.map((date) => {
                          const row = centre.days.get(date);
                          if (!row) {
                            return (
                              <td key={date} className="px-1 py-1">
                                <div className="h-8 rounded bg-muted/40" title="No data" />
                              </td>
                            );
                          }
                          const band = ragBand(row.coveragePct, row.crmWalkIns);
                          return (
                            <td key={date} className="px-1 py-1">
                              <div
                                data-testid="coverage-cell"
                                title={`${date} · ${row.matched}/${row.crmWalkIns} walk-ins captured · ${row.capturedConversations} conversations`}
                                className={`flex h-8 items-center justify-center rounded text-xs font-medium tabular ${ragClass[band]}`}
                              >
                                {band === 'none' ? '–' : `${Math.round(row.coveragePct)}%`}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Legend />
            </CardContent>
          </Card>
        ) : null}

        {counsellorRows.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Per counsellor</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Counsellor</TableHead>
                    <TableHead>Centre</TableHead>
                    <TableHead className="text-right">CRM walk-ins</TableHead>
                    <TableHead className="text-right">Captured</TableHead>
                    <TableHead className="text-right">Matched</TableHead>
                    <TableHead className="text-right">Coverage</TableHead>
                    <TableHead>Gap causes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {counsellorRows
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .slice(0, 200)
                    .map((row) => {
                      const band = ragBand(row.coveragePct, row.crmWalkIns);
                      const counsellorId = refId(row.counsellorUserId);
                      return (
                        <TableRow key={row._id} data-testid="coverage-counsellor-row">
                          <TableCell className="tabular">{row.date}</TableCell>
                          <TableCell>
                            {counsellorId ? (
                              <Link
                                href={`/counsellors/${counsellorId}`}
                                className="underline-offset-4 hover:underline"
                                data-testid="coverage-drilldown"
                              >
                                {refName(row.counsellorUserId, counsellorId)}
                              </Link>
                            ) : (
                              refName(row.counsellorUserId)
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {refName(row.centreId)}
                          </TableCell>
                          <TableCell className="tabular text-right">{row.crmWalkIns}</TableCell>
                          <TableCell className="tabular text-right">
                            {row.capturedConversations}
                          </TableCell>
                          <TableCell className="tabular text-right">{row.matched}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-medium tabular ${ragClass[band]}`}
                            >
                              {band === 'none' ? 'no CRM data' : `${Math.round(row.coveragePct)}%`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {row.gaps.length === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                row.gaps
                                  .sort((a, b) => b.durationSec - a.durationSec)
                                  .slice(0, 3)
                                  .map((gap) => (
                                    <Badge
                                      key={gap.cause}
                                      variant={gap.cause === 'UNKNOWN' ? 'bad' : 'secondary'}
                                    >
                                      {gapCauseLabel[gap.cause] ?? gap.cause}{' '}
                                      {formatDuration(gap.durationSec)}
                                    </Badge>
                                  ))
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Unknown-gap worklist</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <p className="px-4 pb-3 text-sm text-muted-foreground">
              Periods with no audio, no device fault and a live agent. These are the ones that need a
              manager&apos;s explanation.
            </p>
            {worklist.isPending ? <LoadingBlock /> : null}
            {worklist.isError ? <ErrorBlock error={worklist.error} /> : null}
            {worklist.data?.length === 0 ? (
              <EmptyBlock>No unexplained gaps. </EmptyBlock>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Counsellor</TableHead>
                    <TableHead>Centre</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {worklist.data?.slice(0, 50).map((gap) => (
                    <TableRow key={gap._id} data-testid="unknown-gap-row">
                      <TableCell>{refName(gap.counsellorUserId)}</TableCell>
                      <TableCell className="text-muted-foreground">{refName(gap.centreId)}</TableCell>
                      <TableCell className="tabular">{gap.startUtc.slice(0, 16).replace('T', ' ')}</TableCell>
                      <TableCell className="tabular">{formatDuration(gap.durationSec)}</TableCell>
                      <TableCell className="text-muted-foreground">{gap.detail ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/**
 * Cut A ships MockCrmAdapter, which returns no walk-ins. Coverage percentages
 * are therefore structurally 0 until a real CRM adapter lands. Saying so on the
 * screen is the difference between "the product is broken" and "this number is
 * not wired up yet".
 */
const CrmCaveat = () => (
  <div className="rounded-md border border-rag-warn/40 bg-rag-warn/10 p-3 text-sm">
    <p className="font-medium">CRM linkage is not connected in this build.</p>
    <p className="text-muted-foreground">
      Walk-in counts come from the CRM, and Cut A ships a mock adapter that returns none. Captured
      conversations and gap causes below are real; coverage percentages will stay at zero until the
      CRM adapter is wired up.
    </p>
  </div>
);

const Legend = () => (
  <div className="flex flex-wrap items-center gap-3 px-4 pt-3 text-xs text-muted-foreground">
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded bg-rag-good" /> ≥95%
    </span>
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded bg-rag-warn" /> 80–94%
    </span>
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded bg-rag-bad" /> &lt;80%
    </span>
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded bg-rag-none" /> no CRM walk-ins logged
    </span>
  </div>
);
