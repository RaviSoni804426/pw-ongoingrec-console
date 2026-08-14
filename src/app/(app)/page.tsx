'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Search, Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import { formatRelative } from '@/lib/format';
import { useOrgTree } from '@/lib/queries';
import type { Counsellor } from '@/lib/schemas';

/**
 * Step one and two of the flow: choose a centre, then a counsellor.
 *
 * This replaced the fleet-health dashboard as the landing screen (handoff §6.1).
 * The two numbers those dashboards carried are folded in here instead of being
 * deleted — coverage per centre, and each counsellor's agent state — because
 * both answer questions the reviewer actually has, and neither was worth a
 * screen of its own.
 */
export default function CentresPage() {
  const tree = useOrgTree();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');

  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const needle = q.trim().toLowerCase();

  const centres = useMemo(() => {
    const all = tree.data ?? [];
    if (!needle) return all;

    // Filtering by counsellor rather than by centre: the reviewer is looking
    // for a person and does not necessarily remember which centre they are in.
    return all
      .map((centre) => ({
        ...centre,
        teams: centre.teams.map((team) => ({
          ...team,
          counsellors: team.counsellors.filter((c) => matches(c, needle)),
        })),
        unassignedCounsellors: centre.unassignedCounsellors.filter((c) => matches(c, needle)),
      }))
      .filter(
        (centre) =>
          centre.name.toLowerCase().includes(needle) ||
          centre.unassignedCounsellors.length > 0 ||
          centre.teams.some((team) => team.counsellors.length > 0),
      );
  }, [tree.data, needle]);

  return (
    <>
      <PageHeader
        title="Centres"
        description="Choose a centre, then a counsellor, to review their recordings."
        actions={
          <div className="relative">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a counsellor"
              aria-label="Find a counsellor"
              className="h-8 w-64 pl-8"
              data-testid="counsellor-search"
            />
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {tree.isPending ? <LoadingBlock /> : null}
        {tree.isError ? <ErrorBlock error={tree.error} /> : null}

        {tree.data && centres.length === 0 ? (
          <EmptyBlock>
            {needle ? `No counsellor matches “${q}”.` : 'No centres are visible to your account.'}
          </EmptyBlock>
        ) : null}

        {centres.map((centre) => {
          const counsellors = [
            ...centre.teams.flatMap((team) => team.counsellors),
            ...centre.unassignedCounsellors,
          ];
          const isCollapsed = collapsed[centre._id] && !needle;

          return (
            <Card key={centre._id} data-testid="centre-node">
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => toggle(centre._id)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span className="font-medium">{centre.name}</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {counsellors.length}
                    </span>
                  </span>

                  <CoverageBadge coverage={centre.coverage} />
                </button>

                {!isCollapsed ? (
                  <ul className="divide-y border-t">
                    {counsellors.map((counsellor) => (
                      <li key={counsellor._id}>
                        <Link
                          href={`/counsellors/${counsellor._id}`}
                          data-testid="counsellor-link"
                          className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-muted/50"
                        >
                          <span className="flex items-center gap-2">
                            <span>{counsellor.name}</span>
                            {counsellor.employeeId ? (
                              <span className="text-xs text-muted-foreground">
                                {counsellor.employeeId}
                              </span>
                            ) : null}
                          </span>

                          <AgentBadge counsellor={counsellor} />
                        </Link>
                      </li>
                    ))}

                    {counsellors.length === 0 ? (
                      <li className="px-4 py-2 text-sm text-muted-foreground">
                        No counsellors in this centre.
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

const matches = (counsellor: Counsellor, needle: string): boolean =>
  counsellor.name.toLowerCase().includes(needle) ||
  (counsellor.employeeId ?? '').toLowerCase().includes(needle);

/**
 * Coverage for the last seven days.
 *
 * "Not reconciled" is shown rather than 0%. A centre with no CRM data reading
 * as 0% coverage looks like a fleet-wide failure, and an absence of input must
 * not look like a total loss of recordings.
 */
const CoverageBadge = ({
  coverage,
}: {
  coverage?: { walkIns: number; captured: number; pct: number | null };
}) => {
  if (!coverage || coverage.pct === null) {
    return (
      <span className="text-xs text-muted-foreground" data-testid="centre-coverage">
        Coverage not reconciled
      </span>
    );
  }

  const tone =
    coverage.pct >= 90
      ? 'text-emerald-600'
      : coverage.pct >= 70
        ? 'text-amber-600'
        : 'text-destructive';

  return (
    <span className={`text-xs ${tone}`} data-testid="centre-coverage">
      {coverage.pct}% coverage · {coverage.captured}/{coverage.walkIns} walk-ins · 7 days
    </span>
  );
};

/**
 * Agent state, next to the person rather than on a fleet screen.
 *
 * Only stated when it is not healthy. A green tick on every row is noise; the
 * only thing worth surfacing is the explanation for missing recordings.
 */
const AgentBadge = ({ counsellor }: { counsellor: Counsellor }) => {
  if (!counsellor.agentState) {
    return (
      <span className="text-xs text-muted-foreground" data-testid="agent-state">
        No laptop enrolled
      </span>
    );
  }

  if (counsellor.agentState === 'ACTIVE') {
    return (
      <span className="text-xs text-muted-foreground" data-testid="agent-state">
        {counsellor.lastSegmentAt
          ? `Last recording ${formatRelative(counsellor.lastSegmentAt)}`
          : 'No recordings yet'}
      </span>
    );
  }

  return (
    <Badge variant="outline" className="text-xs" data-testid="agent-state">
      Agent {counsellor.agentState.toLowerCase()}
    </Badge>
  );
};
