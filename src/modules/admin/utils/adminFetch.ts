const STORAGE_KEY = 'admin_api_secret';

export function getAdminSecret(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setAdminSecret(secret: string): void {
  sessionStorage.setItem(STORAGE_KEY, secret);
}

export function clearAdminSecret(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const secret = getAdminSecret();
  const headers = new Headers(init?.headers);

  if (secret) {
    headers.set('Authorization', `Bearer ${secret}`);
  }

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...init, headers });
}
