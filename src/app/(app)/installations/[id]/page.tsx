'use client';

import { use, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Timestamp } from '@/components/timestamp';
import { Badge, stateVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDuration, formatRelative, gapCauseLabel } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useDeactivate, useInstallation, useIssueCommand } from '@/lib/queries';
import { refName, refTimezone } from '@/lib/schemas';

/** TAD §2.8 minus the two Cut B commands (upload_range, force_update). */
const COMMANDS = [
  { type: 'upload_now', label: 'Upload now' },
  { type: 'collect_logs', label: 'Collect logs' },
  { type: 'update_config', label: 'Push config' },
  { type: 'purge_local', label: 'Purge local buffer' },
];

export default function InstallationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const detail = useInstallation(id);
  const issueCommand = useIssueCommand(id);
  const deactivate = useDeactivate(id);
  const { hasRole } = useAuth();

  const [reason, setReason] = useState('');

  if (detail.isPending) return <LoadingBlock />;
  if (detail.isError) return <ErrorBlock error={detail.error} />;
  if (!detail.data) return <EmptyBlock>Installation not found.</EmptyBlock>;

  const { installation, heartbeats, gaps, events, commands } = detail.data;
  const tz = refTimezone(installation.centreId);
  const canCommand = hasRole('SUPER_ADMIN', 'IT_ADMIN', 'CENTRE_HEAD');
  const canDeactivate = hasRole('SUPER_ADMIN', 'IT_ADMIN');

  return (
    <>
      <PageHeader
        title={installation.machineName ?? installation.machineId}
        description={`${refName(installation.counsellorUserId)} · ${refName(installation.centreId)}`}
        actions={<Badge variant={stateVariant(installation.state)}>{installation.state}</Badge>}
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Agent state" value={installation.agentState ?? '—'} />
          <Stat
            label="Capture device"
            value={installation.captureDevice?.name ?? '—'}
            detail={installation.deviceState}
            bad={installation.deviceState !== 'OK'}
          />
          <Stat
            label="Disk free"
            value={installation.diskFreeMb ? `${(installation.diskFreeMb / 1024).toFixed(1)} GB` : '—'}
          />
          <Stat
            label="Clock offset"
            value={
              installation.clockOffsetMs === undefined
                ? '—'
                : `${(installation.clockOffsetMs / 1000).toFixed(1)}s`
            }
            bad={Math.abs(installation.clockOffsetMs ?? 0) > 60_000}
          />
        </div>

        {canCommand ? (
          <Card>
            <CardHeader>
              <CardTitle>Commands</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {COMMANDS.map((command) => (
                  <Button
                    key={command.type}
                    variant="outline"
                    size="sm"
                    disabled={issueCommand.isPending}
                    onClick={() => issueCommand.mutate(command.type)}
                  >
                    {command.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Commands are queued and delivered over the agent&apos;s WebSocket channel, or on its
                next heartbeat if the socket is blocked.
              </p>

              {canDeactivate ? (
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for deactivation"
                    aria-label="Deactivation reason"
                    className="h-8 w-72"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={reason.trim().length < 5 || deactivate.isPending}
                    onClick={() => deactivate.mutate(reason.trim())}
                  >
                    Deactivate
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Stops capture and revokes the credential. Uploaded audio is preserved.
                  </span>
                </div>
              ) : null}

              {issueCommand.isError ? <ErrorBlock error={issueCommand.error} /> : null}
              {deactivate.isError ? <ErrorBlock error={deactivate.error} /> : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Capture gaps</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {gaps.length === 0 ? (
              <EmptyBlock>No capture gaps recorded.</EmptyBlock>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Cause</TableHead>
                    <TableHead>Detected by</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gaps.map((gap) => (
                    <TableRow key={gap._id}>
                      <TableCell>
                        <Timestamp value={gap.startUtc} timezone={tz} />
                      </TableCell>
                      <TableCell>
                        <Timestamp value={gap.endUtc} timezone={tz} />
                      </TableCell>
                      <TableCell className="tabular">{formatDuration(gap.durationSec)}</TableCell>
                      <TableCell>
                        <Badge variant={gap.cause === 'UNKNOWN' ? 'bad' : 'secondary'}>
                          {gapCauseLabel[gap.cause] ?? gap.cause}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{gap.detectedBy}</TableCell>
                      <TableCell className="text-muted-foreground">{gap.detail ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Heartbeat timeline</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {heartbeats.length === 0 ? (
                <EmptyBlock>No heartbeats received.</EmptyBlock>
              ) : (
                <>
                  <HeartbeatStrip
                    beats={heartbeats.map((h) => ({ at: h.at, ok: h.agentState === 'RECORDING' }))}
                  />
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>At</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead className="text-right">CPU</TableHead>
                        <TableHead className="text-right">RAM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {heartbeats.slice(0, 12).map((beat) => (
                        <TableRow key={beat._id}>
                          <TableCell>
                            <Timestamp value={beat.at} timezone={tz} />
                          </TableCell>
                          <TableCell>{beat.agentState ?? '—'}</TableCell>
                          <TableCell>{beat.deviceState ?? '—'}</TableCell>
                          <TableCell className="tabular text-right">
                            {beat.cpuPct?.toFixed(1) ?? '—'}%
                          </TableCell>
                          <TableCell className="tabular text-right">{beat.memMb ?? '—'} MB</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event log</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {events.length === 0 ? (
                <EmptyBlock>No events recorded.</EmptyBlock>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>At</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.slice(0, 20).map((event) => (
                      <TableRow key={event._id}>
                        <TableCell>
                          <Timestamp value={event.at} timezone={tz} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{event.type}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              event.severity === 'CRITICAL' || event.severity === 'ERROR'
                                ? 'bad'
                                : event.severity === 'WARN'
                                  ? 'warn'
                                  : 'secondary'
                            }
                          >
                            {event.severity}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {commands.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent commands</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Acknowledged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commands.map((command) => (
                    <TableRow key={command._id}>
                      <TableCell className="font-mono text-xs">{command.type}</TableCell>
                      <TableCell>{command.state}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelative(command.sentAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelative(command.acknowledgedAt)}
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

const Stat = ({
  label,
  value,
  detail,
  bad,
}: {
  label: string;
  value: string;
  detail?: string;
  bad?: boolean;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{label}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className={`truncate text-lg font-semibold ${bad ? 'text-destructive' : ''}`}>{value}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </CardContent>
  </Card>
);

/**
 * Compact heartbeat presence strip: one cell per sample, newest on the right.
 * A missing agent shows as a run of red long before anyone reads the table.
 */
const HeartbeatStrip = ({ beats }: { beats: { at: string; ok: boolean }[] }) => (
  <div className="flex gap-px overflow-hidden px-4 pb-3" aria-hidden>
    {[...beats]
      .reverse()
      .slice(-120)
      .map((beat) => (
        <span
          key={beat.at}
          title={beat.at}
          className={`h-6 min-w-[3px] flex-1 rounded-sm ${beat.ok ? 'bg-rag-good' : 'bg-rag-bad'}`}
        />
      ))}
  </div>
);
