'use client';

import { useTranslations } from 'next-intl';
import { WEEKDAY_IDS, type DemoScreen, type WireBlock } from './data';
import css from './wireframe.module.css';

/**
 * Mini app screens drawn from the same block vocabulary the real AI brief
 * returns (header, list, calendar, chat…), rendered with the theme's tokens:
 * accent fills, avatars, a week strip and a time grid, so they read as the
 * product, not as grey boxes. Sizes are container-relative (cqw), so a phone
 * reads the same at 100px or 200px wide. Blocks carry data-block for the
 * reveal timeline.
 */

const FIRST_DATE = 14;
const SELECTED_DAY = 4;
const SELECTED_SLOT = 1;
const TAKEN_SLOTS = new Set([2, 4]);

function items(block: WireBlock): readonly string[] {
  return block.items ?? [];
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function Stars() {
  return (
    <span className={css.stars} aria-hidden='true'>
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

function Block({ block }: { block: WireBlock }) {
  const t = useTranslations('home.ai-demo');
  switch (block.kind) {
    case 'header':
      return (
        <div className={css.wHeader} data-block=''>
          <span className={css.wTitle}>{block.label}</span>
          <span className={css.wIcon} />
        </div>
      );
    case 'bot-header':
      return (
        <div className={css.wBotHeader} data-block=''>
          <span className={css.wAvatar}>{initial(block.label ?? '')}</span>
          <span className={css.wRowText}>
            <b>{block.label}</b>
            <span>{t('wire.bot')}</span>
          </span>
        </div>
      );
    case 'search':
      return (
        <div className={css.wSearch} data-block=''>
          <span className={css.wGlass} />
          <span>{block.label}</span>
        </div>
      );
    case 'filters':
      return (
        <div className={css.wFilters} data-block=''>
          {items(block).map((item, i) => (
            <span key={item} className={i === 0 ? css.wFilterOn : undefined}>
              {item}
            </span>
          ))}
        </div>
      );
    case 'barbers':
      return (
        <div className={css.wList} data-block=''>
          {items(block).map((item, i) => (
            <div key={item} className={i === 0 ? `${css.wRow} ${css.wRowOn}` : css.wRow}>
              <span className={css.wAvatar}>{initial(item)}</span>
              <span className={css.wRowText}>
                <b>{item}</b>
                <Stars />
                <span className={css.wMeta}>{block.meta?.[i]}</span>
              </span>
            </div>
          ))}
        </div>
      );
    case 'week':
      return (
        <div className={css.wWeek} data-block=''>
          {WEEKDAY_IDS.map((day, i) => (
            <span key={day} className={i === SELECTED_DAY ? css.wDayOn : css.wDay}>
              <small>{t(`wire.week.${day}`)}</small>
              {FIRST_DATE + i}
            </span>
          ))}
        </div>
      );
    case 'slots':
      return (
        <div className={css.wSlots} data-block=''>
          {items(block).map((item, i) => (
            <span key={item} className={i === SELECTED_SLOT ? css.wSlotOn : TAKEN_SLOTS.has(i) ? css.wSlotTaken : css.wSlot}>
              {item}
            </span>
          ))}
        </div>
      );
    case 'button':
      return (
        <div className={css.wButton} data-block=''>
          {block.label}
        </div>
      );
    case 'nav-bar':
      return (
        <div className={css.wNav} data-block=''>
          {items(block).map((item, i) => (
            <span key={item} className={i === 0 ? css.wNavOn : css.wNavItem}>
              <i />
              {item}
            </span>
          ))}
        </div>
      );
    case 'tabs':
      return (
        <div className={css.wTabs} data-block=''>
          {items(block).map((item, i) => (
            <span key={item} className={i === 0 ? css.wTabOn : undefined}>
              {item}
            </span>
          ))}
        </div>
      );
    case 'card-grid':
      return (
        <div className={css.wGrid} data-block=''>
          {items(block).map(item => (
            <span key={item} className={css.wTile}>
              <i className={css.wImage} />
              <span className={css.wTileRow}>
                {item}
                <b className={css.wAdd}>+</b>
              </span>
            </span>
          ))}
        </div>
      );
    case 'chat':
      return (
        <div className={css.wChat} data-block=''>
          {items(block).map((item, i) => (
            <span key={item} className={(i % 2 === 0) !== Boolean(block.startsOut) ? css.wIn : css.wOut}>
              {item}
            </span>
          ))}
        </div>
      );
    case 'keyboard':
      return (
        <div className={css.wKeyboard} data-block=''>
          {items(block).map(item => (
            <span key={item}>{item}</span>
          ))}
        </div>
      );
    case 'cart':
      return (
        <div className={css.wList} data-block=''>
          {items(block).map(item => (
            <div key={item} className={css.wRow}>
              <span className={css.wThumb} />
              <span className={css.wRowText}>
                <b>{item}</b>
              </span>
              <span className={css.wStepper}>
                <i>−</i>1<i>+</i>
              </span>
            </div>
          ))}
        </div>
      );
    case 'pay':
      return (
        <div className={css.wPay} data-block=''>
          {items(block).map((item, i) => (
            <span key={item} className={i === 0 ? css.wPayOn : css.wPayItem}>
              <i />
              {item}
            </span>
          ))}
        </div>
      );
    case 'form':
      return (
        <div className={css.wForm} data-block=''>
          {items(block).map(item => (
            <span key={item} className={css.wField}>
              {item}
            </span>
          ))}
        </div>
      );
    case 'profile':
      return (
        <div className={css.wProfile} data-block=''>
          <span className={`${css.wAvatar} ${css.wAvatarLg}`}>{initial(block.label ?? '')}</span>
          <span className={css.wRowText}>
            <b>{block.label}</b>
            {items(block).map(line => (
              <span key={line}>{line}</span>
            ))}
          </span>
        </div>
      );
    case 'upload':
      return (
        <div className={css.wUpload} data-block=''>
          <i />
          {block.label}
        </div>
      );
    case 'files':
      return (
        <div className={css.wList} data-block=''>
          {items(block).map(item => (
            <div key={item} className={css.wRow}>
              <span className={css.wDoc} />
              <span className={css.wRowText}>
                <b>{item}</b>
                <span className={css.wMuted}>PDF</span>
              </span>
              <span className={css.wTick} />
            </div>
          ))}
        </div>
      );
    case 'note':
      return (
        <div className={css.wNote} data-block=''>
          <i />
          {block.label}
        </div>
      );
    case 'system':
      return (
        <div className={css.wSystem} data-block=''>
          <i />
          {block.label}
        </div>
      );
  }
}

export default function WirePhone({ screen }: { screen: DemoScreen }) {
  const t = useTranslations('home.ai-demo');
  return (
    <figure className={css.phoneWrap}>
      <div className={css.phone} data-phone='' role='img' aria-label={t('wireframeLabel', { screen: screen.name })}>
        <div className={css.screen} aria-hidden='true'>
          <div className={css.statusBar}>
            <span>9:41</span>
            <span className={css.notch} />
            <span className={css.battery} />
          </div>
          {screen.blocks.map((block, i) => (
            <Block key={`${block.kind}-${i}`} block={block} />
          ))}
        </div>
      </div>
      <figcaption className={css.phoneCaption}>{screen.name}</figcaption>
    </figure>
  );
}
