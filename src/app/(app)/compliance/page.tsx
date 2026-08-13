'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Timestamp } from '@/components/timestamp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { formatBytes } from '@/lib/format';
import { useAccessLog, useLegalHolds, usePurgeLog } from '@/lib/queries';
import type { AccessLogEntry } from '@/lib/schemas';

const ACTIONS = ['', 'STREAM', 'DOWNLOAD', 'VIEW_TRANSCRIPT', 'EXPORT', 'SEARCH', 'DENIED'];

export default function CompliancePage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const accessLog = useAccessLog({ action: action || undefined, page, limit: 50 });
  const holds = useLegalHolds();
  const purge = usePurgeLog();

  const exportCsv = () => {
    const rows = accessLog.data?.items ?? [];
    const header = ['at', 'user', 'roles', 'action', 'conversationId', 'ip', 'reason', 'denied'];
    const csv = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.at,
          userLabel(row),
          row.role.join(' '),
          row.action,
          row.conversationId ?? '',
          row.ip ?? '',
          row.reason ?? '',
          row.denied ? 'yes' : '',
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `access-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Compliance"
        description="Who listened to what, what is under legal hold, and what the purge deleted."
      />

      <div className="space-y-6 p-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Access log</CardTitle>
            <div className="flex items-center gap-2">
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by action"
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a || 'All actions'}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={exportCsv} data-testid="export-csv">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>

          <CardContent className="px-0">
            {accessLog.isPending ? <LoadingBlock /> : null}
            {accessLog.isError ? <ErrorBlock error={accessLog.error} /> : null}

            {accessLog.data ? (
              accessLog.data.items.length === 0 ? (
                <EmptyBlock>No access has been recorded yet.</EmptyBlock>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>At</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Conversation</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accessLog.data.items.map((row) => (
                        <TableRow key={row._id} data-testid="access-log-row">
                          <TableCell>
                            <Timestamp value={row.at} />
                          </TableCell>
                          <TableCell>
                            {userLabel(row)}
                            <p className="text-xs text-muted-foreground">{row.role.join(', ')}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.denied ? 'bad' : 'secondary'}>{row.action}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {row.conversationId ?? '—'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate" title={row.reason ?? row.detail}>
                            {row.reason ?? row.detail ?? '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{row.ip ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Pagination
                    page={accessLog.data.page}
                    limit={accessLog.data.limit}
                    total={accessLog.data.total}
                    onPage={setPage}
                  />
                </>
              )
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Legal holds</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {holds.isPending ? <LoadingBlock /> : null}
              {holds.data?.length === 0 ? <EmptyBlock>No legal holds.</EmptyBlock> : null}
              {holds.data && holds.data.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placed</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Conversations</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holds.data.map((hold) => (
                      <TableRow key={hold._id}>
                        <TableCell>
                          <Timestamp value={hold.placedAt} />
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={hold.reason}>
                          {hold.reason}
                        </TableCell>
                        <TableCell className="tabular text-right">
                          {hold.conversationIds.length}
                        </TableCell>
                        <TableCell>
                          <Badge variant={hold.releasedAt ? 'secondary' : 'warn'}>
                            {hold.releasedAt ? 'released' : 'active'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Purge log</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {purge.isPending ? <LoadingBlock /> : null}
              {purge.data?.length === 0 ? (
                <EmptyBlock>The purge has not run yet.</EmptyBlock>
              ) : null}
              {purge.data && purge.data.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run</TableHead>
                      <TableHead className="text-right">Conversations</TableHead>
                      <TableHead className="text-right">Segments</TableHead>
                      <TableHead className="text-right">Freed</TableHead>
                      <TableHead className="text-right">Held</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purge.data.map((run) => (
                      <TableRow key={run._id}>
                        <TableCell>
                          <Timestamp value={run.runAt} />
                        </TableCell>
                        <TableCell className="tabular text-right">{run.conversationsPurged}</TableCell>
                        <TableCell className="tabular text-right">{run.segmentsPurged}</TableCell>
                        <TableCell className="tabular text-right">
                          {formatBytes(run.bytesFreed)}
                        </TableCell>
                        <TableCell className="tabular text-right">{run.skippedForHold}</TableCell>
                        <TableCell>
                          {run.errors.length === 0 ? (
                            <span className="text-muted-foreground">none</span>
                          ) : (
                            <Badge variant="bad">{run.errors.length}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

const userLabel = (row: AccessLogEntry): string =>
  typeof row.userId === 'string' ? row.userId : (row.userId.name ?? row.userId.email);
