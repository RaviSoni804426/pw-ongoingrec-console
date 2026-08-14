import { z } from 'zod';
import { envelope } from './schemas';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

const TOKEN_KEY = 'ongoingrec.token';
const USER_KEY = 'ongoingrec.user';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the caller is not (or no longer) authenticated. */
  get isUnauthorised(): boolean {
    return this.status === 401;
  }

  /** True when the caller is authenticated but out of scope (FR-M3, E-75). */
  get isForbidden(): boolean {
    return this.status === 403 || this.status === 404;
  }
}

export const tokenStore = {
  get: (): string | null => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const userStore = {
  get: <T>(): T | null => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  set: (user: unknown) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip the bearer header (login only). */
  anonymous?: boolean;
}

/**
 * The single path to the backend.
 *
 * Every response is parsed with a zod schema rather than cast, so a shape change
 * fails here with a clear message instead of surfacing as a blank cell in a
 * coverage grid.
 */
export async function apiFetch<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  options: RequestOptions = {},
): Promise<z.infer<T>> {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (!options.anonymous) {
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError(response.status, `Malformed response from ${path}`);
    }
  }

  if (!response.ok) {
    const body = payload as { message?: string | string[]; error?: string } | undefined;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? response.statusText);
    throw new ApiError(response.status, message, body?.error);
  }

  const parsed = envelope(schema).safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      response.status,
      `Unexpected response shape from ${path}: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    );
  }

  return parsed.data.data as z.infer<T>;
}
