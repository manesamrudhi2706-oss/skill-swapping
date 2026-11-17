const TOKEN_KEY = 'sigma_auth_token';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: 'same-origin',
  });
}

export async function safeJson<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Still attempt parse in case header was stripped, but guard against HTML
    try {
      const text = await res.text();
      if (!text || text.trim().startsWith('<')) return null;
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
