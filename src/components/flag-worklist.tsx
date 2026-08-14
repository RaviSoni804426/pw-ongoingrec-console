'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Timestamp } from '@/components/timestamp';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import { formatClock } from '@/lib/format';
import { useFlagSummary, useFlagWorklist, useResolveFlag } from '@/lib/queries';
import { refName } from '@/lib/schemas';

/**
 * Compliance flags, worst first.
 *
 * The traffic light is a summary of severity, not a replacement for it: red is
 * Critical, amber is High, green means nothing outstanding. Severity is always
 * written out alongside the colour, because a colour alone is unreadable to
 * anyone who cannot distinguish red from green and unprintable in a report.
 */
type Light = 'red' | 'amber' | 'green' | 'all';

const LIGHTS: { key: Light; label: string; hint: string }[] = [
  { key: 'all', label: 'All', hint: 'Every flag, worst first' },
  { key: 'red', label: 'Critical', hint: 'Forces escalation regardless of score' },
  { key: 'amber', label: 'High and medium', hint: 'Needs a decision' },
  { key: 'green', label: 'Resolved', hint: 'Confirmed or dismissed by a person' },
];

export const FlagWorklist = () => {
  const [light, setLight] = useState<Light>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [counsellor, setCounsellor] = useState('');

  const summary = useFlagSummary();
  const worklist = useFlagWorklist({
    severity: light === 'red' ? 'CRITICAL' : undefined,
    state: light === 'green' ? 'CONFIRMED' : light === 'all' ? undefined : 'OPEN',
    from: from || undefined,
    to: to || undefined,
  });

  const items = (worklist.data?.items ?? []).filter((item) => {
    if (light === 'amber' && !['HIGH', 'MEDIUM'].includes(item.severity)) return false;
    if (!counsellor) return true;
    return refName(item.counsellorUserId, '').toLowerCase().includes(counsellor.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {summary.data ? (
        <div className="flex flex-wrap gap-3" data-testid="flag-summary">
          <Tally
            tone="red"
            icon={<AlertOctagon className="h-4 w-4" />}
            count={summary.data.critical}
            label="Critical"
          />
          <Tally
            tone="amber"
            icon={<AlertTriangle className="h-4 w-4" />}
            count={summary.data.high + summary.data.medium}
            label="High and medium"
          />
          <Tally
            tone="green"
            icon={<CheckCircle2 className="h-4 w-4" />}
            count={summary.data.resolved}
            label="Reviewed"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex gap-1" role="tablist">
          {LIGHTS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={light === item.key}
              title={item.hint}
              onClick={() => setLight(item.key)}
              data-testid={`flag-filter-${item.key}`}
              className={`rounded-md px-3 py-1.5 text-sm ${
                light === item.key ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="text-xs text-muted-foreground">
          From
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 w-40"
            data-testid="flag-from"
          />
        </label>

        <label className="text-xs text-muted-foreground">
          To
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 w-40"
            data-testid="flag-to"
          />
        </label>

        <label className="text-xs text-muted-foreground">
          Counsellor
          <Input
            value={counsellor}
            onChange={(e) => setCounsellor(e.target.value)}
            placeholder="Name"
            className="h-8 w-48"
            data-testid="flag-counsellor"
          />
        </label>
      </div>

      {worklist.isPending ? <LoadingBlock /> : null}
      {worklist.isError ? <ErrorBlock error={worklist.error} /> : null}

      {worklist.data && items.length === 0 ? (
        <EmptyBlock>
          Nothing matches these filters. An empty worklist is the intended state, not an error.
        </EmptyBlock>
      ) : null}

      <ul className="space-y-2" data-testid="flag-worklist">
        {items.map((item) => (
          <FlagRow key={item._id} item={item} />
        ))}
      </ul>
    </div>
  );
};

const Tally = ({
  tone,
  icon,
  count,
  label,
}: {
  tone: 'red' | 'amber' | 'green';
  icon: React.ReactNode;
  count: number;
  label: string;
}) => {
  const styles = {
    red: 'border-destructive/40 text-destructive',
    amber: 'border-amber-500/40 text-amber-700 dark:text-amber-500',
    green: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-500',
  }[tone];

  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 ${styles}`}>
      {icon}
      <span className="tabular text-lg font-semibold">{count}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
};

const FlagRow = ({
  item,
}: {
  item: {
    _id: string;
    ruleKey: string;
    severity: string;
    state: string;
    quote?: string;
    startMs?: number;
    conversationId: string;
    counsellorUserId: unknown;
    createdAt?: string;
    reviewNote?: string;
    actionTaken?: string;
  };
}) => {
  const resolve = useResolveFlag();
  const [remark, setRemark] = useState('');
  const open = item.state === 'OPEN';

  const tone =
    item.severity === 'CRITICAL'
      ? 'border-l-destructive'
      : item.severity === 'HIGH' || item.severity === 'MEDIUM'
        ? 'border-l-amber-500'
        : 'border-l-muted-foreground';

  return (
    <li>
      <Card className={`border-l-4 ${tone}`} data-testid="flag-row">
        <CardContent className="space-y-2 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {/* The word, not only the colour. */}
            <span className="font-medium" data-testid="flag-severity">
              {item.severity}
            </span>
            <span>{item.ruleKey}</span>
            <span className="text-xs text-muted-foreground">
              {refName(item.counsellorUserId, 'Unknown counsellor')}
            </span>
            {item.createdAt ? (
              <span className="text-xs text-muted-foreground">
                <Timestamp value={item.createdAt} />
              </span>
            ) : null}
            {!open ? (
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-500">
                {item.state}
              </span>
            ) : null}
          </div>

          {item.quote ? (
            <p className="text-xs">
              {item.startMs !== undefined ? (
                <span className="tabular mr-1 text-muted-foreground">
                  {formatClock(item.startMs / 1000)}
                </span>
              ) : null}
              “{item.quote}”
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/conversations/${item.conversationId}`}
              className="text-xs underline-offset-2 hover:underline"
              data-testid="flag-open-recording"
            >
              Listen to this
            </Link>

            {open ? (
              <>
                <Input
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Auditor remarks"
                  aria-label={`Remarks for ${item.ruleKey}`}
                  className="h-8 flex-1 text-xs"
                  data-testid="flag-remark"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={resolve.isPending}
                  onClick={() =>
                    resolve.mutate({
                      flagId: item._id,
                      decision: 'CONFIRMED',
                      note: remark,
                      actionTaken: remark,
                    })
                  }
                  data-testid="flag-resolve-confirm"
                >
                  Confirm
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={resolve.isPending}
                  onClick={() =>
                    resolve.mutate({ flagId: item._id, decision: 'DISMISSED', note: remark })
                  }
                  data-testid="flag-resolve-dismiss"
                >
                  Dismiss
                </Button>
              </>
            ) : (
              item.reviewNote && (
                <span className="text-xs text-muted-foreground">“{item.reviewNote}”</span>
              )
            )}
          </div>

          {item.severity === 'CRITICAL' && item.state === 'CONFIRMED' ? (
            <p className="text-xs font-medium text-destructive">
              Confirmed Critical. This escalates regardless of the conversation&apos;s score.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
};
