import { NextRequest } from 'next/server';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastPrune = 0;

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for).
 *  IPv6 is bucketed to its /64 prefix — consumers get a whole /64, so per-full-
 *  address buckets would hand an attacker 2^64 fresh rate-limit keys. */
export function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  const ip = fwd ? fwd.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown';
  if (ip.includes(':') && !ip.includes('.')) {
    return ip.split(':').slice(0, 4).join(':');
  }
  return ip;
}

/**
 * Best-effort in-memory fixed-window rate limit.
 *
 * On serverless this is per-instance, not global, so it mitigates a single
 * client hammering one warm instance but is NOT a substitute for a durable
 * limiter (Upstash / Vercel KV) under coordinated abuse. Good enough to blunt
 * casual abuse of expensive endpoints (paid AI / Telegram) without adding infra.
 *
 * @returns `{ allowed, retryAfter }` where retryAfter is seconds until reset.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();

  // Opportunistically drop expired buckets so the map can't grow unbounded.
  if (now - lastPrune > 60_000) {
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
    lastPrune = now;
  }

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }
  if (existing.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  return { allowed: true, retryAfter: 0 };
}
