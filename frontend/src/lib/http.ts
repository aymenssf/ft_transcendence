import { STORAGE_KEYS } from './env';

/** Error carrying the HTTP status so callers can branch on 401 vs. 404 vs. 500. */
export class HttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.token);
}

function authHeaders(json = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Pulls the most useful message out of whatever the service returned. The three
 * backends are inconsistent: some send `{message}`, some `{error}`, some plain
 * text, some nothing at all.
 */
async function readError(response: Response): Promise<{ message: string; body: unknown }> {
  const fallback = `${response.status} ${response.statusText || 'Request failed'}`;
  const text = await response.text().catch(() => '');
  if (!text) return { message: fallback, body: null };

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const message = record['message'] ?? record['error'] ?? record['msg'];
      if (typeof message === 'string' && message.length > 0) {
        return { message, body: parsed };
      }
    }
    return { message: fallback, body: parsed };
  } catch {
    return { message: text.slice(0, 200), body: text };
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Set for FormData uploads so the browser can write its own boundary. */
  raw?: boolean;
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, raw = false } = options;

  const init: RequestInit = { method, headers: authHeaders(!raw) };
  if (signal) init.signal = signal;
  if (body !== undefined) {
    init.body = raw ? (body as BodyInit) : JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new HttpError(0, 'Network unreachable. Check your connection and try again.');
  }

  if (!response.ok) {
    const { message, body: errorBody } = await readError(response);
    throw new HttpError(response.status, message, errorBody);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export const http = {
  get: <T>(url: string, signal?: AbortSignal) => request<T>(url, { method: 'GET', signal }),
  post: <T>(url: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(url, { method: 'POST', body, signal }),
  put: <T>(url: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(url, { method: 'PUT', body, signal }),
  patch: <T>(url: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(url, { method: 'PATCH', body, signal }),
  delete: <T>(url: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(url, { method: 'DELETE', body, signal }),
  upload: <T>(url: string, form: FormData, signal?: AbortSignal) =>
    request<T>(url, { method: 'POST', body: form, raw: true, signal }),
};

/** Normalises anything thrown into a user-presentable sentence. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
