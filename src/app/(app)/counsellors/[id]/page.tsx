'use client';

import Link from 'next/link';
import { use, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Timestamp } from '@/components/timestamp';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import { formatDuration, formatRelative, gapCauseLabel, ragBand, ragClass } from '@/lib/format';
import { useConversations, useCounsellor, useCoverageTrend, useOrgTree } from '@/lib/queries';
import { CounsellorScores } from '@/components/counsellor-scores';
import { refTimezone, type Conversation } from '@/lib/schemas';

export default function CounsellorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const counsellor = useCounsellor(id);
  const conversations = useConversations({ counsellorId: id, limit: 100 });
  const trend = useCoverageTrend({ counsellorId: id, days: 30 });

  // The org tree already carries agent state per counsellor, so the identity
  // strip costs no extra request.
  const tree = useOrgTree();
  const agent = useMemo(() => {
    for (const centre of tree.data ?? []) {
      const found = [
        ...centre.teams.flatMap((team) => team.counsellors),
        ...centre.unassignedCounsellors,
      ].find((c) => c._id === id);
      if (found) return { counsellor: found, centreName: centre.name };
    }
    return null;
  }, [tree.data, id]);

  // Date-grouped list (§6.2): a counsellor's day is the unit a manager thinks in.
  const byDay = useMemo(() => {
    const groups = new Map<string, Conversation[]>();
    for (const conversation of conversations.data?.items ?? []) {
      const tz = refTimezone(conversation.centreId);
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(conversation.startUtc));
      if (!groups.has(day)) groups.set(day, []);
      groups.get(day)!.push(conversation);
    }
    return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [conversations.data]);

  if (counsellor.isPending) return <LoadingBlock />;
  if (counsellor.isError) return <ErrorBlock error={counsellor.error} />;

  return (
    <>
      <PageHeader
        title={counsellor.data?.name ?? 'Counsellor'}
        description={[
          counsellor.data?.employeeId ?? '—',
          agent?.centreName,
          agent?.counsellor.agentState && agent.counsellor.agentState !== 'ACTIVE'
            ? `agent ${agent.counsellor.agentState.toLowerCase()}`
            : null,
          agent?.counsellor.lastSegmentAt
            ? `last recording ${formatRelative(agent.counsellor.lastSegmentAt)}`
            : 'no recordings yet',
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Scores and flags</CardTitle>
          </CardHeader>
          <CardContent>
            <CounsellorScores counsellorUserId={id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>30-day coverage trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.isPending ? <LoadingBlock /> : null}
            {trend.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No coverage has been computed for this counsellor yet.
              </p>
            ) : null}
            {trend.data && trend.data.length > 0 ? (
              <>
                <div className="flex items-end gap-1" role="img" aria-label="Coverage by day">
                  {trend.data.map((day) => {
                    const band = ragBand(day.coveragePct, day.crmWalkIns);
                    return (
                      <div
                        key={day._id}
                        title={`${day.date}: ${day.matched}/${day.crmWalkIns} walk-ins, ${day.capturedConversations} conversations`}
                        className={`h-12 min-w-[8px] flex-1 rounded-sm ${ragClass[band]}`}
                      />
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {trend.data[0]?.date} → {trend.data[trend.data.length - 1]?.date}
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {conversations.isPending ? <LoadingBlock /> : null}
            {conversations.isError ? <ErrorBlock error={conversations.error} /> : null}
            {byDay.length === 0 && conversations.data ? (
              <EmptyBlock>No conversations recorded for this counsellor.</EmptyBlock>
            ) : null}

            {byDay.map(([day, items]) => {
              const trendDay = trend.data?.find((d) => d.date === day);
              return (
                <div key={day} className="border-b last:border-0">
                  <div className="flex items-center justify-between bg-muted/30 px-4 py-2">
                    <p className="text-sm font-medium tabular">{day}</p>
                    <div className="flex items-center gap-2">
                      {trendDay
                        ? trendDay.gaps
                            .filter((gap) => gap.durationSec > 900)
                            .sort((a, b) => b.durationSec - a.durationSec)
                            .slice(0, 2)
                            .map((gap) => (
                              <Badge
                                key={gap.cause}
                                variant={gap.cause === 'UNKNOWN' ? 'bad' : 'secondary'}
                                title="Capture gap on this day"
                              >
                                {gapCauseLabel[gap.cause] ?? gap.cause} {formatDuration(gap.durationSec)}
                              </Badge>
                            ))
                        : null}
                      <span className="text-xs text-muted-foreground">
                        {items.length} conversation{items.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  <ul>
                    {items
                      .sort((a, b) => (a.startUtc < b.startUtc ? -1 : 1))
                      .map((conversation) => (
                        <li key={conversation._id}>
                          <Link
                            href={`/conversations/${conversation._id}`}
                            className="flex items-center justify-between gap-4 px-4 py-2 text-sm hover:bg-muted/50"
                            data-testid="counsellor-conversation-link"
                          >
                            <Timestamp
                              value={conversation.startUtc}
                              timezone={refTimezone(conversation.centreId)}
                              options={{ year: undefined, month: undefined, day: undefined }}
                              className="tabular"
                            />
                            <span className="flex items-center gap-3">
                              {conversation.partial ? <Badge variant="warn">partial</Badge> : null}
                              {conversation.segmentIds.length > 1 ? (
                                <span className="text-xs text-muted-foreground">
                                  {conversation.segmentIds.length} segments
                                </span>
                              ) : null}
                              <span className="tabular text-muted-foreground">
                                {formatDuration(conversation.durationSec)}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
