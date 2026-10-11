import { useTranslations } from 'next-intl';
import { SHEET_COLUMNS, SHEET_ERROR, SHEET_FORMULA } from './data';
import type { Demo, Fill } from './demo';
import css from './sheet.module.css';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface SheetProps {
  demo: Demo;
}

/** A highlighter fill: its own element, so the morph drains a few fills, not the whole grid's style. */
function Highlight({ fill }: { fill: Fill }) {
  return <span className={css.fill} data-fill={fill} data-mess aria-hidden='true' />;
}

/**
 * The "before": a shared spreadsheet the way it really looks after a year.
 * Decorative (the chapter rail tells the story), so it is hidden from
 * assistive tech and described by one label instead. The morph engine drives
 * its rows, flags and fills from the scroll.
 */
export default function Sheet({ demo }: SheetProps) {
  const t = useTranslations('home.crm-build');
  const { rows } = demo;
  /** Blank rows under the data, as far as a tall window shows (the grid clips the rest). */
  const emptyRows = Array.from({ length: 18 }, (_, index) => rows.length + 3 + index);
  return (
    <div className={css.sheet} data-sheet aria-hidden='true'>
      <div className={css.formula}>
        <span className={css.cellRef}>D10</span>
        <span className={css.fx}>fx</span>
        <span className={css.formulaText}>{SHEET_FORMULA}</span>
      </div>

      <div className={css.grid}>
        <div className={`${css.row} ${css.letters}`}>
          <span className={css.num} />
          {LETTERS.map((letter, col) => (
            <span key={letter} className={css.cell} data-col={col}>
              {letter}
            </span>
          ))}
        </div>

        <div className={`${css.row} ${css.head}`}>
          <span className={css.num}>1</span>
          {SHEET_COLUMNS.map((column, col) => (
            <span key={column} className={css.cell} data-col={col}>
              {t(`sheet.columns.${column}`)}
            </span>
          ))}
        </div>

        {rows.map((row, index) => (
          <div
            key={`${row.deal}-${index}`}
            className={css.row}
            data-line
            data-row={row.deal}
            data-dup={row.isDuplicate ? '' : undefined}
            data-loud={row.isLoud ? '' : undefined}
          >
            {row.fill && <Highlight fill={row.fill} />}
            <span className={css.num}>{index + 2}</span>
            <span className={css.cell} data-col={0} data-anchor>
              {row.client}
            </span>
            <span className={css.cell} data-col={1}>
              {row.phone}
            </span>
            <span className={css.cell} data-col={2}>
              {row.item}
            </span>
            <span className={css.cell} data-col={3} data-error={row.amount === SHEET_ERROR ? '' : undefined}>
              {row.amount}
            </span>
            <span className={css.cell} data-col={4}>
              {row.statusFill && <Highlight fill={row.statusFill} />}
              <span className={css.cellText}>{row.status}</span>
            </span>
            <span className={css.cell} data-col={5}>
              {row.manager}
            </span>
            {row.isDuplicate && (
              <span className={`${css.flag} ${css.flagRow}`} data-flag>
                {t('sheet.flags.duplicate')}
              </span>
            )}
          </div>
        ))}

        <div className={`${css.row} ${css.totalRow}`} data-line>
          <span className={css.num}>{rows.length + 2}</span>
          <span className={css.cell} data-col={0}>
            {t('sheet.total')}
          </span>
          <span className={css.cell} data-col={1} />
          <span className={css.cell} data-col={2} />
          <span className={css.cell} data-col={3} data-error=''>
            {SHEET_ERROR}
            <span className={`${css.flag} ${css.flagCell}`} data-flag>
              {t('sheet.flags.formula')}
            </span>
          </span>
          <span className={css.cell} data-col={4} />
          <span className={css.cell} data-col={5} />
        </div>

        {emptyRows.map(number => (
          <div key={number} className={css.row} data-line>
            <span className={css.num}>{number}</span>
            {LETTERS.map((letter, col) => (
              <span key={letter} className={css.cell} data-col={col} />
            ))}
          </div>
        ))}
      </div>

      <div className={css.tabs}>
        {demo.tabs.map((tab, index) => (
          <span key={tab} className={css.tab} data-current={index === 2 ? '' : undefined}>
            {tab}
          </span>
        ))}
        <span className={`${css.flag} ${css.flagTabs}`} data-flag>
          {t('sheet.flags.tabs')}
        </span>
      </div>
    </div>
  );
}
