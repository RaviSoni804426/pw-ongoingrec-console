'use client';

import Link from 'next/link';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import { useOrgTree } from '@/lib/queries';
import type { Counsellor } from '@/lib/schemas';

export default function OrgExplorerPage() {
  const tree = useOrgTree();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      <PageHeader
        title="Org explorer"
        description="Centre → team → counsellor, showing only what your role can reach."
      />

      <div className="space-y-4 p-6">
        {tree.isPending ? <LoadingBlock /> : null}
        {tree.isError ? <ErrorBlock error={tree.error} /> : null}

        {tree.data?.length === 0 ? (
          <EmptyBlock>No centres are visible to your account.</EmptyBlock>
        ) : null}

        {tree.data?.map((centre) => {
          const centreCounsellors =
            centre.teams.reduce((sum, team) => sum + team.counsellors.length, 0) +
            centre.unassignedCounsellors.length;
          const isCollapsed = collapsed[centre._id];

          return (
            <Card key={centre._id} data-testid="centre-node">
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => toggle(centre._id)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/50"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{centre.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {centre.code}
                      {centre.city ? ` · ${centre.city}` : ''}
                      {centre.timezone ? ` · ${centre.timezone}` : ''}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    <Users className="mr-1 h-3 w-3" />
                    {centreCounsellors}
                  </Badge>
                </button>

                {!isCollapsed ? (
                  <div className="border-t">
                    {centre.teams.map((team) => (
                      <div key={team._id} className="border-b last:border-b-0">
                        <div className="bg-muted/30 px-4 py-2 pl-10 text-sm font-medium">
                          {team.name}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {team.counsellors.length} counsellor
                            {team.counsellors.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <CounsellorList counsellors={team.counsellors} />
                      </div>
                    ))}

                    {centre.unassignedCounsellors.length > 0 ? (
                      <div>
                        <div className="bg-muted/30 px-4 py-2 pl-10 text-sm font-medium">
                          Unassigned
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            not in a team
                          </span>
                        </div>
                        <CounsellorList counsellors={centre.unassignedCounsellors} />
                      </div>
                    ) : null}

                    {centre.teams.length === 0 && centre.unassignedCounsellors.length === 0 ? (
                      <EmptyBlock>No counsellors in this centre are visible to you.</EmptyBlock>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

const CounsellorList = ({ counsellors }: { counsellors: Counsellor[] }) => {
  if (counsellors.length === 0) {
    return <p className="px-4 py-2 pl-14 text-sm text-muted-foreground">None</p>;
  }

  return (
    <ul>
      {counsellors.map((counsellor) => (
        <li key={counsellor._id}>
          <Link
            href={`/counsellors/${counsellor._id}`}
            className="flex items-center justify-between px-4 py-2 pl-14 text-sm hover:bg-muted/50"
            data-testid="counsellor-link"
          >
            <span>{counsellor.name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {counsellor.employeeId ?? '—'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};
