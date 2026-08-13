'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';
import { Timestamp } from '@/components/timestamp';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDuration } from '@/lib/format';
import { useCentres, useConversations } from '@/lib/queries';
import { refName, refTimezone } from '@/lib/schemas';

export default function ConversationsPage() {
  const [centreId, setCentreId] = useState('');
  const [minDuration, setMinDuration] = useState(0);
  const [page, setPage] = useState(1);

  const centres = useCentres();
  const conversations = useConversations({
    centreId: centreId || undefined,
    minDuration: minDuration || undefined,
    page,
    limit: 25,
  });

  return (
    <>
      <PageHeader
        title="Conversations"
        description="Derived counselling sessions, newest first."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={centreId}
              onChange={(e) => {
                setCentreId(e.target.value);
                setPage(1);
              }}
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
              value={minDuration}
              onChange={(e) => {
                setMinDuration(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Minimum duration"
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value={0}>Any length</option>
              <option value={300}>5 min +</option>
              <option value={600}>10 min +</option>
              <option value={1800}>30 min +</option>
            </select>
          </div>
        }
      />

      <div className="p-6">
        <Card>
          <CardContent className="px-0 pt-0">
            {conversations.isPending ? <LoadingBlock /> : null}
            {conversations.isError ? <ErrorBlock error={conversations.error} /> : null}

            {conversations.data ? (
              conversations.data.items.length === 0 ? (
                <EmptyBlock>No conversations match these filters.</EmptyBlock>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Start</TableHead>
                        <TableHead>Counsellor</TableHead>
                        <TableHead>Centre</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                        <TableHead className="text-right">Speech</TableHead>
                        <TableHead>CRM</TableHead>
                        <TableHead>State</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conversations.data.items.map((conversation) => (
                        <TableRow key={conversation._id} data-testid="conversation-row">
                          <TableCell>
                            <Link
                              href={`/conversations/${conversation._id}`}
                              className="underline-offset-4 hover:underline"
                              data-testid="conversation-link"
                            >
                              <Timestamp
                                value={conversation.startUtc}
                                timezone={refTimezone(conversation.centreId)}
                              />
                            </Link>
                            {conversation.segmentIds.length > 1 ? (
                              <p className="text-xs text-muted-foreground">
                                spans {conversation.segmentIds.length} segments
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell>{refName(conversation.counsellorUserId)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {refName(conversation.centreId)}
                          </TableCell>
                          <TableCell className="tabular text-right">
                            {formatDuration(conversation.durationSec)}
                          </TableCell>
                          <TableCell className="tabular text-right text-muted-foreground">
                            {formatDuration(conversation.speechDurationSec)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                conversation.crmLink.status === 'MATCHED' ||
                                conversation.crmLink.status === 'MANUAL'
                                  ? 'good'
                                  : conversation.crmLink.status === 'AMBIGUOUS'
                                    ? 'warn'
                                    : 'secondary'
                              }
                            >
                              {conversation.crmLink.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={conversation.state === 'READY' ? 'good' : 'secondary'}>
                              {conversation.state}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Pagination
                    page={conversations.data.page}
                    limit={conversations.data.limit}
                    total={conversations.data.total}
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
