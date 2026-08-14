'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Play } from 'lucide-react';
import {
  ConversationPlayer,
  type ConversationPlayerHandle,
  type SegmentMarker,
} from '@/components/conversation-player';
import { TranscriptPanel } from '@/components/transcript-panel';
import { AuditScorecard } from '@/components/audit-scorecard';
import { FlagRail } from '@/components/flag-rail';
import { PageHeader } from '@/components/page-header';
import { Timestamp } from '@/components/timestamp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import { formatDuration, gapCauseLabel } from '@/lib/format';
import {
  useConversationAudits,
  useConversation,
  useDownload,
  useStreamUrl,
  useWaveformUrl,
} from '@/lib/queries';
import { refId, refName, refTimezone } from '@/lib/schemas';

const MIN_REASON_LENGTH = 10;

export default function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const conversation = useConversation(id);

  // The review screen finds its own audit rather than being handed one: there
  // is no queue to arrive from, and a reviewer opens a recording directly from
  // a counsellor's list (handoff §6.1).
  const auditQuery = useConversationAudits(id);

  // The human audit is the record; the AI one is advisory. Where a person has
  // not yet recorded a judgement, the AI audit is what they review and adjust.
  const auditId = auditQuery.data?.human?._id ?? auditQuery.data?.ai?._id ?? '';
  // Playback is opt-in: fetching the URL is the logged access event, so nothing
  // is requested until someone actually asks to listen.
  const [listening, setListening] = useState(false);
  const stream = useStreamUrl(id, listening);
  const waveform = useWaveformUrl(id, listening);

  const [peaks, setPeaks] = useState<number[] | undefined>();

  // Playback position, lifted only as far as it needs to go: the transcript
  // highlights the current turn, and clicking a turn seeks the waveform.
  const playerRef = useRef<ConversationPlayerHandle>(null);
  const [currentSec, setCurrentSec] = useState(0);

  const seekTo = useCallback((seconds: number) => {
    // Loading the audio is what writes the access-log row, so a transcript
    // click cannot start playback on its own — it seeks a player that is
    // already open, and does nothing otherwise.
    playerRef.current?.seekTo(seconds);
  }, []);
  const [reason, setReason] = useState('');
  const download = useDownload(id);

  useEffect(() => {
    if (!waveform.data?.url) return;
    let cancelled = false;

    void fetch(waveform.data.url)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { peaks?: number[] } | null) => {
        if (!cancelled && Array.isArray(json?.peaks)) setPeaks(json.peaks);
      })
      // A missing waveform is cosmetic — wavesurfer decodes the audio instead.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [waveform.data?.url]);

  if (conversation.isPending) return <LoadingBlock />;
  if (conversation.isError) return <ErrorBlock error={conversation.error} />;
  if (!conversation.data) return <EmptyBlock>Conversation not found.</EmptyBlock>;

  const data = conversation.data;
  const tz = refTimezone(data.centreId);
  const counsellorId = refId(data.counsellorUserId);

  // Two kinds of mark, drawn differently because they mean opposite things.
  // A seam is a join in a continuous recording; a gap is audio that was never
  // captured, and a reviewer must not read missing minutes as an edit.
  const markers: SegmentMarker[] = [
    ...data.segmentIds.slice(1).map((_, index) => {
      const start = new Date(data.startUtc).getTime();
      const boundary = new Date(start);
      boundary.setUTCMinutes(boundary.getUTCMinutes() < 30 ? 30 : 60, 0, 0);
      const atSec = (boundary.getTime() + index * 1800_000 - start) / 1000;
      return { atSec, label: `Segment ${index + 2}`, kind: 'seam' as const };
    }),
    ...data.gaps.map((gap) => ({
      atSec: gap.atSec,
      durationSec: gap.durationSec,
      kind: 'gap' as const,
      label: `${gapCauseLabel[gap.cause] ?? gap.cause} — ${formatDuration(gap.durationSec)} not recorded`,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Conversation"
        description={`${refName(data.counsellorUserId)} · ${refName(data.centreId)}`}
        actions={
          <Badge variant={data.state === 'READY' ? 'good' : 'secondary'}>{data.state}</Badge>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Playback</CardTitle>
            </CardHeader>
            <CardContent>
              {!listening ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Listening to this recording is logged against your account before the audio link
                    is issued.
                  </p>
                  <Button onClick={() => setListening(true)} data-testid="start-playback">
                    <Play className="h-4 w-4" />
                    Load audio
                  </Button>
                </div>
              ) : null}

              {listening && stream.isPending ? <LoadingBlock label="Requesting audio…" /> : null}
              {listening && stream.isError ? <ErrorBlock error={stream.error} /> : null}

              {stream.data ? (
                <ConversationPlayer
                  ref={playerRef}
                  audioUrl={stream.data.url}
                  peaks={peaks}
                  durationSec={stream.data.durationSec ?? data.durationSec}
                  markers={markers}
                  onTimeUpdate={setCurrentSec}
                />
              ) : null}
            </CardContent>
          </Card>

          {auditId ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Compliance flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <FlagRail
                    auditId={auditId}
                    flags={auditQuery.data?.flags ?? []}
                    onSeek={seekTo}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Scorecard</CardTitle>
                </CardHeader>
                <CardContent>
                  <AuditScorecard auditId={auditId} onSeek={seekTo} />
                </CardContent>
              </Card>
            </>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <TranscriptPanel conversationId={id} currentSec={currentSec} onSeek={seekTo} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Download</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Downloads are the exception, not the norm. A typed reason is required and is recorded
                permanently in the access log.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why do you need a copy of this recording?"
                  aria-label="Download reason"
                  className="w-96"
                  data-testid="download-reason"
                />
                <Button
                  variant="outline"
                  disabled={reason.trim().length < MIN_REASON_LENGTH || download.isPending}
                  data-testid="download-submit"
                  onClick={() =>
                    download.mutate(reason.trim(), {
                      onSuccess: (result) => window.open(result.url, '_blank', 'noopener'),
                    })
                  }
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>
              {reason.trim().length > 0 && reason.trim().length < MIN_REASON_LENGTH ? (
                <p className="text-xs text-muted-foreground">
                  At least {MIN_REASON_LENGTH} characters.
                </p>
              ) : null}
              {download.isError ? <ErrorBlock error={download.error} /> : null}
              {download.isSuccess ? (
                <p className="text-sm text-rag-good">Download link issued and logged.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Start">
                <Timestamp value={data.startUtc} timezone={tz} />
              </Row>
              <Row label="End">
                <Timestamp value={data.endUtc} timezone={tz} />
              </Row>
              <Row label="Duration">{formatDuration(data.durationSec)}</Row>
              <Row label="Speech">{formatDuration(data.speechDurationSec)}</Row>
              <Row label="Segments">{data.segmentIds.length}</Row>
              {/* Plain text now that the installation screen is gone. The id
                  still matters when correlating with a laptop, but it is not a
                  place the reviewer needs to navigate to. */}
              <Row label="Installation">
                <span className="font-mono text-xs">{data.installationId}</span>
              </Row>
              {counsellorId ? (
                <Row label="Counsellor">
                  <Link
                    href={`/counsellors/${counsellorId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {refName(data.counsellorUserId)}
                  </Link>
                </Row>
              ) : null}
              {data.partial ? (
                <Row label="Partial">
                  <Badge variant="warn">split by a capture gap</Badge>
                </Row>
              ) : null}
              {data.legalHold ? (
                <Row label="Legal hold">
                  <Badge variant="bad">held</Badge>
                </Row>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CRM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Status">
                <Badge
                  variant={
                    data.crmLink.status === 'MATCHED' || data.crmLink.status === 'MANUAL'
                      ? 'good'
                      : data.crmLink.status === 'AMBIGUOUS'
                        ? 'warn'
                        : 'secondary'
                  }
                >
                  {data.crmLink.status}
                </Badge>
              </Row>
              {data.crmLink.leadId ? <Row label="Lead">{data.crmLink.leadId}</Row> : null}
              {data.crmLink.disposition ? (
                <Row label="Disposition">{data.crmLink.disposition}</Row>
              ) : null}
              {data.crmLink.status === 'UNMATCHED' ? (
                <p className="pt-1 text-xs text-muted-foreground">
                  Cut A ships a mock CRM adapter that returns no walk-ins, so every conversation is
                  unmatched. This is not a matching failure.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right">{children}</span>
  </div>
);
