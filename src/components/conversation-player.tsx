'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatClock } from '@/lib/format';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIP_SECONDS = 10;

export interface SegmentMarker {
  /** Offset from the conversation start, in seconds. */
  atSec: number;
  label: string;
}

/**
 * Waveform player for a derived conversation.
 *
 * The audio URL is a short-lived pre-signed link the caller has already fetched
 * — requesting it is what writes the AccessLog row (FR-M4), so this component
 * never fetches it itself.
 */
export const ConversationPlayer = ({
  audioUrl,
  peaks,
  durationSec,
  markers = [],
}: {
  audioUrl: string;
  peaks?: number[];
  durationSec: number;
  markers?: SegmentMarker[];
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<WaveSurfer | null>(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const wave = WaveSurfer.create({
      container: containerRef.current,
      height: 96,
      waveColor: 'hsl(215 16% 65%)',
      progressColor: 'hsl(222 47% 40%)',
      cursorColor: 'hsl(222 47% 11%)',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      // Pre-computed peaks let the waveform draw immediately from the derived
      // JSON instead of downloading and decoding the whole file first.
      ...(peaks && peaks.length > 0 ? { peaks: [peaks], duration: durationSec } : {}),
    });

    waveRef.current = wave;

    wave.on('ready', () => setReady(true));
    wave.on('play', () => setPlaying(true));
    wave.on('pause', () => setPlaying(false));
    wave.on('finish', () => setPlaying(false));
    wave.on('timeupdate', (time: number) => setCurrentSec(time));
    wave.on('error', (err: Error) => setError(err?.message ?? 'Audio failed to load'));

    void wave.load(audioUrl).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Audio failed to load');
    });

    return () => {
      wave.destroy();
      waveRef.current = null;
    };
  }, [audioUrl, peaks, durationSec]);

  const togglePlay = useCallback(() => {
    void waveRef.current?.playPause();
  }, []);

  const skip = useCallback((seconds: number) => {
    waveRef.current?.skip(seconds);
  }, []);

  const changeSpeed = useCallback((rate: number) => {
    setSpeed(rate);
    waveRef.current?.setPlaybackRate(rate, true);
  }, []);

  const seekTo = useCallback(
    (seconds: number) => {
      const total = waveRef.current?.getDuration() || durationSec;
      if (total > 0) waveRef.current?.seekTo(Math.min(1, Math.max(0, seconds / total)));
    },
    [durationSec],
  );

  // PRD §10.6: an auditor must be able to work the player from the keyboard.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          skip(-SKIP_SECONDS);
          break;
        case 'ArrowRight':
          event.preventDefault();
          skip(SKIP_SECONDS);
          break;
        case 'j':
          skip(-SKIP_SECONDS);
          break;
        case 'l':
          skip(SKIP_SECONDS);
          break;
        case 'k':
          togglePlay();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, skip]);

  const total = durationSec || 1;

  return (
    <div className="space-y-3" data-testid="conversation-player">
      <div className="relative">
        <div ref={containerRef} className="w-full" data-testid="waveform" />

        {/* Segment boundaries: a conversation stitched across a :30 roll should
            make that visible, because audio quality can change at the seam. */}
        {markers.map((marker) => (
          <span
            key={`${marker.atSec}-${marker.label}`}
            title={marker.label}
            className="pointer-events-none absolute top-0 h-full w-px bg-destructive/60"
            style={{ left: `${Math.min(100, (marker.atSec / total) * 100)}%` }}
          />
        ))}

        {!ready && !error ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Loading audio…
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="icon"
          onClick={togglePlay}
          disabled={!ready}
          aria-label={playing ? 'Pause' : 'Play'}
          data-testid="player-playpause"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => skip(-SKIP_SECONDS)}
          disabled={!ready}
          aria-label="Back 10 seconds"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => skip(SKIP_SECONDS)}
          disabled={!ready}
          aria-label="Forward 10 seconds"
          data-testid="player-forward"
        >
          <RotateCw className="h-4 w-4" />
        </Button>

        <span className="tabular text-sm text-muted-foreground" data-testid="player-time">
          {formatClock(currentSec)} / {formatClock(durationSec)}
        </span>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Speed</span>
          {SPEEDS.map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => changeSpeed(rate)}
              aria-pressed={speed === rate}
              className={`rounded px-1.5 py-0.5 text-xs tabular ${
                speed === rate ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'
              }`}
            >
              {rate}×
            </button>
          ))}
        </div>
      </div>

      {markers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {markers.map((marker) => (
            <button
              key={`jump-${marker.atSec}`}
              type="button"
              onClick={() => seekTo(marker.atSec)}
              className="rounded border px-2 py-0.5 text-xs hover:bg-muted"
            >
              {marker.label} @ {formatClock(marker.atSec)}
            </button>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Keyboard: <kbd>space</kbd>/<kbd>k</kbd> play-pause · <kbd>←</kbd>/<kbd>j</kbd> back 10s ·{' '}
        <kbd>→</kbd>/<kbd>l</kbd> forward 10s
      </p>
    </div>
  );
};
