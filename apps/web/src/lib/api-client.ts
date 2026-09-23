// One fetch wrapper for the whole app: base URL, Bearer token, JSON, one error type.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'tp_token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Only call these from event handlers, query functions or useHasToken, never during render.
const TOKEN_EVENT = 'tp-token';
export const readToken = () => localStorage.getItem(TOKEN_KEY);
export const writeToken = (t: string) => {
  localStorage.setItem(TOKEN_KEY, t);
  dispatchEvent(new Event(TOKEN_EVENT));
};
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  dispatchEvent(new Event(TOKEN_EVENT));
};
export const subscribeToken = (onChange: () => void) => {
  addEventListener(TOKEN_EVENT, onChange);
  addEventListener('storage', onChange); // other tabs
  return () => {
    removeEventListener(TOKEN_EVENT, onChange);
    removeEventListener('storage', onChange);
  };
};

interface Options {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** 'root' for unprefixed routes such as /health */
  base?: 'api' | 'root';
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const url = new URL(`${opts.base === 'root' ? '' : '/api/v1'}${path}`, API_URL);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const token = readToken();
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return null as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Expired or invalid session: drop it and start over. Login failures are 401 too,
    // but there is no token then, so the form shows the message instead.
    if (res.status === 401 && token) {
      clearToken();
      // Full reload on purpose: drops every cached query of the old session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      location.assign('/login');
    }
    throw new ApiError(res.status, data.code ?? 'INTERNAL', data.message ?? 'Something went wrong');
  }
  return data as T;
}
