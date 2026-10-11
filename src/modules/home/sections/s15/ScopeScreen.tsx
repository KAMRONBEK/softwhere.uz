'use client';

import { memo, type CSSProperties } from 'react';
import { NOTES } from './data';
import { useScopeView } from './context';
import { CheckIcon } from './icons';
import layer from './layers.module.css';
import { useCopy } from './useCopy';
import css from './scope.module.css';

/** Where each note lands on the idea board (em, top-left corner) and its tilt. */
const SCATTER: ReadonlyArray<readonly [x: number, y: number, deg: number]> = [
  [1.3, 8.9, -6],
  [11.4, 8.4, 5],
  [2.1, 18.4, 4],
  [11.9, 18.1, -4],
  [1.5, 28.1, -3],
  [11.2, 27.7, 7],
];

/** List rows: four in version 1, then the "Later" group. */
function rowTop(index: number): number {
  return index < 4 ? 10.3 + index * 3.6 : 27.1 + (index - 4) * 3.6;
}

/**
 * Step 1 · Idea & scope: an idea board of sticky notes. Then each note
 * shrinks into the bullet of a scoped list, its words become the row, and
 * two of them move to "Later": what goes into version one and what waits.
 */
function ScopeScreen() {
  const scope = useScopeView();
  const isList = scope === 'list';
  const copy = useCopy();
  const words = copy.scope;
  return (
    <div className={css.scope} data-view={scope}>
      <div className={`${css.head} ${layer.block}`} style={{ ['--i' as string]: 0 }}>
        <span className={css.kicker}>
          <span className={css.kickerBoard}>{words.board}</span>
          <span className={css.kickerScoped}>{words.scoped}</span>
        </span>
        <strong className={css.title}>{words.title}</strong>
      </div>

      <span className={`${css.group} ${css.groupV1}`}>{words.v1}</span>
      <span className={`${css.group} ${css.groupLater}`}>{words.later}</span>

      <ul className={css.notes} aria-label={isList ? words.scoped : words.board}>
        {NOTES.map((note, index) => {
          const [x, y, deg] = SCATTER[index];
          const style = {
            ['--i' as string]: index + 1,
            ['--x' as string]: `${x}em`,
            ['--y' as string]: `${y}em`,
            ['--deg' as string]: `${deg}deg`,
            ['--row' as string]: `${rowTop(index)}em`,
            ['--tone' as string]: index % 3,
          } as CSSProperties;
          return (
            <li key={note.id} className={css.item} style={style} data-later={note.isLater ? 'true' : undefined}>
              <span className={`${css.noteWrap} ${layer.block}`}>
                <span className={css.note} data-tone={index % 3}>
                  <span className={css.noteText}>{copy.note(note.id)}</span>
                  <CheckIcon className={css.noteCheck} />
                </span>
              </span>
              <span className={css.row}>
                <span className={css.rowText}>{copy.note(note.id)}</span>
                {note.isLater && <span className={css.tag}>{words.laterTag}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <span className={css.signed}>
        <CheckIcon className={css.signedIcon} />
        {words.signed}
      </span>
    </div>
  );
}

export default memo(ScopeScreen);
