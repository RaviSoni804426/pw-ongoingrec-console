'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Timestamp } from '@/components/timestamp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import { API_BASE_URL, tokenStore } from '@/lib/api';
import { useAdminActivity } from '@/lib/queries';
import { refName } from '@/lib/schemas';

const ACTIONS = [
  '',
  'RUBRIC_PUBLISHED',
  'AUDIT_SUBMITTED',
  'AUDIT_SUPERSEDED',
  'FLAG_REVIEWED',
  'SPEAKER_TAG_CORRECTED',
  'USER_CREATED',
  'LEGAL_HOLD_PLACED',
];

/**
 * Who changed what.
 *
 * Separate from the access log, which records who *read* a recording. These
 * answer different questions and merging them would make both harder to read:
 * "who listened to this conversation" and "who gave that person access to it"
 * are separate investigations.
 */
export default function AdminPage() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [downloading, setDownloading] = useState(false);

  const activity = useAdminActivity({
    action: action || undefined,
    from: from || undefined,
    to: to || undefined,
  });

  /**
   * Fetched with the auth header rather than linked directly: the endpoint
   * needs a bearer token, and an anchor cannot carry one.
   */
  const download = async () => {
    setDownloading(true);

    try {
      const params = new URLSearchParams();
      if (action) params.set('action', action);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const response = await fetch(`${API_BASE_URL}/admin/activity.csv?${params}`, {
        headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` },
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'admin-activity.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Admin"
        description="Every change made through the console, and who made it."
      />

      <div className="space-y-4 p-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Activity log</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={downloading}
              onClick={() => void download()}
              data-testid="admin-export"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-muted-foreground">
                Action
                <select
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  aria-label="Filter by action"
                  data-testid="admin-action-filter"
                  className="block h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {ACTIONS.map((option) => (
                    <option key={option || 'all'} value={option}>
                      {option || 'All actions'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-muted-foreground">
                From
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-8 w-40"
                />
              </label>

              <label className="text-xs text-muted-foreground">
                To
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-8 w-40"
                />
              </label>
            </div>

            {activity.isPending ? <LoadingBlock /> : null}
            {activity.isError ? <ErrorBlock error={activity.error} /> : null}

            {activity.data && activity.data.items.length === 0 ? (
              <EmptyBlock>
                Nothing recorded for these filters. The log covers changes made through the
                console, not recordings played.
              </EmptyBlock>
            ) : null}

            {activity.data && activity.data.items.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>What changed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activity.data.items.map((item) => (
                    <TableRow key={item._id} data-testid="admin-activity-row">
                      <TableCell>
                        <Timestamp value={item.at} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{refName(item.actorUserId, item.actorEmail ?? 'Unknown')}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.actorRoles.join(', ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.summary ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
