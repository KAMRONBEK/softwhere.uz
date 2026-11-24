import type { CSSProperties } from 'react';
import css from './PriceTable.module.css';

export interface PriceRow {
  name: string;
  /** As the copy has it: "3.5–8M UZS (~$300–700)". */
  range: string;
}

/** The copy's own dollar bounds, or null when a string stops following the pattern (no bar then). */
function usdBounds(range: string): [number, number] | null {
  const match = /\$(\d+)\s*[–-]\s*(\d+)/.exec(range);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** "3.5–8M UZS (~$300–700)" → the price, and the dollars for a quieter span. */
export function splitRange(range: string): [string, string] {
  const at = range.indexOf('(');
  return at > 0 ? [range.slice(0, at).trimEnd(), range.slice(at)] : [range, ''];
}

/** Price bands set large; when there are several, each is drawn on one linear scale from zero. */
export function PriceTable({ rows }: { rows: readonly PriceRow[] }) {
  const bounds = rows.map(row => usdBounds(row.range));
  const max = Math.max(0, ...bounds.map(band => band?.[1] ?? 0));
  const hasScale = rows.length > 1 && max > 0 && bounds.every(band => band !== null);

  return (
    <ul className={css.table} data-single={rows.length === 1 ? '' : undefined}>
      {rows.map((row, i) => {
        const [price, dollars] = splitRange(row.range);
        const band = bounds[i];
        return (
          <li key={row.name} className={css.row}>
            <span className={css.name}>{row.name}</span>{' '}
            <span className={css.range}>
              <span className={css.price}>{price}</span> {dollars ? <span className={css.dollars}>{dollars}</span> : null}
            </span>
            {hasScale && band ? (
              <span className={css.scale} aria-hidden='true'>
                <span
                  className={css.band}
                  style={{ '--from': `${(band[0] / max) * 100}%`, '--span': `${((band[1] - band[0]) / max) * 100}%` } as CSSProperties}
                />
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
