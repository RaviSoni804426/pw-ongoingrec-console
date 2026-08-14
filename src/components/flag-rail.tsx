'use client';

import { useState } from 'react';
import { AlertOctagon, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatClock } from '@/lib/format';
import { useReviewFlag } from '@/lib/queries';
import type { AuditFlag } from '@/lib/schemas';

/** Critical is stated, never merely coloured. */
const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-destructive text-destructive-foreground',
  HIGH: 'bg-amber-500 text-amber-950',
  MEDIUM: 'bg-muted text-muted-foreground',
  LOW: 'bg-muted text-muted-foreground',
};

/**
 * Compliance flags raised on a conversation, each jumping to the moment it
 * refers to.
 *
 * Separate from the scorecard because a flag is independent of the score: a
 * conversation can score well and still contain a Critical breach, and a
 * confirmed Critical forces escalation regardless of the number.
 */
export const FlagRail = ({
  auditId,
  flags,
  onSeek,
}: {
  auditId: string;
  flags: AuditFlag[];
  onSeek: (seconds: number) => void;
}) => {
  const review = useReviewFlag(auditId);
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (flags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="flag-rail-empty">
        No compliance rules were flagged on this conversation.
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-testid="flag-rail">
      {flags.map((flag) => {
        const open = flag.state === 'OPEN';

        return (
          <li key={flag._id} className="space-y-1.5 rounded-md border p-2" data-testid="flag-item">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  SEVERITY_STYLE[flag.severity] ?? SEVERITY_STYLE.MEDIUM
                }`}
              >
                {flag.severity === 'CRITICAL' ? (
                  <AlertOctagon className="mr-1 inline h-3 w-3" />
                ) : null}
                {flag.severity}
              </span>

              <span className="text-sm font-medium">{flag.ruleKey}</span>

              {!open ? (
                <Badge variant="outline" data-testid="flag-decided">
                  {flag.state}
                </Badge>
              ) : null}

              {flag.aiConfidence !== undefined ? (
                <span className="text-xs text-muted-foreground">
                  {(flag.aiConfidence * 100).toFixed(0)}% confidence
                </span>
              ) : null}
            </div>

            {flag.quote ? (
              <p className="text-xs">
                {flag.startMs !== undefined ? (
                  <button
                    type="button"
                    onClick={() => onSeek(flag.startMs! / 1000)}
                    className="tabular mr-1 text-muted-foreground underline-offset-2 hover:underline"
                    data-testid="flag-seek"
                  >
                    {formatClock(flag.startMs / 1000)}
                  </button>
                ) : null}
                “{flag.quote}”
              </p>
            ) : null}

            {open ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Input
                  value={notes[flag._id] ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [flag._id]: e.target.value }))}
                  placeholder="Note (optional)"
                  aria-label={`Review note for ${flag.ruleKey}`}
                  className="h-8 flex-1 text-xs"
                  data-testid="flag-note"
                />

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate({
                      flagId: flag._id,
                      decision: 'CONFIRMED',
                      note: notes[flag._id],
                    })
                  }
                  data-testid="flag-confirm"
                >
                  <Check className="h-3 w-3" />
                  Confirm
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate({
                      flagId: flag._id,
                      decision: 'DISMISSED',
                      note: notes[flag._id],
                    })
                  }
                  data-testid="flag-dismiss"
                >
                  <X className="h-3 w-3" />
                  Dismiss
                </Button>
              </div>
            ) : null}

            {flag.severity === 'CRITICAL' && flag.state === 'CONFIRMED' ? (
              // PRD §8.3: this outranks the score entirely, so it is said
              // plainly rather than left for someone to infer from the badge.
              <p className="text-xs font-medium text-destructive" data-testid="flag-escalation">
                Confirmed Critical. This conversation escalates regardless of its score.
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
};
