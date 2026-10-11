/**
 * AI brief — client-side logic, no network, no browser.
 *
 *   npx tsx tests/ai-brief/client.ts
 *
 * Covers the streamed wire format (NDJSON encode/decode, split chunks,
 * multi-byte characters, junk lines), the page's brief reducer (milestones,
 * late lines after a reset, failures, restore) and the progress steps, plus
 * the small display helpers the page uses for prices and the contact prefill.
 */
import { createBriefEventDecoder, encodeBriefEvent, type BriefStreamEvent } from '../../src/modules/estimator/ai-brief/stream';
import type { AiBrief, BriefPreview, WireframeScreen } from '../../src/modules/estimator/ai-brief/types';
import {
  briefReducer,
  INITIAL_BRIEF_STATE,
  stepStates,
  type BriefAction,
  type BriefRunState,
} from '../../src/modules/estimator/components/brief/briefState';
import { prefillIdea, priceRange, usdFormatter } from '../../src/modules/estimator/components/brief/format';
import { Suite } from '../estimator/harness';

const s = new Suite('ai-brief-client');
const enc = new TextEncoder();

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const screen: WireframeScreen = {
  name: 'Book a class',
  purpose: 'Member books a class',
  device: 'phone',
  phase: 'mvp',
  blocks: [
    { kind: 'header', label: 'Classes', items: [] },
    { kind: 'button', label: 'Book', items: [] },
  ],
};

const brief = {
  version: 1,
  locale: 'en',
  model: 'kimi-k3',
  models: { scope: 'kimi-k3', narrative: 'kimi-k3', screens: 'kimi-k3' },
  title: 'Yoga Studio App',
  summary: 'Members book classes.',
  audience: [],
  roles: [],
  features: [],
  integrations: [],
  stack: [],
  complexityFlags: [],
  screens: [screen],
  estimate: {
    basis: 'en_dual_rate',
    confidence: 'medium',
    mvp: { price: { currency: 'USD', min: 4200, max: 19500, basis: 'en_dual_rate' }, weeks: { min: 8, max: 9 } },
    phases: [],
  },
  narrative: { buildFirst: { what: 'x', why: 'y' }, canWait: [], risks: [], questions: [], assumptions: [] },
  policy: { status: 'ok', topics: [], note: '' },
} as unknown as AiBrief;

const { narrative: _n, screens: _s, model: _m, models: _ms, version: _v, ...previewFields } = brief;
const preview: BriefPreview = previewFields;

function run(actions: BriefAction[], from: BriefRunState = INITIAL_BRIEF_STATE): BriefRunState {
  return actions.reduce(briefReducer, from);
}

const event = (e: BriefStreamEvent, at: number): BriefAction => ({ type: 'event', event: e, at });

/* ------------------------------------------------------------------ */
/* 1. Wire format                                                      */
/* ------------------------------------------------------------------ */

s.group('stream — NDJSON encode/decode');
{
  const events: BriefStreamEvent[] = [
    { type: 'accepted' },
    { type: 'progress', progress: { stage: 'scoped', preview } },
    { type: 'progress', progress: { stage: 'screens', screens: [screen] } },
    { type: 'progress', progress: { stage: 'narrative' } },
    { type: 'result', data: { status: 'ok', brief } },
  ];
  const wire = events.map(encodeBriefEvent).join('');
  s.ok('one line per event', wire.split('\n').filter(Boolean).length === events.length);

  const whole = createBriefEventDecoder();
  s.eq('decodes a whole body', [...whole.push(enc.encode(wire)), ...whole.end()], events);

  // Feed it byte by byte: every line is torn somewhere.
  const bytes = enc.encode(wire);
  const torn = createBriefEventDecoder();
  const got: BriefStreamEvent[] = [];
  for (const b of bytes) got.push(...torn.push(Uint8Array.of(b)));
  got.push(...torn.end());
  s.eq('decodes a body split into single bytes', got, events);

  const cyr = createBriefEventDecoder();
  const cyrWire = enc.encode(
    encodeBriefEvent({ type: 'result', data: { status: 'declined_policy', topics: [], note: 'Микрозаймы — нет' } })
  );
  const half = Math.floor(cyrWire.length / 2) + 1; // lands inside a 2-byte Cyrillic character
  const cyrEvents = [...cyr.push(cyrWire.slice(0, half)), ...cyr.push(cyrWire.slice(half)), ...cyr.end()];
  s.eq('multi-byte characters survive a split', cyrEvents, [
    { type: 'result', data: { status: 'declined_policy', topics: [], note: 'Микрозаймы — нет' } },
  ]);

  const junk = createBriefEventDecoder();
  const junkEvents = [
    ...junk.push(enc.encode('{"type":"accepted"}\nnot json\n{"type":"mystery"}\n\n{"type":"error","code":"timeout"}')),
    ...junk.end(),
  ];
  s.eq('junk and unknown lines are skipped; a last line without newline is kept', junkEvents, [
    { type: 'accepted' },
    { type: 'error', code: 'timeout' },
  ]);
}

/* ------------------------------------------------------------------ */
/* 2. Reducer                                                          */
/* ------------------------------------------------------------------ */

s.group('reducer — a streamed brief');
{
  const started = run([{ type: 'start', idea: 'Yoga app', at: 1000 }]);
  s.eq('start → running, idea kept', [started.status, started.idea, started.startedAt], ['running', 'Yoga app', 1000]);

  const scoped = run(
    [event({ type: 'accepted' }, 1100), event({ type: 'progress', progress: { stage: 'scoped', preview } }, 21000)],
    started
  );
  s.eq('scoped → preview with arrival time', [scoped.preview?.title, scoped.previewAt, scoped.accepted], [brief.title, 21000, true]);

  const withScreens = briefReducer(scoped, event({ type: 'progress', progress: { stage: 'screens', screens: [screen] } }, 40000));
  s.eq('screens arrive before the narrative', [withScreens.screens?.length, withScreens.hasNarrative], [1, false]);

  const done = run(
    [event({ type: 'progress', progress: { stage: 'narrative' } }, 45000), event({ type: 'result', data: { status: 'ok', brief } }, 45100)],
    withScreens
  );
  s.eq(
    'result → done with the full brief and duration',
    [done.status, done.brief?.title, done.elapsedMs, done.restored],
    ['done', brief.title, 44100, false]
  );

  const late = briefReducer(INITIAL_BRIEF_STATE, event({ type: 'progress', progress: { stage: 'scoped', preview } }, 5000));
  s.eq('a late line after a reset is ignored', late, INITIAL_BRIEF_STATE);

  const afterDone = briefReducer(done, { type: 'fail', failure: { code: 'network' }, at: 50000 });
  s.eq('a failure after the result does not overwrite it', afterDone.status, 'done');
}

s.group('reducer — outcomes and failures');
{
  const start: BriefAction = { type: 'start', idea: 'x', at: 0 };
  const rejected = run([start, event({ type: 'result', data: { status: 'rejected', reason: 'too_vague' } }, 5000)]);
  s.eq('rejected keeps the reason', [rejected.status, rejected.rejection], ['rejected', 'too_vague']);

  const declined = run([
    start,
    event({ type: 'result', data: { status: 'declined_policy', topics: ['interest_lending'], note: 'n' } }, 8000),
  ]);
  s.eq('declined keeps topics and note', [declined.status, declined.declined], ['declined', { topics: ['interest_lending'], note: 'n' }]);

  const errored = run([start, event({ type: 'error', code: 'timeout' }, 110000)]);
  s.eq('a stream error line → failed', [errored.status, errored.failure], ['error', { code: 'failed' }]);

  const limited = run([start, { type: 'fail', failure: { code: 'rate_limited', retryAfterSec: 420 }, at: 10 }]);
  s.eq('rate limit keeps retry-after', limited.failure, { code: 'rate_limited', retryAfterSec: 420 });

  const plain = run([start, { type: 'outcome', outcome: { status: 'ok', brief }, at: 30000 }]);
  s.eq(
    'a plain JSON outcome fills preview and screens too',
    [plain.status, plain.preview?.title, plain.screens?.length],
    ['done', brief.title, 1]
  );

  const restored = run([{ type: 'restore', idea: 'saved idea', brief, elapsedMs: 41000 }]);
  s.eq('restore → done, flagged so nothing re-animates', [restored.status, restored.restored, restored.idea], ['done', true, 'saved idea']);

  const restarted = briefReducer(restored, { type: 'start', idea: 'new', at: 1 });
  s.eq('a new start clears the previous brief', [restarted.brief, restarted.preview, restarted.restored], [null, null, false]);
}

/* ------------------------------------------------------------------ */
/* 3. Progress steps                                                   */
/* ------------------------------------------------------------------ */

s.group('progress steps');
{
  const started = run([{ type: 'start', idea: 'x', at: 0 }, event({ type: 'accepted' }, 50)]);
  s.eq('reading holds for a beat', stepStates(started, 500), {
    read: 'active',
    scope: 'pending',
    price: 'pending',
    screens: 'pending',
    plan: 'pending',
  });
  s.eq('then mapping is active', stepStates(started, 2000), {
    read: 'done',
    scope: 'active',
    price: 'pending',
    screens: 'pending',
    plan: 'pending',
  });

  const scoped = briefReducer(started, event({ type: 'progress', progress: { stage: 'scoped', preview } }, 20000));
  s.eq('the price step lights while the number counts up', stepStates(scoped, 20300).price, 'active');
  s.eq('then screens and plan run in parallel', stepStates(scoped, 21000), {
    read: 'done',
    scope: 'done',
    price: 'done',
    screens: 'active',
    plan: 'active',
  });

  const noScreens = run([event({ type: 'result', data: { status: 'ok', brief: { ...brief, screens: [] } } }, 40000)], scoped);
  s.eq('a brief without wireframes marks the step skipped', stepStates(noScreens, 41000).screens, 'skipped');
}

/* ------------------------------------------------------------------ */
/* 4. Display helpers                                                  */
/* ------------------------------------------------------------------ */

s.group('display helpers');
{
  s.eq('en range', priceRange({ min: 4200, max: 19500 }, usdFormatter('en')), '$4,200 – $19,500');
  // ru-RU groups with a narrow no-break space and puts the sign after the number.
  s.ok('uz/ru range groups thousands', /^4\s200\s\$ – 19\s500\s\$$/u.test(priceRange({ min: 4200, max: 19500 }, usdFormatter('uz'))));
  s.eq('prefill tidies whitespace', prefillIdea('  A  bot\t for \n  cakes  '), 'A bot for\ncakes');
  const long = prefillIdea('x'.repeat(2000));
  s.ok('prefill caps a long idea with an ellipsis', long.length === 1201 && long.endsWith('…'), String(long.length));
}

process.exit(s.report());
