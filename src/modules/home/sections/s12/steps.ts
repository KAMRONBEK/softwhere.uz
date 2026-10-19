/**
 * 16 · Process: the route's structure (stages, weeks, deliverables) as a
 * plain module, so the server-rendered stand-in (standins/ProcessStandIn.tsx)
 * can list the same stages the live section draws. The words live in
 * src/messages/home/process/<locale>.json; copy.ts binds them on the client.
 */

export type StepId = 'discover' | 'design' | 'build' | 'launch' | 'grow';

/** Deliverable keys (home.process.facts.<key>). */
export type FactKey =
  | 'nda'
  | 'range'
  | 'spec'
  | 'fixedPrice'
  | 'contract'
  | 'deposit'
  | 'dailyUpdate'
  | 'changes'
  | 'accounts'
  | 'ownership'
  | 'bugFixes'
  | 'support';

export interface ProcessStepDef {
  id: StepId;
  /** First and last week on the counter (null = open-ended). */
  weeks: readonly [from: number, to: number | null];
  /** Two or three concrete deliverables, hung on the route as flags. */
  facts: readonly FactKey[];
}

/** The route, in order. The geometry and renderer read only this shape. */
export const PROCESS_STEPS: readonly ProcessStepDef[] = [
  { id: 'discover', weeks: [1, 1], facts: ['nda', 'range'] },
  { id: 'design', weeks: [2, 2], facts: ['spec', 'fixedPrice', 'contract'] },
  { id: 'build', weeks: [3, 8], facts: ['deposit', 'dailyUpdate', 'changes'] },
  { id: 'launch', weeks: [9, 9], facts: ['accounts', 'ownership'] },
  { id: 'grow', weeks: [10, null], facts: ['bugFixes', 'support'] },
];

/** Release tags on the Grow stage's rising line: version numbers, not copy. */
export const VERSION_LABELS: readonly string[] = ['v1.1', 'v1.2', 'v1.3'];
