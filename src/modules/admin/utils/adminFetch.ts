/**
 * Fetch wrapper for admin API calls. Auth now rides on the httpOnly session
 * cookie (set at login), which the browser sends automatically on same-origin
 * requests — so there is no token to attach here. On a 401 (expired/invalid
 * session) we reload so the server-side admin gate falls back to the login form.
 */
export async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers, credentials: 'same-origin' });

  if (res.status === 401 && typeof window !== 'undefined') {
    window.location.reload();
  }

  return res;
}
