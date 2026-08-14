import { z } from 'zod';

/**
 * Response shapes, validated at the boundary.
 *
 * Everything the console renders about coverage and fleet health is a claim
 * about whether recording actually happened. Parsing rather than casting means
 * a backend change surfaces as a loud validation error instead of `undefined`
 * quietly rendering as a healthy-looking blank.
 */

/** Backend envelope from ResponseInterceptor. */
export const envelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ success: z.boolean(), message: z.string().optional(), data });

/**
 * One console role (handoff §6). The mechanism behind it is unchanged — the
 * backend still scopes every query — but there is one authorised reviewer, so
 * there is one role.
 */
export const roleSchema = z.enum(['ADMIN']);
export type Role = z.infer<typeof roleSchema>;

export const loginResponse = z.object({
  accessToken: z.string(),
  expiresIn: z.string().optional(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    roles: z.array(roleSchema),
    centreId: z.string().nullable(),
  }),
});
export type LoginResponse = z.infer<typeof loginResponse>;

export const meResponse = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roles: z.array(roleSchema),
  centreId: z.string().nullable(),
  teamId: z.string().nullable(),
});
export type Me = z.infer<typeof meResponse>;

/** Populated refs arrive as objects; unpopulated as plain id strings. */
const ref = <T extends z.ZodRawShape>(shape: T) =>
  z.union([z.string(), z.object({ _id: z.string() }).extend(shape)]);

export const centreRef = ref({ name: z.string(), code: z.string(), timezone: z.string().optional() });
export const counsellorRef = ref({ name: z.string(), employeeId: z.string().optional() });

export const fleetSummary = z.object({
  agentStates: z.record(z.string(), z.number()),
  agentVersions: z.array(z.object({ version: z.string(), count: z.number() })),
  uploadBacklog: z.object({ totalQueued: z.number(), worstInstallation: z.number() }),
  deviceFaults: z.number(),
  generatedAt: z.string(),
});
export type FleetSummary = z.infer<typeof fleetSummary>;

export const installation = z.object({
  _id: z.string(),
  installationId: z.string(),
  machineId: z.string(),
  machineName: z.string().optional(),
  counsellorUserId: counsellorRef.optional(),
  centreId: centreRef.optional(),
  agentVersion: z.string().optional(),
  osVersion: z.string().optional(),
  state: z.string(),
  agentState: z.string().optional(),
  deviceState: z.string().optional(),
  lastHeartbeatAt: z.string().optional(),
  lastSegmentAt: z.string().optional(),
  captureDevice: z
    .object({ id: z.string().optional(), name: z.string().optional(), channels: z.number().optional() })
    .optional(),
  diskFreeMb: z.number().optional(),
  queueDepth: z.number().optional(),
  clockOffsetMs: z.number().optional(),
  provisionedAt: z.string().optional(),
  deactivatedAt: z.string().optional(),
});
export type Installation = z.infer<typeof installation>;

export const installationList = z.object({
  items: z.array(installation),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const heartbeat = z.object({
  _id: z.string(),
  at: z.string(),
  agentState: z.string().optional(),
  deviceState: z.string().optional(),
  diskFreeMb: z.number().optional(),
  queueDepth: z.number().optional(),
  clockOffsetMs: z.number().optional(),
  cpuPct: z.number().optional(),
  memMb: z.number().optional(),
  version: z.string().optional(),
});

export const captureGap = z.object({
  _id: z.string(),
  installationId: z.string(),
  counsellorUserId: counsellorRef.optional(),
  centreId: centreRef.optional(),
  startUtc: z.string(),
  endUtc: z.string(),
  durationSec: z.number(),
  cause: z.string(),
  detail: z.string().optional(),
  detectedBy: z.string(),
  dispositioned: z.boolean().optional(),
});
export type CaptureGap = z.infer<typeof captureGap>;

export const agentEvent = z.object({
  _id: z.string(),
  at: z.string(),
  type: z.string(),
  severity: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const agentCommand = z.object({
  _id: z.string(),
  type: z.string(),
  state: z.string(),
  createdAt: z.string().optional(),
  sentAt: z.string().optional(),
  acknowledgedAt: z.string().optional(),
  detail: z.string().optional(),
});

export const installationDetail = z.object({
  installation,
  heartbeats: z.array(heartbeat),
  gaps: z.array(captureGap),
  events: z.array(agentEvent),
  commands: z.array(agentCommand),
});

export const crmLink = z.object({
  status: z.enum(['MATCHED', 'AMBIGUOUS', 'UNMATCHED', 'MANUAL']),
  leadId: z.string().optional(),
  walkInId: z.string().optional(),
  courseInterest: z.string().optional(),
  disposition: z.string().optional(),
  outcome: z.string().optional(),
  matchConfidence: z.number().optional(),
});

export const conversation = z.object({
  _id: z.string(),
  counsellorUserId: counsellorRef.optional(),
  centreId: centreRef.optional(),
  installationId: z.string(),
  startUtc: z.string(),
  endUtc: z.string(),
  durationSec: z.number(),
  speechDurationSec: z.number(),
  segmentIds: z.array(z.union([z.string(), z.object({ _id: z.string() }).passthrough()])).default([]),
  state: z.string(),
  crmLink: crmLink.default({ status: 'UNMATCHED' }),

  /** Capture gaps overlapping this recording, as offsets from its start. */
  gaps: z
    .array(z.object({ cause: z.string(), atSec: z.number(), durationSec: z.number() }))
    .default([]),
  partial: z.boolean().optional(),
  audioKey: z.string().optional(),
  waveformKey: z.string().optional(),
  legalHold: z.boolean().optional(),
});
export type Conversation = z.infer<typeof conversation>;

export const conversationList = z.object({
  items: z.array(conversation),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const streamUrlResponse = z.object({
  url: z.string(),
  expiresInSec: z.number(),
  durationSec: z.number().optional(),
  contentType: z.string().optional(),
});

export const waveformUrlResponse = z.object({ url: z.string(), expiresInSec: z.number() });

export const gapSummary = z.object({
  cause: z.string(),
  durationSec: z.number(),
  count: z.number(),
});

export const coverageDay = z.object({
  _id: z.string(),
  date: z.string(),
  centreId: centreRef.optional(),
  counsellorUserId: counsellorRef.nullable().optional(),
  crmWalkIns: z.number(),
  capturedConversations: z.number(),
  matched: z.number(),
  unmatched: z.number(),
  coveragePct: z.number(),
  crmUnderLogged: z.number().optional(),
  gaps: z.array(gapSummary).default([]),
  computedAt: z.string(),
});
export type CoverageDay = z.infer<typeof coverageDay>;

export const centre = z.object({
  _id: z.string(),
  code: z.string(),
  name: z.string(),
  city: z.string().optional(),
  region: z.string().optional(),
  timezone: z.string().optional(),
  active: z.boolean().optional(),
});
export type Centre = z.infer<typeof centre>;

export const counsellor = z.object({
  _id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  employeeId: z.string().optional(),
  centreId: z.string().optional(),
  teamId: z.string().optional(),
  status: z.string().optional(),

  // Carried on the org tree since the fleet-health screen went. The reviewer's
  // question is "why are there no recordings from this person", and a dead
  // agent is the answer.
  agentState: z.string().nullable().optional(),
  lastHeartbeatAt: z.string().nullable().optional(),
  lastSegmentAt: z.string().nullable().optional(),
  installationId: z.string().nullable().optional(),
});
export type Counsellor = z.infer<typeof counsellor>;

export const team = z.object({
  _id: z.string(),
  name: z.string(),
  centreId: z.string(),
  managerUserId: z.string().optional(),
});

/** Null pct means nothing has been reconciled yet — not zero coverage. */
export const centreCoverage = z.object({
  walkIns: z.number(),
  captured: z.number(),
  pct: z.number().nullable(),
});

export const orgTree = z.array(
  centre.extend({
    coverage: centreCoverage.optional(),
    teams: z.array(team.extend({ counsellors: z.array(counsellor) })),
    unassignedCounsellors: z.array(counsellor),
  }),
);
export type OrgTree = z.infer<typeof orgTree>;

export const enrollTokenResponse = z.object({
  enrollToken: z.string(),
  counsellorUserId: z.string(),
  employeeId: z.string().optional(),
  centreId: z.string(),
  expiresAt: z.string(),
});

export const accessLogEntry = z.object({
  _id: z.string(),
  userId: z.union([z.string(), z.object({ _id: z.string(), name: z.string(), email: z.string() })]),
  role: z.array(z.string()).default([]),
  action: z.string(),
  conversationId: z.string().optional(),
  at: z.string(),
  ip: z.string().optional(),
  reason: z.string().optional(),
  denied: z.boolean().optional(),
  detail: z.string().optional(),
});
export type AccessLogEntry = z.infer<typeof accessLogEntry>;

export const accessLogList = z.object({
  items: z.array(accessLogEntry),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const legalHold = z.object({
  _id: z.string(),
  conversationIds: z.array(z.string()).default([]),
  reason: z.string(),
  placedBy: z.union([z.string(), z.object({ _id: z.string(), name: z.string() })]).optional(),
  placedAt: z.string(),
  reviewDueAt: z.string().optional(),
  releasedAt: z.string().optional(),
});

export const purgeLogEntry = z.object({
  _id: z.string(),
  runAt: z.string(),
  scope: z.string().optional(),
  conversationsPurged: z.number(),
  segmentsPurged: z.number(),
  bytesFreed: z.number(),
  skippedForHold: z.number(),
  errors: z.array(z.string()).default([]),
  durationMs: z.number().optional(),
});

/** Helper for reading either a populated ref or a bare id. */
export const refName = (value: unknown, fallback = '—'): string => {
  if (value && typeof value === 'object' && 'name' in value) {
    return String((value as { name: unknown }).name);
  }
  return fallback;
};

export const refId = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return undefined;
};

export const refTimezone = (value: unknown): string => {
  if (value && typeof value === 'object' && 'timezone' in value) {
    const tz = (value as { timezone?: unknown }).timezone;
    if (typeof tz === 'string' && tz) return tz;
  }
  return 'Asia/Kolkata';
};

// ── transcripts (Cut B) ─────────────────────────────────────────────────────

export const transcriptTurn = z.object({
  idx: z.number(),
  startMs: z.number(),
  endMs: z.number(),
  /** Anonymous diarisation label. There is deliberately no visitor identity. */
  speakerLabel: z.string(),
  speakerRole: z.string().optional(),
  text: z.string(),
  asrConfidence: z.number(),
});

export const transcriptQuality = z.object({
  avgAsrConfidence: z.number(),
  usableForAutoAudit: z.boolean(),
  engine: z.string(),
  modelVersion: z.string().optional(),
  reason: z.string().optional(),
});

export const transcript = z.object({
  _id: z.string(),
  language: z.string(),
  fullText: z.string(),
  turns: z.array(transcriptTurn),
  quality: transcriptQuality,
  counsellorSpeakerLabel: z.string().optional(),
  speakerTagSource: z.string(),
  speakerTagConfidence: z.number(),
  speakerTagRationale: z.string().optional(),
  engine: z.string(),
  modelVersion: z.string().optional(),
  version: z.number(),
  /** True while the counsellor tag is a guess. Drives the provisional markers. */
  provisional: z.boolean(),
});

export const transcriptResponse = z.object({
  status: z.string(),
  reason: z.string().optional(),
  transcript: transcript.nullable(),
});

export const speakerTagResult = z.object({
  counsellorSpeakerLabel: z.string(),
  speakerTagSource: z.string(),
  speakerTagConfidence: z.number(),
  provisional: z.boolean(),
  metrics: z.object({
    talkRatio: z.number(),
    longestMonologueSec: z.number(),
    deadAirSec: z.number(),
    questionCount: z.number(),
    wordsPerMinute: z.number(),
    provisional: z.boolean(),
  }),
});

export type Transcript = z.infer<typeof transcript>;
export type TranscriptTurn = z.infer<typeof transcriptTurn>;

// ── audits (Cut B) ──────────────────────────────────────────────────────────

export const scoreEvidence = z.object({
  startMs: z.number(),
  endMs: z.number(),
  quote: z.string(),
});

export const criterionScore = z.object({
  criterionKey: z.string(),
  score: z.number(),
  confidence: z.number().optional(),
  justification: z.string(),
  evidence: z.array(scoreEvidence).default([]),
  overriddenFromAi: z.boolean().default(false),
  aiScore: z.number().optional(),
  overrideReason: z.string().optional(),
});

export const audit = z.object({
  _id: z.string(),
  conversationId: z.union([z.string(), z.object({ _id: z.string() }).passthrough()]),
  counsellorUserId: z.union([z.string(), z.object({ _id: z.string() }).passthrough()]),
  centreId: z.string().optional(),
  rubricId: z.string(),
  rubricVersion: z.number(),
  type: z.string(),
  auditorUserId: z.string().optional(),
  aiModel: z.string().optional(),
  aiPromptVersion: z.string().optional(),
  transcriptVersion: z.number().optional(),
  criterionScores: z.array(criterionScore).default([]),
  totalScore: z.number().optional(),
  maxScore: z.number().optional(),
  normalisedScore: z.number().optional(),
  band: z.string().optional(),
  state: z.string(),
  stateReason: z.string().optional(),
  version: z.number(),
  supersedesAuditId: z.string().optional(),
  submittedAt: z.string().optional(),
  lockedAt: z.string().optional(),
  timeSpentSec: z.number().optional(),
  dueAt: z.string().optional(),
  claimedByUserId: z.string().optional(),
  claimedAt: z.string().optional(),
  samplingReason: z.string().optional(),
  createdAt: z.string().optional(),
});

export const flag = z.object({
  _id: z.string(),
  conversationId: z.string(),
  auditId: z.string().optional(),
  ruleKey: z.string(),
  category: z.string(),
  severity: z.string(),
  startMs: z.number().optional(),
  endMs: z.number().optional(),
  quote: z.string().optional(),
  aiConfidence: z.number().optional(),
  state: z.string(),
  reviewNote: z.string().optional(),
  actionTaken: z.string().optional(),
});

export const auditList = z.object({
  items: z.array(audit),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export const auditDetail = z.object({
  audit,
  flags: z.array(flag).default([]),
});

export const conversationAudits = z.object({
  ai: audit.nullable(),
  human: audit.nullable(),
  history: z.array(audit).default([]),
  flags: z.array(flag).default([]),
});

export const transcriptSearchResult = z.object({
  query: z.string(),
  total: z.number(),
  items: z.array(
    z.object({
      conversationId: z.string(),
      counsellorUserId: z.string().optional(),
      language: z.string().optional(),
      hits: z
        .array(
          z.object({
            startMs: z.number(),
            endMs: z.number(),
            speakerRole: z.string().optional(),
            text: z.string(),
          }),
        )
        .default([]),
    }),
  ),
});

export const counsellorHistory = z.object({
  audits: z.array(audit).default([]),
  flags: z.array(flag).default([]),
});

// ── rubrics (Cut B) ─────────────────────────────────────────────────────────

export const rubricCriterion = z.object({
  key: z.string(),
  label: z.string(),
  weight: z.number(),
  aiScoreable: z.boolean().default(true),
  anchors: z.object({ poor: z.string(), meets: z.string(), excellent: z.string() }),
  guidance: z.string().optional(),
});

export const rubric = z.object({
  _id: z.string(),
  name: z.string(),
  version: z.number(),
  state: z.string(),
  description: z.string().optional(),
  sections: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      weight: z.number(),
      criteria: z.array(rubricCriterion).default([]),
    }),
  ),
  flagRules: z
    .array(
      z.object({
        key: z.string(),
        category: z.string(),
        severity: z.string(),
        description: z.string(),
      }),
    )
    .default([]),
  bands: z
    .array(
      z.object({
        band: z.string(),
        minScore: z.number(),
        maxScore: z.number(),
        action: z.string(),
      }),
    )
    .default([]),
});

export type Audit = z.infer<typeof audit>;
export type AuditFlag = z.infer<typeof flag>;
export type Rubric = z.infer<typeof rubric>;
export type RubricCriterion = z.infer<typeof rubricCriterion>;
export type CriterionScore = z.infer<typeof criterionScore>;
