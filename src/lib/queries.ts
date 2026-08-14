'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { CriterionScore } from './schemas';
import {
  accessLogList,
  conversation,
  conversationList,
  coverageDay,
  enrollTokenResponse,
  fleetSummary,
  installationDetail,
  audit,
  auditDetail,
  auditList,
  conversationAudits,
  counsellorHistory,
  flag,
  installationList,
  rubric,
  speakerTagResult,
  transcriptResponse,
  legalHold,
  orgTree,
  purgeLogEntry,
  streamUrlResponse,
  waveformUrlResponse,
  captureGap,
  centre,
  counsellor,
} from './schemas';
import { z } from 'zod';

// ── fleet ───────────────────────────────────────────────────────────────────

export const useFleetSummary = () =>
  useQuery({
    queryKey: ['fleet', 'summary'],
    queryFn: () => apiFetch('/fleet/summary', fleetSummary),
    // Fleet health is a live operational view; a minute-stale agent state is
    // misleading when someone is actively chasing an outage.
    refetchInterval: 30_000,
  });

export interface InstallationFilters {
  centreId?: string;
  state?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export const useInstallations = (filters: InstallationFilters) =>
  useQuery({
    queryKey: ['installations', filters],
    queryFn: () => apiFetch('/installations', installationList, { query: { ...filters } }),
    refetchInterval: 30_000,
  });

export const useInstallation = (id: string) =>
  useQuery({
    queryKey: ['installation', id],
    queryFn: () => apiFetch(`/installations/${id}`, installationDetail),
    enabled: Boolean(id),
  });

export const useIssueCommand = (installationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type: string) =>
      apiFetch(
        `/installations/${installationId}/commands`,
        z.object({ id: z.string(), type: z.string(), state: z.string() }),
        { method: 'POST', body: { type } },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['installation', installationId] }),
  });
};

export const useDeactivate = (installationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch(
        `/installations/${installationId}/deactivate`,
        z.object({ installationId: z.string(), state: z.string() }),
        { method: 'POST', body: { reason } },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['installation', installationId] }),
  });
};

// ── coverage ────────────────────────────────────────────────────────────────

export interface CoverageFilters {
  date?: string;
  from?: string;
  to?: string;
  centreId?: string;
  counsellorId?: string;
}

export const useCoverage = (filters: CoverageFilters) =>
  useQuery({
    queryKey: ['coverage', filters],
    queryFn: () => apiFetch('/coverage', z.array(coverageDay), { query: { ...filters } }),
  });

export const useCoverageTrend = (params: { centreId?: string; counsellorId?: string; days?: number }) =>
  useQuery({
    queryKey: ['coverage', 'trend', params],
    queryFn: () => apiFetch('/coverage/trend', z.array(coverageDay), { query: { ...params } }),
  });

export const useGapWorklist = (params: { cause?: string; centreId?: string }) =>
  useQuery({
    queryKey: ['coverage', 'gaps', params],
    queryFn: () => apiFetch('/coverage/gaps', z.array(captureGap), { query: { ...params } }),
  });

// ── org ─────────────────────────────────────────────────────────────────────

export const useOrgTree = () =>
  useQuery({ queryKey: ['org', 'tree'], queryFn: () => apiFetch('/org/tree', orgTree) });

export const useCentres = () =>
  useQuery({ queryKey: ['org', 'centres'], queryFn: () => apiFetch('/org/centres', z.array(centre)) });

export const useCounsellors = (params: { centreId?: string; q?: string } = {}) =>
  useQuery({
    queryKey: ['org', 'counsellors', params],
    queryFn: () => apiFetch('/org/counsellors', z.array(counsellor), { query: { ...params } }),
  });

export const useCounsellor = (id: string) =>
  useQuery({
    queryKey: ['org', 'counsellor', id],
    queryFn: () => apiFetch(`/org/counsellors/${id}`, counsellor),
    enabled: Boolean(id),
  });

// ── conversations ───────────────────────────────────────────────────────────

export interface ConversationFilters {
  centreId?: string;
  counsellorId?: string;
  from?: string;
  to?: string;
  minDuration?: number;
  crmStatus?: string;
  page?: number;
  limit?: number;
}

export const useConversations = (filters: ConversationFilters) =>
  useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => apiFetch('/conversations', conversationList, { query: { ...filters } }),
  });

export const useConversation = (id: string) =>
  useQuery({
    queryKey: ['conversation', id],
    queryFn: () => apiFetch(`/conversations/${id}`, conversation.passthrough()),
    enabled: Boolean(id),
  });

/**
 * Fetched on demand rather than with the conversation, because requesting it
 * IS the access event: the backend writes an AccessLog row before minting the
 * URL (FR-M4). Prefetching would log playback that never happened.
 */
export const useStreamUrl = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['conversation', id, 'stream'],
    queryFn: () => apiFetch(`/conversations/${id}/stream`, streamUrlResponse),
    enabled: enabled && Boolean(id),
    // The URL expires in 5 minutes; refetch before it does.
    staleTime: 4 * 60_000,
    gcTime: 4 * 60_000,
  });

export const useWaveformUrl = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['conversation', id, 'waveform'],
    queryFn: () => apiFetch(`/conversations/${id}/waveform`, waveformUrlResponse),
    enabled: enabled && Boolean(id),
    retry: false,
  });

export const useDownload = (id: string) =>
  useMutation({
    mutationFn: (reason: string) =>
      apiFetch(`/conversations/${id}/download`, z.object({ url: z.string(), reason: z.string() }), {
        method: 'POST',
        body: { reason },
      }),
  });

// ── enrollment ──────────────────────────────────────────────────────────────

export const useCreateCounsellor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; employeeId: string; centreId: string }) =>
      apiFetch('/org/counsellors', counsellor.passthrough(), { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org'] }),
  });
};

export const useCreateEnrollToken = () =>
  useMutation({
    mutationFn: (counsellorUserId: string) =>
      apiFetch('/installations/enroll-token', enrollTokenResponse, {
        method: 'POST',
        body: { counsellorUserId },
      }),
  });

// ── compliance ──────────────────────────────────────────────────────────────

export const useAccessLog = (params: {
  from?: string;
  to?: string;
  action?: string;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: ['compliance', 'access-log', params],
    queryFn: () => apiFetch('/compliance/access-log', accessLogList, { query: { ...params } }),
  });

export const useLegalHolds = () =>
  useQuery({
    queryKey: ['compliance', 'legal-holds'],
    queryFn: () => apiFetch('/compliance/legal-holds', z.array(legalHold)),
  });

export const usePurgeLog = () =>
  useQuery({
    queryKey: ['compliance', 'purge-log'],
    queryFn: () => apiFetch('/compliance/purge-log', z.array(purgeLogEntry)),
  });

// ── transcripts (Cut B) ─────────────────────────────────────────────────────

export const useTranscript = (conversationId: string) =>
  useQuery({
    queryKey: ['conversation', conversationId, 'transcript'],
    queryFn: () => apiFetch(`/conversations/${conversationId}/transcript`, transcriptResponse),
    // A conversation still with the provider will have one shortly. Polling
    // beats making an auditor reload to find out.
    refetchInterval: (query) =>
      query.state.data?.transcript ? false : 30_000,
  });

export const useSetSpeakerTag = (conversationId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (counsellorSpeakerLabel: string) =>
      apiFetch(`/conversations/${conversationId}/transcript/speaker-tag`, speakerTagResult, {
        method: 'PATCH',
        body: { counsellorSpeakerLabel },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['conversation', conversationId, 'transcript'],
      });
      // The conversation's talk ratio changes with the tag, so the detail
      // header has to be refetched too or it will contradict the transcript.
      void queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
    },
  });
};

// ── audits (Cut B) ──────────────────────────────────────────────────────────

export const useAuditQueue = (params: {
  state?: string;
  assigned?: 'me' | 'unassigned' | 'any';
  flagged?: boolean;
  page?: number;
  limit?: number;
}) =>
  useQuery({
    queryKey: ['audits', params],
    queryFn: () => apiFetch('/audits', auditList, { query: { ...params } }),
  });

export const useAudit = (id: string) =>
  useQuery({
    queryKey: ['audit', id],
    queryFn: () => apiFetch(`/audits/${id}`, auditDetail),
    enabled: Boolean(id),
  });

/** The audits and flags for one conversation — how the review screen finds them. */
export const useConversationAudits = (conversationId: string) =>
  useQuery({
    queryKey: ['conversation', conversationId, 'audits'],
    queryFn: () => apiFetch(`/audits/for-conversation/${conversationId}`, conversationAudits),
    enabled: Boolean(conversationId),
  });

export const useCounsellorHistory = (counsellorUserId: string) =>
  useQuery({
    queryKey: ['counsellor', counsellorUserId, 'history'],
    queryFn: () => apiFetch(`/audits/history/${counsellorUserId}`, counsellorHistory),
    enabled: Boolean(counsellorUserId),
  });

export const usePublishedRubric = (name = 'counselling-quality') =>
  useQuery({
    queryKey: ['rubric', 'published', name],
    // The rubric in force changes rarely and every scorecard needs it, so it is
    // cached for the session rather than refetched per audit.
    staleTime: 10 * 60_000,
    queryFn: () => apiFetch(`/rubrics/published/${name}`, rubric.nullable()),
  });

export const useClaimAudit = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch(`/audits/${id}/claim`, audit, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['audit', id] });
      void queryClient.invalidateQueries({ queryKey: ['audits'] });
    },
  });
};

export const useReleaseAudit = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiFetch(`/audits/${id}/release`, audit, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['audits'] });
    },
  });
};

export interface AuditSubmission {
  criterionScores: CriterionScore[];
  timeSpentSec?: number;
}

/** Autosave. Nothing is scored or locked by this. */
export const useSaveAuditDraft = (id: string) =>
  useMutation({
    mutationFn: (body: AuditSubmission) =>
      apiFetch(`/audits/${id}`, audit, { method: 'PATCH', body }),
  });

export const useSubmitAudit = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AuditSubmission) =>
      apiFetch(`/audits/${id}/submit`, audit, { method: 'POST', body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['audit', id] });
      void queryClient.invalidateQueries({ queryKey: ['audits'] });
    },
  });
};

export const useReviewFlag = (auditId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { flagId: string; decision: string; note?: string; actionTaken?: string }) =>
      apiFetch(`/audits/flags/${body.flagId}/review`, flag, {
        method: 'POST',
        body: { decision: body.decision, note: body.note, actionTaken: body.actionTaken },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['audit', auditId] });
    },
  });
};
