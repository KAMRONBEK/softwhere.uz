import type { CSSProperties, ReactNode } from 'react';
import type { WireframeBlock } from '@/modules/estimator/ai-brief/types';
import { seedOf } from '../format';
import css from './wireframe.module.css';

/**
 * Lo-fi drawings of the fixed block vocabulary. Every size is in `em`, so a
 * frame scales its whole sketch by setting one font-size. Text is the real
 * label/items from the spec, truncated like a designer's placeholder would be.
 */

export type FrameKind = 'phone' | 'wide' | 'chat';

export interface BlockContext {
  frame: FrameKind;
  /** The first button of a screen is its primary action. */
  isPrimary: boolean;
}

const Bar = ({ w = 60, strong = false }: { w?: number; strong?: boolean }) => (
  <span className={strong ? `${css.bar} ${css.barStrong}` : css.bar} style={{ '--w': `${w}%` } as CSSProperties} />
);

const Txt = ({ children, kind = 'body' }: { children: ReactNode; kind?: 'body' | 'strong' | 'small' | 'title' }) => (
  <span className={`${css.t} ${css[`t_${kind}`]}`}>{children}</span>
);

const Ph = ({ className = '' }: { className?: string }) => <span className={`${css.ph} ${className}`} />;

const Circle = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => <span className={`${css.circle} ${css[`circle_${size}`]}`} />;

/** Section caption above lists, grids and tables. */
const Caption = ({ text }: { text: string }) => (text ? <span className={`${css.t} ${css.t_caption}`}>{text}</span> : null);

function pickItems(block: WireframeBlock, max: number, fallback: number): (string | null)[] {
  const items = block.items.filter(Boolean).slice(0, max);
  return items.length > 0 ? items : Array.from({ length: fallback }, () => null);
}

/** "Classes left: 8" → ['Classes left', '8'] */
function splitPair(text: string): [string, string | null] {
  const at = text.lastIndexOf(':');
  if (at <= 0 || at === text.length - 1) return [text, null];
  return [text.slice(0, at).trim(), text.slice(at + 1).trim()];
}

const ITEM_BAR_WIDTHS = [72, 58, 66, 50, 62, 54];

function itemText(item: string | null, index: number, kind: 'body' | 'strong' | 'small' = 'body') {
  return item ? <Txt kind={kind}>{item}</Txt> : <Bar w={ITEM_BAR_WIDTHS[index % ITEM_BAR_WIDTHS.length]} />;
}

const Icon = {
  search: (
    <svg viewBox='0 0 16 16' className={css.icon} aria-hidden>
      <circle cx='7' cy='7' r='4.5' fill='none' stroke='currentColor' strokeWidth='1.5' />
      <path d='M10.5 10.5L14 14' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
    </svg>
  ),
  chevron: (
    <svg viewBox='0 0 16 16' className={css.iconSm} aria-hidden>
      <path d='M6 3.5L10.5 8L6 12.5' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  ),
  play: (
    <svg viewBox='0 0 24 24' className={css.iconLg} aria-hidden>
      <circle cx='12' cy='12' r='10' fill='none' stroke='currentColor' strokeWidth='1.2' />
      <path d='M10 8.5v7l6-3.5z' fill='currentColor' />
    </svg>
  ),
  upload: (
    <svg viewBox='0 0 24 24' className={css.iconLg} aria-hidden>
      <path
        d='M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M5 19h14'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.4'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  ),
  pin: (
    <svg viewBox='0 0 24 32' className={css.pin} aria-hidden>
      <path d='M12 31s10-11.2 10-18.5A10 10 0 0 0 2 12.5C2 19.8 12 31 12 31z' fill='currentColor' />
      <circle cx='12' cy='12.5' r='3.6' fill='var(--wf-paper)' />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

function Header({ block, ctx }: { block: WireframeBlock; ctx: BlockContext }) {
  if (ctx.frame === 'wide') {
    return (
      <div className={css.headerWide}>
        <span className={css.logo} />
        <Txt kind='strong'>{block.label}</Txt>
        <span className={css.headerSpacer} />
        <Bar w={14} />
        <Circle size='sm' />
      </div>
    );
  }
  return (
    <div className={css.headerPhone}>
      <Txt kind='title'>{block.label}</Txt>
      <span className={css.headerIcons}>
        <Circle size='sm' />
        <Circle size='sm' />
      </span>
    </div>
  );
}

function Tabs({ block }: { block: WireframeBlock }) {
  const items = pickItems(block, 4, 3);
  return (
    <div className={css.tabs}>
      {items.map((item, i) => (
        <span key={i} className={i === 0 ? `${css.tab} ${css.tabActive}` : css.tab}>
          {itemText(item, i, i === 0 ? 'strong' : 'small')}
        </span>
      ))}
    </div>
  );
}

function Search({ block }: { block: WireframeBlock }) {
  return (
    <div className={css.search}>
      {Icon.search}
      <Txt kind='small'>{block.label}</Txt>
    </div>
  );
}

function Filters({ block }: { block: WireframeBlock }) {
  const items = pickItems(block, 4, 3);
  return (
    <div className={css.chips}>
      {items.map((item, i) => (
        <span key={i} className={i === 0 ? `${css.chip} ${css.chipOn}` : css.chip}>
          {item ? <Txt kind='small'>{item}</Txt> : <Bar w={100} />}
        </span>
      ))}
    </div>
  );
}

function Hero({ block }: { block: WireframeBlock }) {
  return (
    <div className={css.hero}>
      <Ph className={css.heroPh} />
      <div className={css.heroCopy}>
        <Txt kind='title'>{block.label}</Txt>
        {block.items[0] ? <Txt kind='small'>{block.items[0]}</Txt> : <Bar w={70} />}
      </div>
    </div>
  );
}

function Text({ block }: { block: WireframeBlock }) {
  const items = block.items.slice(0, 3);
  return (
    <div className={css.text}>
      <Txt kind='strong'>{block.label}</Txt>
      {items.length > 0 ? items.map((item, i) => <Txt key={i}>{item}</Txt>) : [<Bar key='a' w={92} />, <Bar key='b' w={64} />]}
    </div>
  );
}

function Media({ block, isVideo }: { block: WireframeBlock; isVideo: boolean }) {
  return (
    <div className={css.media}>
      <span className={css.mediaBox}>{isVideo ? <span className={css.mediaIcon}>{Icon.play}</span> : <Ph className={css.fill} />}</span>
      <Txt kind='small'>{block.label}</Txt>
    </div>
  );
}

function CardGrid({ block, ctx }: { block: WireframeBlock; ctx: BlockContext }) {
  const items = pickItems(block, ctx.frame === 'wide' ? 6 : 4, 4);
  return (
    <div className={css.stack}>
      <Caption text={block.label} />
      <div className={css.cards}>
        {items.map((item, i) => (
          <span key={i} className={css.card}>
            <Ph className={css.cardPh} />
            {itemText(item, i, 'small')}
          </span>
        ))}
      </div>
    </div>
  );
}

function List({ block }: { block: WireframeBlock }) {
  const items = pickItems(block, 4, 3);
  return (
    <div className={css.stack}>
      <Caption text={block.label} />
      <div className={css.list}>
        {items.map((item, i) => (
          <span key={i} className={css.row}>
            <Circle />
            <span className={css.rowText}>{itemText(item, i)}</span>
            {Icon.chevron}
          </span>
        ))}
      </div>
    </div>
  );
}

function Table({ block }: { block: WireframeBlock }) {
  const cols = pickItems(block, 4, 3);
  return (
    <div className={css.stack}>
      <Caption text={block.label} />
      <div className={css.table} style={{ '--cols': cols.length } as CSSProperties}>
        {cols.map((col, i) => (
          <span key={`h${i}`} className={css.th}>
            {col ? <Txt kind='small'>{col}</Txt> : <Bar w={60} strong />}
          </span>
        ))}
        {[0, 1, 2].map(row =>
          cols.map((_, i) => (
            <span key={`${row}-${i}`} className={css.td}>
              <Bar w={ITEM_BAR_WIDTHS[(row + i) % ITEM_BAR_WIDTHS.length]} />
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function Chart({ block }: { block: WireframeBlock }) {
  const seed = seedOf(block.label);
  const bars = Array.from({ length: 7 }, (_, i) => 28 + ((seed >> (i * 3)) % 64));
  return (
    <div className={css.stack}>
      <Caption text={block.label} />
      <span className={css.chart}>
        {bars.map((h, i) => (
          <span
            key={i}
            className={i === bars.length - 1 ? `${css.chartBar} ${css.chartBarOn}` : css.chartBar}
            style={{ height: `${h}%` }}
          />
        ))}
      </span>
    </div>
  );
}

function Stats({ block }: { block: WireframeBlock }) {
  const items = pickItems(block, 3, 3);
  return (
    <div className={css.stats}>
      {items.map((item, i) => {
        const [label, value] = item ? splitPair(item) : ['', null];
        return (
          <span key={i} className={css.stat}>
            {value ? <Txt kind='title'>{value}</Txt> : <Bar w={46} strong />}
            {label ? <Txt kind='small'>{label}</Txt> : <Bar w={70} />}
          </span>
        );
      })}
    </div>
  );
}

function MapBlock({ block }: { block: WireframeBlock }) {
  return (
    <div className={css.stack}>
      <span className={css.map}>
        <span className={css.route} />
        {Icon.pin}
      </span>
      <Txt kind='small'>{block.label}</Txt>
    </div>
  );
}

function Calendar({ block }: { block: WireframeBlock }) {
  const seed = seedOf(block.label);
  const marked = new Set([seed % 21, (seed >> 5) % 21, (seed >> 9) % 21]);
  return (
    <div className={css.stack}>
      <Caption text={block.label} />
      <span className={css.calendar}>
        {Array.from({ length: 21 }, (_, i) => (
          <span key={i} className={i === seed % 21 ? `${css.day} ${css.dayOn}` : marked.has(i) ? `${css.day} ${css.dayMarked}` : css.day} />
        ))}
      </span>
    </div>
  );
}

function Form({ block }: { block: WireframeBlock }) {
  const fields = pickItems(block, 4, 2);
  return (
    <div className={css.stack}>
      <Caption text={block.label} />
      {fields.map((field, i) => (
        <span key={i} className={css.field}>
          {field ? <Txt kind='small'>{field}</Txt> : <Bar w={34} />}
          <span className={css.input} />
        </span>
      ))}
    </div>
  );
}

function Button({ block, ctx }: { block: WireframeBlock; ctx: BlockContext }) {
  return (
    <span className={ctx.isPrimary ? `${css.button} ${css.buttonPrimary}` : css.button}>
      <Txt kind='strong'>{block.label}</Txt>
    </span>
  );
}

function Chat({ block }: { block: WireframeBlock }) {
  const items = pickItems(block, 4, 2);
  return (
    <div className={css.chat}>
      {items.map((item, i) => (
        <span key={i} className={i % 2 === 0 ? css.bubbleIn : css.bubbleOut}>
          {item ? <Txt kind='small'>{item}</Txt> : <Bar w={80} />}
        </span>
      ))}
    </div>
  );
}

function Profile({ block }: { block: WireframeBlock }) {
  return (
    <div className={css.profile}>
      <Circle size='lg' />
      <span className={css.stackTight}>
        <Txt kind='strong'>{block.label}</Txt>
        {block.items.length > 0 ? (
          block.items.slice(0, 2).map((item, i) => (
            <Txt key={i} kind='small'>
              {item}
            </Txt>
          ))
        ) : (
          <Bar w={60} />
        )}
      </span>
    </div>
  );
}

const TOTAL_WORDS = /^(total|jami|итого|всего|сумма)/i;

function Cart({ block }: { block: WireframeBlock }) {
  const items = pickItems(block, 4, 2);
  return (
    <div className={css.stack}>
      <Caption text={block.label} />
      {items.map((item, i) => {
        const isTotal = !!item && i === items.length - 1 && i > 0 && TOTAL_WORDS.test(item.trim());
        return (
          <span key={i} className={isTotal ? `${css.row} ${css.rowTotal}` : css.row}>
            {!isTotal && <Ph className={css.thumb} />}
            <span className={css.rowText}>{itemText(item, i, isTotal ? 'strong' : 'body')}</span>
            {!isTotal && <span className={css.stepper}>− 1 +</span>}
          </span>
        );
      })}
    </div>
  );
}

function Checkout({ block }: { block: WireframeBlock }) {
  const options = pickItems(block, 3, 2);
  return (
    <div className={css.stack}>
      <Caption text={block.label} />
      {options.map((option, i) => (
        <span key={i} className={css.option}>
          <span className={i === 0 ? `${css.radio} ${css.radioOn}` : css.radio} />
          {itemText(option, i)}
        </span>
      ))}
    </div>
  );
}

function Settings({ block }: { block: WireframeBlock }) {
  const rows = pickItems(block, 4, 3);
  return (
    <div className={css.stack}>
      <Caption text={block.label} />
      {rows.map((row, i) => (
        <span key={i} className={css.row}>
          <span className={css.rowText}>{itemText(row, i)}</span>
          <span className={i % 3 === 2 ? css.toggle : `${css.toggle} ${css.toggleOn}`} />
        </span>
      ))}
    </div>
  );
}

function Upload({ block }: { block: WireframeBlock }) {
  return (
    <span className={css.upload}>
      <span className={css.mediaIcon}>{Icon.upload}</span>
      <Txt kind='small'>{block.label}</Txt>
    </span>
  );
}

/** Phone tab bar / wide-screen sidebar, depending on the frame. */
export function NavBar({ block, frame }: { block: WireframeBlock; frame: FrameKind }) {
  const items = pickItems(block, frame === 'wide' ? 6 : 4, 4);
  if (frame === 'wide') {
    return (
      <span className={css.sidebar}>
        {items.map((item, i) => (
          <span key={i} className={i === 0 ? `${css.sideItem} ${css.sideItemOn}` : css.sideItem}>
            <span className={css.sideIcon} />
            {itemText(item, i, 'small')}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className={frame === 'chat' ? css.keyboard : css.tabbar}>
      {items.map((item, i) => (
        <span key={i} className={i === 0 && frame !== 'chat' ? `${css.tabbarItem} ${css.tabbarOn}` : css.tabbarItem}>
          {frame !== 'chat' && <span className={css.tabbarIcon} />}
          {item ? <Txt kind='small'>{item}</Txt> : <Bar w={70} />}
        </span>
      ))}
    </span>
  );
}

export function SketchBlock({ block, ctx }: { block: WireframeBlock; ctx: BlockContext }) {
  switch (block.kind) {
    case 'header':
      return <Header block={block} ctx={ctx} />;
    case 'nav-bar':
      return <NavBar block={block} frame={ctx.frame} />;
    case 'tabs':
      return <Tabs block={block} />;
    case 'search':
      return <Search block={block} />;
    case 'filters':
      return <Filters block={block} />;
    case 'hero':
      return <Hero block={block} />;
    case 'text':
      return <Text block={block} />;
    case 'image':
      return <Media block={block} isVideo={false} />;
    case 'video':
      return <Media block={block} isVideo />;
    case 'card-grid':
      return <CardGrid block={block} ctx={ctx} />;
    case 'list':
      return <List block={block} />;
    case 'table':
      return <Table block={block} />;
    case 'chart':
      return <Chart block={block} />;
    case 'stats':
      return <Stats block={block} />;
    case 'map':
      return <MapBlock block={block} />;
    case 'calendar':
      return <Calendar block={block} />;
    case 'form':
      return <Form block={block} />;
    case 'button':
      return <Button block={block} ctx={ctx} />;
    case 'chat':
      return <Chat block={block} />;
    case 'profile':
      return <Profile block={block} />;
    case 'cart':
      return <Cart block={block} />;
    case 'checkout':
      return <Checkout block={block} />;
    case 'settings':
      return <Settings block={block} />;
    case 'upload':
      return <Upload block={block} />;
  }
}
