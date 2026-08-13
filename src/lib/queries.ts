'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import {
  accessLogList,
  conversation,
  conversationList,
  coverageDay,
  enrollTokenResponse,
  fleetSummary,
  installationDetail,
  installationList,
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
