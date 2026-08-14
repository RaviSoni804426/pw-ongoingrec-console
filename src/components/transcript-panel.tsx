'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorBlock } from '@/components/ui/spinner';
import { formatClock } from '@/lib/format';
import { useSetSpeakerTag, useTranscript } from '@/lib/queries';
import type { Transcript, TranscriptTurn } from '@/lib/schemas';

/**
 * Below this, a turn is marked as uncertain in the margin.
 *
 * Deliberately not the same number as the backend's auto-audit gate: that one
 * decides whether a machine may score the conversation at all, this one decides
 * whether to warn a human who is reading it. A person can work with a doubtful
 * line; a scorer should not.
 */
const LOW_CONFIDENCE = 0.6;

/** Distinct hues per diarised speaker. Colour is never the only signal. */
const SPEAKER_STYLES = [
  { bar: 'bg-sky-500', chip: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100' },
  { bar: 'bg-amber-500', chip: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100' },
  {
    bar: 'bg-violet-500',
    chip: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100',
  },
  { bar: 'bg-teal-500', chip: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-100' },
];

export const TranscriptPanel = ({
  conversationId,
  currentSec,
  onSeek,
}: {
  conversationId: string;
  /** Playback position, so the transcript can follow the audio. */
  currentSec: number;
  onSeek: (seconds: number) => void;
}) => {
  const query = useTranscript(conversationId);
  const setTag = useSetSpeakerTag(conversationId);
  const [following, setFollowing] = useState(true);

  const data = query.data;
  const transcript = data?.transcript ?? null;

  const speakers = useMemo(() => {
    if (!transcript) return [];
    return [...new Set(transcript.turns.map((turn) => turn.speakerLabel))].sort();
  }, [transcript]);

  const styleFor = (label: string) => {
    const index = Math.max(0, speakers.indexOf(label)) % SPEAKER_STYLES.length;
    // The modulo guarantees a hit; the index signature does not know that.
    return SPEAKER_STYLES[index] ?? SPEAKER_STYLES[0]!;
  };

  const activeIdx = useMemo(() => {
    if (!transcript) return -1;
    const ms = currentSec * 1000;
    return transcript.turns.findIndex((turn) => ms >= turn.startMs && ms < turn.endMs);
  }, [transcript, currentSec]);

  if (query.isError) return <ErrorBlock error={query.error} />;

  if (!transcript) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="transcript-pending">
        {data?.status === 'FAILED'
          ? `Transcription failed: ${data.reason ?? 'no reason recorded'}`
          : data?.status === 'SKIPPED'
            ? `Not transcribed: ${data.reason ?? 'no audio derivative'}`
            : 'Waiting for transcription. This page will update on its own.'}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="transcript-panel">
      <QualityBanner transcript={transcript} />

      <SpeakerControl
        transcript={transcript}
        speakers={speakers}
        styleFor={styleFor}
        onChoose={(label) => setTag.mutate(label)}
        pending={setTag.isPending}
        error={setTag.error}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {transcript.turns.length} turns · {transcript.language} · {transcript.engine}
          {transcript.modelVersion ? ` ${transcript.modelVersion}` : ''} · v{transcript.version}
        </p>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={following}
            onChange={(e) => setFollowing(e.target.checked)}
            data-testid="transcript-follow"
          />
          Follow playback
        </label>
      </div>

      <ol className="max-h-[32rem] space-y-1 overflow-y-auto pr-1" data-testid="transcript-turns">
        {transcript.turns.map((turn, i) => (
          <TurnRow
            key={turn.idx}
            turn={turn}
            active={i === activeIdx}
            follow={following}
            style={styleFor(turn.speakerLabel)}
            provisional={transcript.provisional}
            onSeek={onSeek}
          />
        ))}
      </ol>
    </div>
  );
};

const TurnRow = ({
  turn,
  active,
  follow,
  style,
  provisional,
  onSeek,
}: {
  turn: TranscriptTurn;
  active: boolean;
  follow: boolean;
  style: (typeof SPEAKER_STYLES)[number];
  provisional: boolean;
  onSeek: (seconds: number) => void;
}) => {
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (active && follow) {
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [active, follow]);

  const uncertain = turn.asrConfidence < LOW_CONFIDENCE;

  return (
    <li
      ref={ref}
      data-testid="transcript-turn"
      data-active={active || undefined}
      className={`flex gap-2 rounded-md p-2 text-sm ${active ? 'bg-muted' : ''}`}
    >
      <span className={`w-0.5 shrink-0 rounded ${style.bar}`} aria-hidden />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSeek(turn.startMs / 1000)}
            className="tabular text-xs text-muted-foreground underline-offset-2 hover:underline"
            data-testid="transcript-seek"
            aria-label={`Play from ${formatClock(turn.startMs / 1000)}`}
          >
            {formatClock(turn.startMs / 1000)}
          </button>

          {/* The label is always shown alongside the role: the role is a guess
              until confirmed, the label is what the engine actually reported. */}
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${style.chip}`}>
            {turn.speakerRole ?? 'Speaker'} {turn.speakerLabel}
            {provisional && turn.speakerRole ? '?' : ''}
          </span>

          {uncertain ? (
            <span
              className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-500"
              data-testid="low-confidence"
              title={`The engine reported ${(turn.asrConfidence * 100).toFixed(0)}% confidence on this turn`}
            >
              <AlertTriangle className="h-3 w-3" />
              {(turn.asrConfidence * 100).toFixed(0)}%
            </span>
          ) : null}
        </div>

        <p className={uncertain ? 'text-muted-foreground' : ''}>{turn.text}</p>
      </div>
    </li>
  );
};

/**
 * States plainly whether this transcript may be scored automatically.
 *
 * The gate closing is not an error and is not hidden: it means a human reads
 * this one, which is the designed outcome rather than a degraded one.
 */
const QualityBanner = ({ transcript }: { transcript: Transcript }) => {
  const { quality } = transcript;

  if (quality.usableForAutoAudit) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="transcript-quality">
        Mean recognition confidence {(quality.avgAsrConfidence * 100).toFixed(0)}%. Eligible for
        automated scoring.
      </p>
    );
  }

  return (
    <div
      className="rounded-md border border-amber-500/40 bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      data-testid="transcript-quality"
    >
      <strong className="font-medium">Not eligible for automated scoring.</strong>{' '}
      {quality.reason ?? 'Recognition quality is below the threshold.'} This conversation goes to a
      human auditor instead.
    </div>
  );
};

/**
 * The one-click speaker correction (acceptance criterion 3).
 *
 * Prominent rather than tucked away, because a wrong tag does not merely
 * degrade the talk ratio — it reverses it. An auditor shown 70:30 the wrong way
 * round would draw exactly the opposite conclusion about the counsellor.
 */
const SpeakerControl = ({
  transcript,
  speakers,
  styleFor,
  onChoose,
  pending,
  error,
}: {
  transcript: Transcript;
  speakers: string[];
  styleFor: (label: string) => (typeof SPEAKER_STYLES)[number];
  onChoose: (label: string) => void;
  pending: boolean;
  error: Error | null;
}) => {
  const confirmed = transcript.speakerTagSource === 'MANUAL';

  return (
    <div
      className={`space-y-2 rounded-md border p-2 ${confirmed ? '' : 'border-amber-500/40 bg-amber-50 dark:bg-amber-950/40'}`}
      data-testid="speaker-control"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {confirmed ? (
          <>
            <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span data-testid="speaker-confirmed">
              Speaker {transcript.counsellorSpeakerLabel} confirmed as the counsellor by a person.
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span data-testid="speaker-provisional">
              Counsellor identified by heuristic, not voice matching
              {transcript.speakerTagRationale ? `: ${transcript.speakerTagRationale}` : ''}. Talk
              ratio and related metrics are provisional until confirmed.
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Counsellor is:</span>
        {speakers.map((label) => {
          const chosen = transcript.counsellorSpeakerLabel === label;
          return (
            <Button
              key={label}
              type="button"
              size="sm"
              variant={chosen ? 'default' : 'outline'}
              disabled={pending || (chosen && confirmed)}
              onClick={() => onChoose(label)}
              data-testid={`speaker-choose-${label}`}
            >
              {chosen && confirmed ? <Check className="h-3 w-3" /> : null}
              <span className={`mr-1 inline-block h-2 w-2 rounded-full ${styleFor(label).bar}`} />
              Speaker {label}
            </Button>
          );
        })}
      </div>

      {/* Visitors are never named. There is no control here to identify one,
          and there must never be. */}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
};
