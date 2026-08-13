'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, HardDrive, MicOff, Upload } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Timestamp } from '@/components/timestamp';
import { Badge, stateVariant } from '@/components/ui/badge';
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
import { Pagination } from '@/components/pagination';
import { formatRelative } from '@/lib/format';
import { useFleetSummary, useInstallations } from '@/lib/queries';
import { refName, refTimezone } from '@/lib/schemas';

const STATES = ['', 'ACTIVE', 'OFFLINE', 'UNHEALTHY', 'PROVISIONING', 'DEACTIVATED'];

export default function FleetHealthPage() {
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);

  const summary = useFleetSummary();
  const installations = useInstallations({ q, state: state || undefined, page, limit: 25 });

  return (
    <>
      <PageHeader
        title="Fleet health"
        description="Agent state across every provisioned laptop, refreshed every 30 seconds."
      />

      <div className="space-y-6 p-6">
        {summary.isPending ? <LoadingBlock label="Loading fleet summary…" /> : null}
        {summary.isError ? <ErrorBlock error={summary.error} /> : null}

        {summary.data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>Agent state</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(summary.data.agentStates).length === 0 ? (
                      <span className="text-sm text-muted-foreground">No installations yet</span>
                    ) : (
                      Object.entries(summary.data.agentStates).map(([key, count]) => (
                        <Badge key={key} variant={stateVariant(key)} data-testid={`fleet-state-${key}`}>
                          {key} {count}
                        </Badge>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    <MicOff className="h-3.5 w-3.5" /> Device faults
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="tabular text-2xl font-semibold" data-testid="fleet-device-faults">
                    {summary.data.deviceFaults}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Installations reporting a non-OK capture device
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> Upload backlog
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="tabular text-2xl font-semibold">
                    {summary.data.uploadBacklog.totalQueued}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Worst single laptop: {summary.data.uploadBacklog.worstInstallation} segments
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5" /> Agent versions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {summary.data.agentVersions.map((v) => (
                      <div key={v.version} className="flex justify-between text-sm">
                        <span className="font-mono text-xs">{v.version}</span>
                        <span className="tabular text-muted-foreground">{v.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {summary.data.deviceFaults > 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-rag-warn/40 bg-rag-warn/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rag-warn" />
                <p>
                  {summary.data.deviceFaults} installation
                  {summary.data.deviceFaults === 1 ? ' is' : 's are'} reporting a capture-device fault.
                  Those counsellors are not being recorded — open the installation to see the device
                  history and raise it with IT.
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Installations</CardTitle>
            <div className="flex items-center gap-2">
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search machine or installation id"
                aria-label="Search installations"
                className="h-8 w-64"
              />
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by state"
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s || 'All states'}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>

          <CardContent className="px-0">
            {installations.isPending ? <LoadingBlock /> : null}
            {installations.isError ? <ErrorBlock error={installations.error} /> : null}

            {installations.data ? (
              installations.data.items.length === 0 ? (
                <EmptyBlock>No installations match these filters.</EmptyBlock>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Machine</TableHead>
                        <TableHead>Counsellor</TableHead>
                        <TableHead>Centre</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Last heartbeat</TableHead>
                        <TableHead className="text-right">Queue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {installations.data.items.map((installation) => (
                        <TableRow key={installation._id} data-testid="installation-row">
                          <TableCell>
                            <Link
                              href={`/installations/${installation.installationId}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {installation.machineName ?? installation.machineId}
                            </Link>
                            <p className="font-mono text-xs text-muted-foreground">
                              {installation.installationId}
                            </p>
                          </TableCell>
                          <TableCell>{refName(installation.counsellorUserId)}</TableCell>
                          <TableCell>{refName(installation.centreId)}</TableCell>
                          <TableCell>
                            <Badge variant={stateVariant(installation.state)}>{installation.state}</Badge>
                          </TableCell>
                          <TableCell>
                            {installation.deviceState === 'OK' ? (
                              <span className="text-muted-foreground">OK</span>
                            ) : (
                              <Badge variant="bad">{installation.deviceState}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Timestamp
                              value={installation.lastHeartbeatAt}
                              timezone={refTimezone(installation.centreId)}
                              className="text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                              {formatRelative(installation.lastHeartbeatAt)}
                            </p>
                          </TableCell>
                          <TableCell className="tabular text-right">
                            {installation.queueDepth ?? 0}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Pagination
                    page={installations.data.page}
                    limit={installations.data.limit}
                    total={installations.data.total}
                    onPage={setPage}
                  />
                </>
              )
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
