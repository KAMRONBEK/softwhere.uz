'use client';

import { useTranslations } from 'next-intl';
import { memo, type CSSProperties, type ReactNode } from 'react';
import LabVideo from '../../media/LabVideo';
import {
  LESSON,
  PRODUCT_HOST,
  PRODUCT_LANGUAGES,
  SHOWS_PRODUCT_BRAND,
  SITE_LINK_IDS,
  TUTOR_BADGE,
  LAUNCH_STATUS,
  useProductMedia,
  type CountSpec,
} from './data';
import type { PieceId } from './layout';
import ui from './cards.module.css';
import CodeCard from './CodeCard';
import site from './site.module.css';
import { useVideoGate, type VideoGate } from './videoGate';
import { splitWords } from '../../components/splitWords';

/**
 * The mini website that assembles itself: a rebuild of the Talim AI landing
 * page. Every piece is rendered twice from the same markup: a wireframe copy
 * (CSS turns text into skeleton bars, media into crossed boxes) and the
 * finished copy. The timeline crossfades them, so the wireframe always
 * matches the final layout exactly.
 */

type Mode = 'wire' | 'final';

/** The blueprint's grid at each width (must match site.module.css). */
const GRID_WIDE = { columns: 12, gutter: 14 } as const;
const GRID_NARROW = { columns: 4, gutter: 9 } as const;

/** The product's own name when SHOWS_PRODUCT_BRAND is on, else the visitor's ("Your School"). */
function useSiteBrand(): { brand: string; url: string } {
  const t = useTranslations('home.assembly.site');
  const media = useProductMedia();
  return SHOWS_PRODUCT_BRAND ? { brand: media.name, url: PRODUCT_HOST } : { brand: t('brand'), url: t('url') };
}

/** Grid pieces in DOM order; `isWideOnly` ones only exist from 720px. */
const PIECES: ReadonlyArray<{ id: Exclude<PieceId, 'code'>; tag: string; isWideOnly?: boolean }> = [
  { id: 'nav', tag: 'nav · 12 col' },
  { id: 'badge', tag: 'badge' },
  { id: 'head', tag: 'h1 · display' },
  { id: 'sub', tag: 'body · 15', isWideOnly: true },
  { id: 'cta1', tag: 'button' },
  { id: 'cta2', tag: 'button' },
  { id: 'lesson', tag: 'card · lesson' },
  { id: 'video', tag: 'video · 16:9' },
  { id: 'tutor', tag: 'card · ai chat' },
];

export function formatCount(value: number, format?: CountSpec['format']): string {
  if (format !== 'time') return String(value);
  const seconds = Math.max(0, Math.round(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function Count({ spec, mode }: { spec: CountSpec; mode: Mode }) {
  const text = formatCount(spec.value, spec.format);
  if (mode === 'wire') return <span>{text}</span>;
  return (
    <span data-count={spec.value} data-format={spec.format}>
      {text}
    </span>
  );
}

// ── Icons (inline, currentColor) ─────────────────────────────────────────

function BookMark() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
      <path d='M4 7.5c2.6-.9 5.2-.6 8 1v10c-2.8-1.6-5.4-1.9-8-1z' fill='currentColor' opacity='0.92' />
      <path d='M20 7.5c-2.6-.9-5.2-.6-8 1v10c2.8-1.6 5.4-1.9 8-1z' fill='currentColor' opacity='0.62' />
      <circle cx='12' cy='4.2' r='1.6' fill='currentColor' />
    </svg>
  );
}

function RowIcon({ id }: { id: string }) {
  if (id === 'podcast') {
    return (
      <svg viewBox='0 0 16 16' aria-hidden='true'>
        <rect x='5.5' y='2' width='5' height='8' rx='2.5' fill='none' stroke='currentColor' strokeWidth='1.4' />
        <path d='M3.5 8a4.5 4.5 0 0 0 9 0M8 12.5V14' fill='none' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' />
      </svg>
    );
  }
  if (id === 'quiz') {
    return (
      <svg viewBox='0 0 16 16' aria-hidden='true'>
        <circle cx='8' cy='8' r='6' fill='none' stroke='currentColor' strokeWidth='1.4' />
        <path
          d='M6.4 6.3a1.7 1.7 0 1 1 2.4 1.5c-.5.3-.8.6-.8 1.2'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.4'
          strokeLinecap='round'
        />
        <circle cx='8' cy='11.2' r='0.8' fill='currentColor' />
      </svg>
    );
  }
  return (
    <svg viewBox='0 0 16 16' aria-hidden='true'>
      <path d='M3 4.5h10M3 8h10M3 11.5h6' fill='none' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' />
    </svg>
  );
}

function Arrow() {
  return (
    <svg className={ui.arrow} viewBox='0 0 12 12' aria-hidden='true'>
      <path
        d='M2 6h8M6.5 2.5 10 6l-3.5 3.5'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox='0 0 12 12' aria-hidden='true'>
      <rect x='2' y='5.2' width='8' height='5.8' rx='1.4' fill='currentColor' />
      <path d='M4 5.4V4a2 2 0 0 1 4 0v1.4' fill='none' stroke='currentColor' strokeWidth='1.4' />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg viewBox='0 0 14 14' aria-hidden='true'>
      <circle cx='7' cy='7' r='6.3' fill='currentColor' opacity='0.18' />
      <path
        d='M4 7.2 6.1 9.2 10 5'
        pathLength='1'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.7'
        strokeLinecap='round'
        strokeLinejoin='round'
        data-tick=''
      />
    </svg>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

function Nav() {
  const t = useTranslations('home.assembly.site');
  const { brand } = useSiteBrand();
  return (
    <div className={`${ui.card} ${ui.nav}`}>
      <span className={ui.brand}>
        <span className={ui.brandMark} data-icon=''>
          <BookMark />
        </span>
        <span data-t=''>{brand}</span>
      </span>
      <span className={ui.links}>
        {SITE_LINK_IDS.map(id => (
          <span key={id} data-t=''>
            {t(`links.${id}`)}
          </span>
        ))}
      </span>
      <span className={`${ui.btn} ${ui.btnPrimary} ${ui.btnSmall}`}>
        <span data-t=''>{t('navCta')}</span>
      </span>
    </div>
  );
}

function Badge() {
  const t = useTranslations('home.assembly.site');
  return (
    <div className={`${ui.flat} ${ui.badgeRow}`}>
      <span className={ui.badge}>
        <i className={ui.badgeDot} data-icon='' />
        <span data-t=''>{PRODUCT_LANGUAGES ? t('badgeLanguages', { languages: PRODUCT_LANGUAGES }) : t('badge')}</span>
      </span>
    </div>
  );
}

function Headline() {
  const t = useTranslations('home.assembly.site');
  // Each word rises out of its own mask; the last one takes the accent.
  const words = splitWords(t('headline'));
  const last = words.length - 1;
  return (
    <div className={`${ui.flat} ${ui.head}`}>
      <p className={ui.headline}>
        {words.map((word, index) => (
          <span key={index}>
            <span className={ui.wordMask}>
              <span className={`${ui.word} ${index === last ? ui.wordAccent : ''}`} data-t='' data-word=''>
                {word}
              </span>
            </span>{' '}
          </span>
        ))}
      </p>
    </div>
  );
}

function Lesson({ mode }: { mode: Mode }) {
  const t = useTranslations('home.assembly.site.lesson');
  return (
    <div className={`${ui.card} ${ui.lesson}`}>
      <div className={ui.lessonHead}>
        <span className={ui.docIcon} data-icon=''>
          <RowIcon id='summary' />
        </span>
        <span className={ui.lessonTitle}>
          <b data-t=''>{t('title')}</b>
          <span className={ui.lessonMeta}>
            <span data-t=''>
              {t.rich('meta', {
                kind: LESSON.kind,
                pages: LESSON.pages.value,
                minutes: LESSON.minutes.value,
                pageCount: () => <Count spec={LESSON.pages} mode={mode} />,
                minuteCount: () => <Count spec={LESSON.minutes} mode={mode} />,
              })}
            </span>
          </span>
        </span>
        <span className={ui.status}>
          <span className={ui.statusPending} data-status='pending'>
            <span data-t=''>{t('pending')}</span>
          </span>
          {mode === 'final' ? (
            <span className={ui.statusReady} data-status='ready'>
              <i />
              {t('ready')}
            </span>
          ) : null}
        </span>
      </div>
      <ul className={ui.rows}>
        {LESSON.rows.map(row => (
          <li key={row.id} className={ui.row} data-row={row.id}>
            <span className={ui.rowIcon} data-icon=''>
              <RowIcon id={row.id} />
            </span>
            <span data-t=''>
              {'count' in row
                ? t.rich(`rows.${row.id}`, {
                    time: formatCount(row.count.value, 'format' in row.count ? row.count.format : undefined),
                    questions: row.count.value,
                    count: () => <Count spec={row.count} mode={mode} />,
                  })
                : t(`rows.${row.id}`)}
            </span>
          </li>
        ))}
      </ul>
      <div className={ui.mastery}>
        <span className={ui.masteryHead}>
          <span data-t=''>{t('mastery')}</span>
          <span data-t=''>
            <Count spec={LESSON.mastery} mode={mode} />%
          </span>
        </span>
        <span className={ui.track}>
          <span className={ui.fill} data-bar='' style={{ '--v': LESSON.mastery.value / 100 } as CSSProperties} />
        </span>
      </div>
    </div>
  );
}

/** The final copy's walkthrough: the only component that re-renders when the gate opens. */
function GatedVideo({ gate }: { gate: VideoGate }) {
  const isOpen = useVideoGate(gate);
  const media = useProductMedia();
  return <LabVideo project={media} shouldPlay={isOpen} className={ui.videoEl} />;
}

function Video({ mode, gate }: { mode: Mode; gate: VideoGate | null }) {
  const t = useTranslations('home.assembly.site');
  return (
    <div className={ui.card} data-media=''>
      {mode === 'final' && gate ? <GatedVideo gate={gate} /> : <span className={ui.xbox} />}
      <span className={ui.videoChip}>
        <span className={ui.play} data-icon='' />
        <span data-t=''>{t('video')}</span>
      </span>
    </div>
  );
}

function Tutor({ mode }: { mode: Mode }) {
  const t = useTranslations('home.assembly.site.tutor');
  const answer = t('answer');
  return (
    <div className={`${ui.card} ${ui.tutor}`}>
      <span className={ui.tutorHead}>
        <span className={ui.aiDot} data-icon='' />
        <span data-t=''>{t('name')}</span>
        <span className={ui.rag}>
          <span data-t=''>{TUTOR_BADGE}</span>
        </span>
      </span>
      <p className={ui.bubbleUser}>
        <span data-t=''>{t('question')}</span>
      </p>
      <p className={ui.bubbleAi} data-answer=''>
        <span className={ui.typing} data-typing=''>
          <i />
          <i />
          <i />
        </span>
        {mode === 'final' ? (
          <span>
            <span data-typed=''>{answer}</span>
            <span className={ui.caret} data-caret='' />
            <span className={ui.rest} data-rest='' />
          </span>
        ) : (
          <span data-t=''>{answer}</span>
        )}
      </p>
      <span className={ui.source} data-source=''>
        <span data-t=''>{t('source')}</span>
      </span>
    </div>
  );
}

interface PieceContentProps {
  id: Exclude<PieceId, 'code'>;
  mode: Mode;
  /** Final copy only: opens when the walkthrough may play. */
  gate: VideoGate | null;
}

function PieceContent({ id, mode, gate }: PieceContentProps): ReactNode {
  const t = useTranslations('home.assembly.site');
  switch (id) {
    case 'nav':
      return <Nav />;
    case 'badge':
      return <Badge />;
    case 'head':
      return <Headline />;
    case 'sub':
      return (
        <div className={`${ui.flat} ${ui.sub}`}>
          <p>
            <span data-t=''>{t('sub')}</span>
          </p>
        </div>
      );
    case 'cta1':
      return (
        <span className={`${ui.btn} ${ui.btnPrimary}`}>
          <span data-t=''>{t('ctaPrimary')}</span>
          <Arrow />
        </span>
      );
    case 'cta2':
      return (
        <span className={`${ui.btn} ${ui.btnGhost}`}>
          <span data-t=''>{t('ctaSecondary')}</span>
        </span>
      );
    case 'lesson':
      return <Lesson mode={mode} />;
    case 'video':
      return <Video mode={mode} gate={gate} />;
    case 'tutor':
      return <Tutor mode={mode} />;
    default:
      return null;
  }
}

interface MiniSiteProps {
  /** Opens when the walkthrough may play (launch stage, not low tier). */
  videoGate: VideoGate;
}

function MiniSite({ videoGate }: MiniSiteProps) {
  const t = useTranslations('home.assembly.site');
  const { url } = useSiteBrand();
  return (
    <div className={site.page} data-page=''>
      <div className={site.frame} data-frame=''>
        <div className={site.frameBar}>
          <span className={site.dots}>
            <i />
            <i />
            <i />
          </span>
          <span className={site.url}>
            <LockIcon />
            <span className={site.urlText}>
              <span data-url-typed=''>{url}</span>
              <span className={site.urlCaret} data-url-caret='' />
              <span className={ui.rest} data-url-rest='' />
            </span>
          </span>
          <span className={site.ok} data-ok=''>
            <TickIcon />
            {LAUNCH_STATUS}
          </span>
          <span className={site.load} data-load='' />
        </div>
      </div>
      <div className={site.surface} data-surface='' />
      <div className={site.blueprint} data-blueprint=''>
        {Array.from({ length: 12 }, (_, index) => (
          <i key={index} />
        ))}
        <span className={site.blueprintLabel}>
          <span className={site.onlyWide}>{t('blueprint', GRID_WIDE)}</span>
          <span className={site.onlyNarrow}>{t('blueprint', GRID_NARROW)}</span>
        </span>
      </div>
      <div className={site.slotGrid}>
        {PIECES.map(piece => (
          <div key={piece.id} className={`${site.slot} ${piece.isWideOnly ? site.onlyWide : ''}`} style={{ gridArea: piece.id }}>
            {/* Fill and posts are siblings: an opacity on the parent would flatten the 3D posts. */}
            <i className={site.slotFill} data-shadow={piece.id} />
            <i className={site.post} data-post={piece.id} data-side='l' />
            <i className={site.post} data-post={piece.id} data-side='r' />
          </div>
        ))}
      </div>
      <div className={site.sweep} data-sweep='' aria-hidden='true'>
        <i data-sweep-band='' />
      </div>
      <div className={site.grid}>
        {PIECES.map(piece => (
          <div
            key={piece.id}
            className={`${site.piece} ${piece.isWideOnly ? site.onlyWide : ''}`}
            data-piece={piece.id}
            style={{ gridArea: piece.id }}
          >
            <div className={`${site.copy} ${site.wireCopy}`} data-copy='wire'>
              <span className={site.wireTag}>{piece.tag}</span>
              <PieceContent id={piece.id} mode='wire' gate={null} />
            </div>
            <div className={`${site.copy} ${site.finalCopy}`} data-copy='final'>
              <PieceContent id={piece.id} mode='final' gate={videoGate} />
            </div>
          </div>
        ))}
      </div>
      <div className={`${site.piece} ${site.codePiece}`} data-piece='code'>
        <div className={`${site.copy} ${site.wireCopy}`} data-copy='wire'>
          <span className={site.wireTag}>api · server</span>
          <CodeCard mode='wire' />
        </div>
        <div className={`${site.copy} ${site.finalCopy}`} data-copy='final'>
          <CodeCard mode='final' />
        </div>
      </div>
    </div>
  );
}

export default memo(MiniSite);
