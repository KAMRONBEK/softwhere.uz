'use client';

import { memo, type CSSProperties } from 'react';
import { AGE_RATING, STORE_NAMES } from './data';
import { useDemoEnv, useInstall } from './context';
import { BagIcon, CheckIcon, ChevronLeftIcon, StarIcon } from './icons';
import layer from './layers.module.css';
import MiniApp from './MiniApp';
import { useCopy } from './useCopy';
import css from './store.module.css';

function at(index: number): CSSProperties {
  return { ['--i' as string]: index };
}

const STARS = [0, 1, 2, 3, 4];

/**
 * Step 6 · Store release: the app's own store page, in a neutral store (no
 * store's branding). "Get" installs it (the autopilot taps it once). The
 * reviews hold an empty, dashed slot with hollow stars, plainly labelled as
 * the review your first customers will write: no made-up quote or rating.
 */
function StoreScreen() {
  const { install, isGetGhost } = useInstall();
  const { dispatch, isStatic } = useDemoEnv();
  const { app, store, cursor } = useCopy();
  const meta = [
    { id: 'status', label: store.meta.status, value: store.statusValue },
    { id: 'age', label: store.meta.age, value: AGE_RATING },
    { id: 'category', label: store.meta.category, value: store.categoryValue },
  ];
  const onGet = () => {
    if (install === 'get') dispatch({ type: 'INSTALL', install: isStatic ? 'open' : 'loading', isUser: true });
  };
  const label = install === 'open' ? store.open : install === 'loading' ? store.installing : store.get;

  return (
    <div className={css.store}>
      <div className={`${css.top} ${layer.block}`} style={at(0)}>
        <span className={css.back}>
          <ChevronLeftIcon className={css.backIcon} />
          {store.back}
        </span>
        <span className={css.stores}>
          {STORE_NAMES.map(name => (
            <span key={name} className={css.storeChip}>
              <CheckIcon className={css.storeCheck} />
              {name}
            </span>
          ))}
        </span>
      </div>

      <div className={`${css.app} ${layer.block}`} style={at(1)}>
        <span className={css.appIcon}>
          <BagIcon className={css.appGlyph} />
        </span>
        <span className={css.appText}>
          <strong>{app.name}</strong>
          <span>{app.category}</span>
        </span>
        <button
          type='button'
          className={css.get}
          data-state={install}
          onClick={onGet}
          aria-label={install === 'get' ? store.installLabel : label}
          aria-live='polite'
          data-cursor={install === 'get' ? cursor.get : undefined}
          data-cursor-icon='none'
        >
          {install === 'loading' ? (
            <svg className={css.getRing} viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
              <circle className={css.getTrack} cx='12' cy='12' r='9' pathLength='100' />
              <circle className={css.getFill} cx='12' cy='12' r='9' pathLength='100' />
            </svg>
          ) : (
            label
          )}
          {isGetGhost && <span className={css.touch} aria-hidden='true' />}
        </button>
      </div>

      <dl className={`${css.meta} ${layer.block}`} style={at(2)}>
        {meta.map(item => (
          <div key={item.id} className={css.metaCell}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className={`${css.shots} ${layer.block}`} style={at(3)} aria-hidden='true'>
        <span className={css.shot}>
          <MiniApp theme='light' />
        </span>
        <span className={css.shot}>
          <MiniApp theme='dark' view='track' />
        </span>
        <span className={css.shot}>
          <MiniApp theme='dark' />
        </span>
      </div>

      <div className={`${css.news} ${layer.block}`} style={at(4)}>
        <strong>{store.whatsNew}</strong>
        <span>{store.version}</span>
      </div>

      <div className={`${css.reviews} ${layer.block}`} style={at(5)}>
        <strong className={css.reviewsTitle}>{store.reviews}</strong>
        <div className={css.review}>
          <span className={css.stars} aria-hidden='true'>
            {STARS.map(i => (
              <StarIcon key={i} className={css.star} />
            ))}
          </span>
          <strong className={css.slotTitle}>{store.reviewSlot}</strong>
          <span className={css.slotText}>{store.reviewSlotText}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(StoreScreen);
