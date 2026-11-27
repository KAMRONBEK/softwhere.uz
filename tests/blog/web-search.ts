/**
 * Blog research web search — no paid calls. A local fake Moonshot answers both
 * chat completions and POST /tools/search, so the suite checks the whole loop:
 * Kimi gets a plain `web_search` function tool (not the retired `$web_search`
 * builtin), each call runs one search with `text_query`, the results go back
 * as the tool result, and research keeps only facts whose URL a search returned.
 *
 *   npx tsx tests/blog/web-search.ts
 */
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Suite } from '../estimator/harness';

interface Hit {
  path: string;
  body: Record<string, unknown>;
}

type Reply = (hit: Hit) => { status: number; body: unknown };

function fakeMoonshot(hits: Hit[], reply: Reply) {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      const hit = { path: req.url ?? '', body: JSON.parse(raw || '{}') };
      hits.push(hit);
      const { status, body } = reply(hit);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    });
  });
  return new Promise<{ url: string; close: () => void }>(resolve =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}/v1`, close: () => server.close() });
    })
  );
}

const message = (msg: Record<string, unknown>, finish: string) => ({
  id: 'x',
  object: 'chat.completion',
  created: 0,
  model: 'kimi-k2.6',
  choices: [{ index: 0, message: { role: 'assistant', content: null, ...msg }, finish_reason: finish }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
});
const toolCall = (id: string, args: string) =>
  message({ tool_calls: [{ id, type: 'function', function: { name: 'web_search', arguments: args } }] }, 'tool_calls');
const answer = (text: string) => message({ content: text }, 'stop');

const SEARCH_BODY = {
  search_results: [
    {
      title: 'App costs 2026',
      url: 'https://example.com/costs/',
      site_name: 'Example',
      snippet: 'An app costs $30,000.',
      date: '2026-10-01',
    },
    {
      title: 'Other shape',
      url: 'https://www.other.org/report',
      siteName: 'Other',
      description: 'Uzbekistan IT exports grew.',
      published: '2026',
    },
    { title: 'No url', snippet: 'dropped' },
  ],
};

async function main(): Promise<number> {
  const hits: Hit[] = [];
  let script: Reply = () => ({ status: 500, body: {} });
  const fake = await fakeMoonshot(hits, hit => script(hit));
  const chats = () => hits.filter(h => h.path.endsWith('/chat/completions'));

  // core/ai reads its provider config at import time.
  process.env.MOONSHOT_API_KEY = 'test-kimi';
  process.env.AI_BASE_URL = fake.url;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.AI_MODEL;

  const ai = await import('../../src/core/ai');
  const research = await import('../../src/modules/blog/api/research');
  const s = new Suite('blog-web-search');

  s.group('parseSearchResults');
  const parsed = ai.parseSearchResults(SEARCH_BODY);
  s.eq('keeps results with a URL', parsed.length, 2);
  s.eq('documented shape', parsed[0], {
    title: 'App costs 2026',
    url: 'https://example.com/costs/',
    date: '2026-10-01',
    snippet: 'An app costs $30,000.',
  });
  s.eq('alternate shape', parsed[1], {
    title: 'Other shape',
    url: 'https://www.other.org/report',
    date: '2026',
    snippet: 'Uzbekistan IT exports grew.',
  });
  s.eq(
    'pro chunks become the snippet',
    ai.parseSearchResults({ search_results: [{ url: 'https://a.b/c', chunks: [{ text: 'one' }, { text: 'two' }] }] })[0]?.snippet,
    'one two'
  );
  s.eq('garbage is empty', [ai.parseSearchResults(null), ai.parseSearchResults({ search_results: 'x' })], [[], []]);

  s.group('sourceKey');
  s.eq(
    'ignores scheme, www, slash, query',
    research.sourceKey('http://www.Example.com/costs/?utm=1#x'),
    research.sourceKey('https://example.com/costs')
  );
  s.ok('different paths differ', research.sourceKey('https://example.com/a') !== research.sourceKey('https://example.com/b'));

  s.group('search loop');
  script = hit => {
    if (hit.path.endsWith('/tools/search')) return { status: 200, body: SEARCH_BODY };
    if (chats().length === 1) return { status: 200, body: toolCall('c1', '{"query":"app cost 2026"}') };
    return { status: 200, body: answer('Apps cost $30,000 (Example, 2026, https://example.com/costs/).') };
  };
  const res = await ai.generateWithWebSearch('find facts', 'test');
  const chat = chats();
  const searches = hits.filter(h => h.path.endsWith('/tools/search'));
  s.ok('answers', !!res?.text.includes('$30,000'), JSON.stringify(res));
  s.eq('counts the search', res?.searches, 1);
  s.eq('returns the result URLs', res?.sources, ['https://example.com/costs/', 'https://www.other.org/report']);
  const tools = chat[0]?.body.tools as { type: string; function: { name: string } }[];
  s.eq(
    'declares a function tool, not the retired builtin',
    tools?.map(t => `${t.type}:${t.function.name}`),
    ['function:web_search']
  );
  s.eq('thinking disabled', chat[0]?.body.thinking, { type: 'disabled' });
  s.eq('search body', searches[0]?.body, { text_query: 'app cost 2026', limit: 6, timeout_seconds: 30 });
  const toolMsg = (chat[1]?.body.messages as { role: string; tool_call_id?: string; content: string }[]).find(m => m.role === 'tool');
  s.eq('results go back as the tool result', toolMsg?.tool_call_id, 'c1');
  s.ok('tool result carries the snippet', !!toolMsg?.content.includes('An app costs $30,000.'), toolMsg?.content);

  s.group('a failed search is reported to the model, not fatal');
  hits.length = 0;
  script = hit => {
    if (hit.path.endsWith('/tools/search')) return { status: 502, body: { error: 'down' } };
    if (chats().length === 1) return { status: 200, body: toolCall('c1', '{"query":"x"}') };
    return { status: 200, body: answer('nothing found') };
  };
  const failed = await ai.generateWithWebSearch('find facts', 'test-fail');
  const failMsg = (chats().at(-1)?.body.messages as { role: string; content: string }[]).find(m => m.role === 'tool');
  s.ok('model hears the error', !!failMsg?.content.includes('search failed'), failMsg?.content);
  s.eq('no search counted', failed?.searches, 0);

  s.group('research keeps only facts a search returned');
  hits.length = 0;
  script = hit => {
    if (hit.path.endsWith('/tools/search')) return { status: 200, body: SEARCH_BODY };
    const n = chats().length;
    if (n === 1) return { status: 200, body: toolCall('c1', '{"query":"app cost"}') };
    if (n === 2) return { status: 200, body: answer('report with facts') };
    // Stage B (JSON extraction, no tools): one URL a search returned, one guessed.
    return {
      status: 200,
      body: answer(
        JSON.stringify({
          facts: [
            { statement: 'An app costs $30,000.', year: '2026', source_name: 'Example', source_url: 'https://example.com/costs' },
            { statement: 'Made-up stat 42%.', year: '2026', source_name: 'Guess', source_url: 'https://guessed.example/stat' },
          ],
        })
      ),
    };
  };
  const sheet = await research.buildFactSheet({ title: 'App cost', primaryKeyword: 'app cost', pillarName: 'mobile' });
  s.eq(
    'keeps the returned URL, drops the guessed one',
    sheet.facts.map(f => f.sourceUrl),
    ['https://example.com/costs']
  );
  s.eq('marks it searched', [sheet.searched, sheet.searches], [true, 1]);

  fake.close();
  return s.report();
}

main().then(
  code => process.exit(code),
  error => {
    console.error(error);
    process.exit(1);
  }
);
