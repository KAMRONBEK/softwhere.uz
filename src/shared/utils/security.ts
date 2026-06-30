/**
 * Security helpers: HTML escaping, safe JSON-LD serialization, and an SSRF
 * guard for user-supplied URLs that get fetched server-side.
 */

/**
 * Escape a string for safe inclusion inside HTML text/attributes. Used for
 * user-controlled values composed into Telegram messages (parse_mode=html)
 * and any hand-built HTML.
 */
export function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serialize a value to a JSON string that is safe to embed inside a
 * `<script type="application/ld+json">` element.
 *
 * `JSON.stringify` alone does NOT escape `<`, so a value containing the
 * literal `</script>` (e.g. an AI-generated post title or FAQ answer) could
 * terminate the script element early and inject executing markup — stored XSS.
 * Escaping `<`, `>` and `&` makes the payload inert while remaining valid JSON.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '127.0.0.1', '::1', 'metadata.google.internal']);

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 0 || a === 10 || a === 127) return true; // unspecified / private / loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

/**
 * Validate that a user-supplied URL is safe to fetch from the server. Blocks
 * non-http(s) schemes and hosts that are (or look like) private, loopback,
 * link-local or cloud-metadata addresses — basic SSRF protection.
 *
 * Note: this inspects the literal host only. For defense against DNS-based
 * rebinding, pair this with a network egress policy. Throws on rejection.
 */
export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('INVALID_URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('BLOCKED_SCHEME');
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTNAMES.has(host)) throw new Error('BLOCKED_HOST');
  if (host.endsWith('.local') || host.endsWith('.internal')) throw new Error('BLOCKED_HOST');
  if (isPrivateIpv4(host)) throw new Error('BLOCKED_HOST');
  // IPv6 loopback / unique-local / link-local — ONLY when the host is an actual
  // IPv6 literal (bracketed in the URL, or containing ':'). Otherwise DNS names
  // like fda.gov / fc2.com would be wrongly blocked as if they were fc00::/7.
  const isIpv6Literal = url.hostname.startsWith('[') || host.includes(':');
  if (isIpv6Literal && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'))) {
    throw new Error('BLOCKED_HOST');
  }
  return url;
}
