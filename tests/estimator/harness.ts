/**
 * Zero-dependency test harness for the estimator suites.
 *
 * The repo has no test runner (only the `playwright` library), so this is a
 * deliberately tiny one: grouped checks, readable console output, a JSON
 * artifact per run, and a non-zero exit code when anything fails.
 *
 *   const s = new Suite('estimator/logic');
 *   s.group('formula');
 *   s.ok('cost.min <= cost.max', e.cost.min <= e.cost.max, `${e.cost.min} > ${e.cost.max}`);
 *   process.exit(s.report());
 */
import * as fs from 'fs';
import * as path from 'path';

export type CheckResult = {
  group: string;
  name: string;
  ok: boolean;
  /** Only populated on failure — what actually happened. */
  detail?: string;
  skipped?: boolean;
};

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  red: (s: string) => (COLOR ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s: string) => (COLOR ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (COLOR ? `\x1b[33m${s}\x1b[0m` : s),
  dim: (s: string) => (COLOR ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s: string) => (COLOR ? `\x1b[1m${s}\x1b[0m` : s),
};

export const RESULTS_DIR = path.join(process.cwd(), 'test-results');

export class Suite {
  readonly name: string;
  readonly results: CheckResult[] = [];
  private current = '';
  private printedGroup = '';
  private readonly startedAt = Date.now();
  /** Extra context attached to the JSON artifact (screenshots, console logs…). */
  readonly artifacts: Record<string, unknown> = {};

  constructor(name: string) {
    this.name = name;
    // eslint-disable-next-line no-console
    console.log(c.bold(`\n▶ ${name}\n`));
  }

  group(name: string): void {
    this.current = name;
  }

  private emit(r: CheckResult): void {
    this.results.push(r);
    if (this.printedGroup !== r.group) {
      this.printedGroup = r.group;
      // eslint-disable-next-line no-console
      console.log(c.bold(`  ${r.group}`));
    }
    const mark = r.skipped ? c.yellow('○') : r.ok ? c.green('✓') : c.red('✗');
    // eslint-disable-next-line no-console
    console.log(`    ${mark} ${r.ok || r.skipped ? c.dim(r.name) : r.name}`);
    if (!r.ok && !r.skipped && r.detail) {
      // eslint-disable-next-line no-console
      console.log(c.red(`        ${r.detail.split('\n').join('\n        ')}`));
    }
  }

  ok(name: string, condition: boolean, detail?: string): boolean {
    this.emit({ group: this.current, name, ok: condition, detail: condition ? undefined : detail });
    return condition;
  }

  eq<T>(name: string, actual: T, expected: T, extra = ''): boolean {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    return this.ok(name, a === e, `expected ${e}, got ${a}${extra ? `\n${extra}` : ''}`);
  }

  skip(name: string, why: string): void {
    this.emit({ group: this.current, name: `${name} — ${c.yellow(`skipped: ${why}`)}`, ok: true, skipped: true });
  }

  /** Run a check body, converting a throw into a failure instead of killing the run. */
  async guard(name: string, body: () => unknown | Promise<unknown>): Promise<void> {
    try {
      await body();
    } catch (error) {
      this.ok(name, false, error instanceof Error ? `${error.message}\n${error.stack?.split('\n')[1] ?? ''}` : String(error));
    }
  }

  get failures(): CheckResult[] {
    return this.results.filter(r => !r.ok);
  }

  /** Prints the summary, writes the JSON artifact, returns the process exit code. */
  report(): number {
    const failed = this.failures;
    const skipped = this.results.filter(r => r.skipped).length;
    const passed = this.results.length - failed.length - skipped;
    const seconds = ((Date.now() - this.startedAt) / 1000).toFixed(1);

    // eslint-disable-next-line no-console
    console.log('');
    if (failed.length) {
      // eslint-disable-next-line no-console
      console.log(c.bold(c.red(`  ${failed.length} FAILED`)));
      for (const f of failed) {
        // eslint-disable-next-line no-console
        console.log(c.red(`    ✗ [${f.group}] ${f.name}`));
        if (f.detail) console.log(c.dim(`        ${f.detail.split('\n')[0]}`));
      }
      // eslint-disable-next-line no-console
      console.log('');
    }
    // eslint-disable-next-line no-console
    console.log(
      `  ${c.green(`${passed} passed`)}${failed.length ? `, ${c.red(`${failed.length} failed`)}` : ''}${
        skipped ? `, ${c.yellow(`${skipped} skipped`)}` : ''
      } ${c.dim(`(${seconds}s)`)}\n`
    );

    try {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(RESULTS_DIR, `${this.name.replace(/[^a-z0-9]+/gi, '-')}.json`),
        JSON.stringify(
          { suite: this.name, passed, failed: failed.length, skipped, seconds, results: this.results, ...this.artifacts },
          null,
          2
        )
      );
    } catch {
      /* artifact writing is best-effort */
    }

    return failed.length ? 1 : 0;
  }
}

/** `$1,234` — the exact shape the UI renders for USD, for readable failure messages. */
export function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function range(r: { min: number; max: number }): string {
  return `${usd(r.min)} – ${usd(r.max)}`;
}
