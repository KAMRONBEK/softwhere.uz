import { generateWithWebSearch, safeGenerateJSON } from '@/core/ai';
import { logger } from '@/core/logger';
import { assertFetchableUrl } from '@/shared/utils/security';

const CONTEXT = 'BLOG';

/**
 * A single verified fact the writer is allowed to cite. Facts come from two
 * places: Kimi's server-side $web_search (found live on the web) and the
 * deterministic World Bank fetch below. The writing prompt hard-constrains
 * statistics to this sheet — anything not here must be written qualitatively.
 */
export interface Fact {
  id: string;
  statement: string;
  year?: string;
  sourceName: string;
  sourceUrl: string;
}

export interface FactSheet {
  facts: Fact[];
  /** True when the web-search research step ran (vs deterministic-only). */
  searched: boolean;
  searches: number;
}

export const EMPTY_FACT_SHEET: FactSheet = { facts: [], searched: false, searches: 0 };

/**
 * Free, citable domains that both keep the pipeline honest and are exactly the
 * high-authority sources AI answer engines already trust. Statista/Gartner are
 * paywalled — these cover the same ground for a Tashkent agency blog.
 */
const PREFERRED_SOURCES = [
  'worldbank.org',
  'datareportal.com (Digital 2026: Uzbekistan)',
  'survey.stackoverflow.co (Stack Overflow Developer Survey)',
  'stateofjs.com',
  'ourworldindata.org',
  'itu.int / datahub.itu.int',
  'stat.uz (Uzbekistan Statistics Agency)',
  'it-park.uz (IT Park Uzbekistan)',
  'github.blog (Octoverse)',
];

const MAX_FACTS = 12;

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Strip markdown fences the model sometimes wraps JSON in. */
function stripFences(raw: string): string {
  return raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

function parseFacts(raw: string): Omit<Fact, 'id'>[] {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return [];
    const parsed = JSON.parse(stripFences(raw.slice(start, end + 1)));
    const list = Array.isArray(parsed.facts) ? parsed.facts : [];
    const facts: Omit<Fact, 'id'>[] = [];
    for (const f of list) {
      if (!f || typeof f !== 'object') continue;
      const statement = typeof f.statement === 'string' ? f.statement.trim() : '';
      const sourceName = typeof f.source_name === 'string' ? f.source_name.trim() : '';
      if (!statement || !sourceName || !isHttpUrl(f.source_url)) continue;
      facts.push({
        statement,
        sourceName,
        sourceUrl: f.source_url,
        ...(f.year != null && String(f.year).trim() && { year: String(f.year).trim() }),
      });
    }
    return facts;
  } catch {
    logger.warn('Failed to parse research fact JSON', undefined, CONTEXT);
    return [];
  }
}

/**
 * Research a topic with real web search and return only facts that were
 * actually found (with their source URLs). Returns an empty sheet when search
 * is unavailable — the caller then instructs the writer to stay qualitative.
 *
 * Two stages on purpose: the search call is a natural "please search and
 * report" request (a strict JSON-output instruction makes the model skip tool
 * calls and answer from memory — observed live), and a second, tool-free call
 * converts the report to the strict fact-sheet JSON.
 */
export async function buildFactSheet(
  topic: { title: string; primaryKeyword: string; pillarName: string },
  opts?: { roundTimeoutMs?: number }
): Promise<FactSheet> {
  const today = new Date().toISOString().slice(0, 10);

  // --- Stage A: search the web and report findings as text ------------------
  const searchPrompt = `Please search the web for the most recent statistics and facts about this topic (today is ${today} — I need currently published figures, and your training data is stale, so anything you merely remember is unacceptable):

TOPIC: "${topic.title}" (keyword: ${topic.primaryKeyword}; service area: ${topic.pillarName}; audience: business owners in Uzbekistan/Central Asia)

Search 2-4 times from different angles: current global stats, the Uzbekistan/Central Asia market, current costs/salaries/rates, developments from the last 12 months. Favor these sources when relevant: ${PREFERRED_SOURCES.join('; ')}.

Then report the 5-10 most useful facts you found. For EACH fact give: the factual sentence with its number, the publication year, the source name, and the exact URL of the page it came from (from the search results — never a URL from memory). Report ONLY facts that actually appeared in the search results.`;

  const res = await generateWithWebSearch(searchPrompt, `research-${topic.primaryKeyword.slice(0, 30)}`, {
    maxTokens: 4096,
    // The post-search round carries the injected search results as prompt
    // context and measurably exceeds the default 120s. Callers on a tight
    // function budget (the Vercel route) pass a smaller value.
    timeout: opts?.roundTimeoutMs ?? 240_000,
  });

  if (!res) return { ...EMPTY_FACT_SHEET };

  // Hard precondition: no actual search happened => the "facts" are from
  // parametric memory with guessed URLs — the exact fabrication mode this
  // module exists to prevent. An empty sheet (qualitative post) is safer.
  if (res.searches === 0) {
    logger.warn('Research returned without performing any web search — discarding unverifiable facts', undefined, CONTEXT);
    return { ...EMPTY_FACT_SHEET };
  }

  // --- Stage B: convert the report to strict JSON (no tools, no invention) --
  const extractPrompt = `Convert this research report into JSON. Use ONLY facts, years, source names, and URLs that appear verbatim in the report — do not add, correct, or complete anything. Drop any fact that lacks a URL in the report.

REPORT:
---
${res.text.slice(0, 8000)}
---

Return ONLY JSON:
{"facts":[{"statement":"one self-contained factual sentence with its number","year":"2025","source_name":"...","source_url":"https://..."}]}`;

  const raw = await safeGenerateJSON(extractPrompt, 'research-extract', 2000);
  if (!raw) return { ...EMPTY_FACT_SHEET };

  const parsed = parseFacts(raw).slice(0, MAX_FACTS);
  const facts = parsed.map((f, i) => ({ ...f, id: `F${i + 1}` }));
  logger.info(`Research produced ${facts.length} facts via ${res.searches} search(es)`, undefined, CONTEXT);
  return { facts, searched: true, searches: res.searches };
}

/**
 * Drop facts whose source URL is dead (HEAD, falling back to GET). Cheap
 * insurance against the model citing a hallucinated or stale URL — a fact
 * without a reachable source is worse than no fact.
 */
export async function verifyFactUrls(sheet: FactSheet, timeoutMs = 6000): Promise<FactSheet> {
  if (sheet.facts.length === 0) return sheet;

  const checks = await Promise.all(
    sheet.facts.map(async fact => {
      // SSRF guard: these URLs come from model output — refuse private hosts,
      // loopback, and non-http(s) schemes before fetching server-side.
      try {
        assertFetchableUrl(fact.sourceUrl);
      } catch {
        return null;
      }
      for (const method of ['HEAD', 'GET'] as const) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          const res = await fetch(fact.sourceUrl, {
            method,
            // Don't follow redirects: the SSRF guard checked only the original
            // host, and a redirect (2xx/3xx) is proof-of-life anyway.
            redirect: 'manual',
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SoftwherBot/1.0)' },
          });
          clearTimeout(timer);
          // Some hosts reject HEAD (405) or bots (403) while the page is fine
          // in a browser; only treat hard not-found signals as dead.
          if (res.status === 404 || res.status === 410) return null;
          if (res.status < 400 || method === 'GET') return fact;
        } catch {
          // network error/timeout on HEAD -> try GET; on GET -> drop
        }
      }
      return null;
    })
  );

  const alive = checks.filter((f): f is Fact => f !== null);
  const dropped = sheet.facts.length - alive.length;
  if (dropped > 0) logger.warn(`Dropped ${dropped} fact(s) with unreachable source URLs`, undefined, CONTEXT);
  // Re-number so the writer sees a contiguous list.
  return { ...sheet, facts: alive.map((f, i) => ({ ...f, id: `F${i + 1}` })) };
}
