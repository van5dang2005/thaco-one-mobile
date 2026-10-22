import { env } from '@/core/config/env';
import { refreshSso } from '@/core/session/sso';
import { tokenStore } from '@/core/session/tokenStore';

import { type ApiService, ApiError } from './ApiError';
import { fetchWithTimeout } from './fetchWithTimeout';

type QueryPrimitive = string | number | boolean | Date;
export type QueryValue = QueryPrimitive | QueryPrimitive[] | null | undefined;
export type Query = Record<string, QueryValue>;

export type RequestOptions = {
  query?: Query;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  /** Send the bearer token (default true). */
  auth?: boolean;
  timeoutMs?: number;
};

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

let unauthorizedHandler: ((service: ApiService) => void) | null = null;

/** Called once Keycloak refuses the refresh token (400/401); the session layer signs the user out. */
export function setUnauthorizedHandler(handler: (service: ApiService) => void) {
  unauthorizedHandler = handler;
}

function serialize(value: QueryPrimitive) {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** `path` may also be a whole link (a guest QR holds one); it then goes as it is, without the base. */
export function buildUrl(baseUrl: string, path: string, query?: Query) {
  const base = /^https?:\/\//i.test(path) ? '' : baseUrl;
  const params: string[] = [];
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    // ASP.NET binds List<T> from repeated keys: statuses=1&statuses=2
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => params.push(`${encodeURIComponent(key)}=${encodeURIComponent(serialize(item))}`));
  });
  return `${base}${path}${params.length ? `?${params.join('&')}` : ''}`;
}

async function toApiError(service: ApiService, response: Response): Promise<ApiError> {
  let body: Record<string, unknown> | null = null;
  try {
    const text = await response.text();
    body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    body = null;
  }
  // Two shapes: Result<T> { message, code, errorCode, data } and ErrorResponse { statusCode, message, errorCode, details }.
  const errorCode =
    (typeof body?.errorCode === 'string' && body.errorCode) ||
    (body?.errors ? 'VALIDATION_ERROR' : '') ||
    (response.status === 401 ? 'UNAUTHORIZED' : `HTTP_${response.status}`);
  const message = (typeof body?.message === 'string' && body.message) || (typeof body?.title === 'string' && body.title) || response.statusText;
  return new ApiError({ service, status: response.status, errorCode, message, details: body?.details ?? body?.errors });
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(service: ApiService, baseUrl: string) {
  async function request<T>(method: Method, path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
    const url = buildUrl(baseUrl, path, options.query);
    const headers: Record<string, string> = { Accept: 'application/json' };
    let body: BodyInit | undefined;
    if (options.form) {
      body = options.form; // fetch sets the multipart boundary itself
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    const useAuth = options.auth !== false;
    const tokens = useAuth ? tokenStore.get() : null;
    if (tokens) headers.Authorization = `Bearer ${tokens.token}`;

    let response: Response;
    try {
      response = await fetchWithTimeout(url, { method, headers, body }, options.timeoutMs ?? env.requestTimeoutMs, options.signal);
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError' && !options.signal?.aborted;
      throw new ApiError({ service, status: 0, errorCode: aborted ? 'TIMEOUT' : 'NETWORK', message: String(error) });
    }

    if (response.status === 401 && useAuth && tokens && !isRetry) {
      // A concurrent request may already have refreshed (SSO tokens live ~5 minutes); retry with that one.
      const outcome = tokenStore.get()?.token !== tokens.token ? 'refreshed' : await refreshSso();
      if (outcome === 'refreshed') return request<T>(method, path, options, true);
      // Keycloak unreachable or failing: keep the session and report a transport error the screen can retry.
      if (outcome === 'unavailable') throw new ApiError({ service, status: 0, errorCode: 'NETWORK', message: 'SSO token refresh unavailable' });
      unauthorizedHandler?.(service);
    }

    if (!response.ok) throw await toApiError(service, response);
    if (response.status === 204) return undefined as T;

    const text = await response.text();
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  return {
    service,
    baseUrl,
    get: <T>(path: string, options?: Omit<RequestOptions, 'body' | 'form'>) => request<T>('GET', path, options),
    post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'form'>) => request<T>('POST', path, { ...options, body }),
    put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'form'>) => request<T>('PUT', path, { ...options, body }),
    patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'form'>) => request<T>('PATCH', path, { ...options, body }),
    delete: <T>(path: string, options?: Omit<RequestOptions, 'body' | 'form'>) => request<T>('DELETE', path, options),
    postForm: <T>(path: string, form: FormData, options?: Omit<RequestOptions, 'body' | 'form'>) =>
      request<T>('POST', path, { ...options, form, timeoutMs: options?.timeoutMs ?? 60_000 }),
    putForm: <T>(path: string, form: FormData, options?: Omit<RequestOptions, 'body' | 'form'>) =>
      request<T>('PUT', path, { ...options, form, timeoutMs: options?.timeoutMs ?? 60_000 }),
    /** Bearer header, for downloads / image requests outside fetch. */
    authHeaders(): Record<string, string> {
      const tokens = tokenStore.get();
      return tokens ? { Authorization: `Bearer ${tokens.token}` } : {};
    },
    url: (path: string, query?: Query) => buildUrl(baseUrl, path, query),
  };
}
