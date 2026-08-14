'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Lock, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorBlock, LoadingBlock } from '@/components/ui/spinner';
import { formatClock } from '@/lib/format';
import {
  useAudit,
  useClaimAudit,
  usePublishedRubric,
  useSaveAuditDraft,
  useSubmitAudit,
} from '@/lib/queries';
import type { CriterionScore, Rubric, RubricCriterion } from '@/lib/schemas';

const SCALE = [1, 2, 3, 4, 5];
const AUTOSAVE_MS = 4000;

/**
 * The audit workspace's scoring panel.
 *
 * The screen an auditor lives in all day, so it is built for throughput: no
 * modal dialogs anywhere in the scoring path, autosave rather than a save
 * button to remember, and every control reachable from the keyboard.
 *
 * Scores are typed as digits 1–5 while a criterion is focused. That is the
 * whole interaction — an auditor reads, presses a number, moves on.
 */
export const AuditScorecard = ({
  auditId,
  onSeek,
}: {
  auditId: string;
  onSeek: (seconds: number) => void;
}) => {
  const query = useAudit(auditId);
  const rubricQuery = usePublishedRubric();
  const claim = useClaimAudit(auditId);
  const saveDraft = useSaveAuditDraft(auditId);
  const submit = useSubmitAudit(auditId);

  const [scores, setScores] = useState<Record<string, CriterionScore>>({});
  const [focused, setFocused] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const startedAt = useRef(Date.now());
  const claimed = useRef(false);

  const audit = query.data?.audit;
  const rubric = rubricQuery.data;
  const locked = audit?.state === 'LOCKED' || audit?.state === 'SUPERSEDED';

  const criteria = useMemo(
    () => rubric?.sections.flatMap((section) => section.criteria) ?? [],
    [rubric],
  );

  // Seed from whatever exists: an AI audit's proposal, or a draft in progress.
  useEffect(() => {
    if (!audit) return;
    setScores(Object.fromEntries(audit.criterionScores.map((s) => [s.criterionKey, s])));
  }, [audit]);

  // Claiming on open is what keeps two auditors off the same conversation.
  useEffect(() => {
    if (audit && !locked && !claimed.current) {
      claimed.current = true;
      claim.mutate();
    }
  }, [audit, locked, claim]);

  const setScore = useCallback((criterionKey: string, value: number, aiScore?: number) => {
    setScores((current) => {
      const existing = current[criterionKey];
      return {
        ...current,
        [criterionKey]: {
          criterionKey,
          score: value,
          justification: existing?.justification ?? '',
          evidence: existing?.evidence ?? [],
          // Recording that a human moved the AI's number, and what it was, is
          // the raw material of the agreement metric — not a cosmetic flag.
          overriddenFromAi: aiScore !== undefined && aiScore !== value,
          aiScore: aiScore ?? existing?.aiScore,
          confidence: existing?.confidence,
          overrideReason: existing?.overrideReason,
        },
      };
    });
    setDirty(true);
  }, []);

  const setJustification = useCallback((criterionKey: string, text: string) => {
    setScores((current) => ({
      ...current,
      [criterionKey]: {
        ...(current[criterionKey] ?? {
          criterionKey,
          score: 3,
          evidence: [],
          overriddenFromAi: false,
        }),
        justification: text,
      } as CriterionScore,
    }));
    setDirty(true);
  }, []);

  // Autosave. A laptop that sleeps mid-conversation must not cost an hour of
  // work, which in a screen somebody lives in all day is the difference between
  // a tool and a liability.
  useEffect(() => {
    if (!dirty || locked) return;

    const timer = setTimeout(() => {
      saveDraft.mutate(
        { criterionScores: Object.values(scores), timeSpentSec: elapsed(startedAt.current) },
        { onSuccess: () => setDirty(false) },
      );
    }, AUTOSAVE_MS);

    return () => clearTimeout(timer);
  }, [dirty, locked, scores, saveDraft]);

  // Digits score the focused criterion. This is the primary interaction, so it
  // is a keystroke rather than a click.
  useEffect(() => {
    if (locked) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (!focused) return;

      const digit = Number(event.key);
      if (SCALE.includes(digit)) {
        event.preventDefault();
        const criterion = criteria.find((c) => c.key === focused);
        setScore(focused, digit, audit?.criterionScores.find((s) => s.criterionKey === focused)?.aiScore);
        // Move to the next criterion so an auditor can work straight down the
        // list without reaching for the mouse.
        const index = criteria.findIndex((c) => c.key === criterion?.key);
        const next = criteria[index + 1];
        if (next) setFocused(next.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focused, criteria, locked, setScore, audit]);

  if (query.isError) return <ErrorBlock error={query.error} />;
  if (query.isPending || rubricQuery.isPending) return <LoadingBlock label="Loading the audit…" />;
  if (!audit || !rubric) return <ErrorBlock error={new Error('This audit is unavailable')} />;

  const problems = validate(criteria, scores);

  return (
    <div className="space-y-4" data-testid="audit-scorecard">
      <Header audit={audit} rubric={rubric} />

      {rubric.sections.map((section) => (
        <section key={section.key} className="space-y-2">
          <h3 className="text-sm font-medium">
            {section.label}{' '}
            <span className="font-normal text-muted-foreground">({section.weight}%)</span>
          </h3>

          {section.criteria.map((criterion) => (
            <CriterionRow
              key={criterion.key}
              criterion={criterion}
              value={scores[criterion.key]}
              aiScore={audit.criterionScores.find((s) => s.criterionKey === criterion.key)}
              focused={focused === criterion.key}
              locked={locked}
              onFocus={() => setFocused(criterion.key)}
              onScore={(value, aiScore) => setScore(criterion.key, value, aiScore)}
              onJustify={(text) => setJustification(criterion.key, text)}
              onSeek={onSeek}
            />
          ))}
        </section>
      ))}

      {!locked ? (
        <div className="sticky bottom-0 space-y-2 border-t bg-background pt-3">
          {problems.length > 0 ? (
            <ul
              className="space-y-0.5 text-xs text-muted-foreground"
              data-testid="audit-problems"
            >
              {problems.slice(0, 4).map((problem) => (
                <li key={problem}>· {problem}</li>
              ))}
              {problems.length > 4 ? <li>· and {problems.length - 4} more</li> : null}
            </ul>
          ) : null}

          {submit.isError ? (
            <p role="alert" className="text-xs text-destructive" data-testid="audit-submit-error">
              {submit.error.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={problems.length > 0 || submit.isPending}
              onClick={() =>
                submit.mutate({
                  criterionScores: Object.values(scores),
                  timeSpentSec: elapsed(startedAt.current),
                })
              }
              data-testid="audit-submit"
            >
              <Lock className="h-4 w-4" />
              Submit and lock
            </Button>

            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Save className="h-3 w-3" />
              {dirty ? 'Unsaved changes…' : 'Saved'}
            </span>

            <span className="text-xs text-muted-foreground">
              Press <kbd>1</kbd>–<kbd>5</kbd> to score the highlighted criterion.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Header = ({ audit, rubric }: { audit: NonNullable<ReturnType<typeof useAudit>['data']>['audit']; rubric: Rubric }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
    <Badge variant="outline">{audit.type}</Badge>
    <span>
      Rubric {rubric.name} v{audit.rubricVersion}
    </span>
    {audit.aiModel ? <span>· {audit.aiModel}</span> : null}
    {audit.aiPromptVersion ? <span>· {audit.aiPromptVersion}</span> : null}

    {audit.state === 'LOCKED' ? (
      <Badge className="gap-1" data-testid="audit-locked">
        <Lock className="h-3 w-3" />
        Locked{audit.normalisedScore !== undefined ? ` · ${audit.normalisedScore}` : ''}
        {audit.band ? ` · ${audit.band}` : ''}
      </Badge>
    ) : null}

    {audit.state === 'LOW_CONFIDENCE' ? (
      <Badge variant="outline" className="gap-1" data-testid="audit-low-confidence">
        <AlertTriangle className="h-3 w-3" />
        No automatic score: {audit.stateReason ?? 'the transcript could not support one'}
      </Badge>
    ) : null}

    {audit.state === 'SCORING_REFUSED' ? (
      <Badge variant="outline" data-testid="audit-refused">
        The model declined to score this. Scored by a person instead.
      </Badge>
    ) : null}
  </div>
);

const CriterionRow = ({
  criterion,
  value,
  aiScore,
  focused,
  locked,
  onFocus,
  onScore,
  onJustify,
  onSeek,
}: {
  criterion: RubricCriterion;
  value?: CriterionScore;
  aiScore?: CriterionScore;
  focused: boolean;
  locked: boolean;
  onFocus: () => void;
  onScore: (value: number, aiScore?: number) => void;
  onJustify: (text: string) => void;
  onSeek: (seconds: number) => void;
}) => {
  const changed = aiScore && value && aiScore.score !== value.score;

  return (
    <div
      onFocus={onFocus}
      onClick={onFocus}
      data-testid="criterion-row"
      data-criterion={criterion.key}
      className={`rounded-md border p-2 ${focused ? 'border-primary' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{criterion.label}</span>
          <span className="text-xs text-muted-foreground">{criterion.weight}%</span>
          {changed ? (
            <Badge variant="outline" className="text-xs" data-testid="criterion-overridden">
              was {aiScore.score}
            </Badge>
          ) : null}
        </div>

        <div className="flex gap-1" role="group" aria-label={`Score for ${criterion.label}`}>
          {SCALE.map((n) => (
            <button
              key={n}
              type="button"
              disabled={locked}
              aria-pressed={value?.score === n}
              onClick={() => onScore(n, aiScore?.score)}
              data-testid={`score-${criterion.key}-${n}`}
              className={`h-7 w-7 rounded text-sm ${
                value?.score === n
                  ? 'bg-primary text-primary-foreground'
                  : 'border hover:bg-muted disabled:opacity-50'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* The anchors are what both the model and the auditor score against.
          Showing them here is what keeps the two calibrated to the same text. */}
      <p className="mt-1 text-xs text-muted-foreground">
        1: {criterion.anchors.poor} · 3: {criterion.anchors.meets} · 5:{' '}
        {criterion.anchors.excellent}
      </p>

      {criterion.guidance ? (
        <p className="mt-1 text-xs italic text-muted-foreground">{criterion.guidance}</p>
      ) : null}

      {value?.evidence && value.evidence.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {value.evidence.map((piece, i) => (
            <li key={`${piece.startMs}-${i}`} className="text-xs">
              <button
                type="button"
                onClick={() => onSeek(piece.startMs / 1000)}
                className="tabular text-muted-foreground underline-offset-2 hover:underline"
                data-testid="evidence-seek"
              >
                {formatClock(piece.startMs / 1000)}
              </button>{' '}
              <span>“{piece.quote}”</span>
            </li>
          ))}
        </ul>
      ) : null}

      <textarea
        value={value?.justification ?? ''}
        onChange={(e) => onJustify(e.target.value)}
        disabled={locked}
        rows={2}
        placeholder="Why this score?"
        aria-label={`Justification for ${criterion.label}`}
        data-testid={`justification-${criterion.key}`}
        className="mt-2 w-full rounded-md border border-input bg-background p-1.5 text-xs disabled:opacity-60"
      />
    </div>
  );
};

/**
 * What still blocks submission.
 *
 * Shown continuously rather than only on a rejected submit: an auditor should
 * know what is outstanding while they work, not after they try to finish.
 */
const validate = (
  criteria: RubricCriterion[],
  scores: Record<string, CriterionScore>,
): string[] => {
  const problems: string[] = [];

  for (const criterion of criteria) {
    const score = scores[criterion.key];
    if (!score) {
      problems.push(`${criterion.label} is not scored`);
      continue;
    }
    if (!score.justification?.trim()) {
      problems.push(`${criterion.label} has no justification`);
    }
    if (!score.evidence || score.evidence.length === 0) {
      problems.push(`${criterion.label} has no evidence`);
    }
  }

  return problems;
};

const elapsed = (from: number): number => Math.round((Date.now() - from) / 1000);
