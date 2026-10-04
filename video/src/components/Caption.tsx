import { Fragment } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { enter, pad2 } from '../animation';
import { FONTS } from '../fonts';
import { COLORS, SAFE, STAGE_HEIGHT, TIMING } from '../theme';

export type Side = 'left' | 'right';

type Props = {
  index: number;
  total: number;
  title: string;
  body?: string;
  side: Side;
  width: number;
  gutter: number;
};

const TITLE_DELAY = 10;
/** Largest first; a step down is used only when a title would otherwise run past MAX_TITLE_LINES. */
const TITLE_SIZES = [66, 58, 50] as const;
const MAX_TITLE_LINES = 3;
/** Average Sora Bold glyph width in em — calibrated so a 470px column holds ~12 characters at 66px. */
const TITLE_CHAR_EM = 0.6;

/** Greedy word-wrap estimate of how many lines `words` take in `width` px at `fontSize`. */
const estimateLines = (words: string[], width: number, fontSize: number): number => {
  const maxChars = Math.max(1, Math.floor(width / (fontSize * TITLE_CHAR_EM)));
  return words.reduce(
    ({ lines, used }, word) => {
      if (used === 0) return { lines, used: word.length };
      const needed = used + 1 + word.length;
      return needed <= maxChars ? { lines, used: needed } : { lines: lines + 1, used: word.length };
    },
    { lines: 1, used: 0 }
  ).lines;
};

const titleFontSize = (words: string[], width: number): number =>
  TITLE_SIZES.find(size => estimateLines(words, width, size) <= MAX_TITLE_LINES) ?? TITLE_SIZES[TITLE_SIZES.length - 1];

/** Keeps "real-time" / "in-app" on one line instead of breaking after the hyphen. */
const withUnbrokenHyphens = (text: string) =>
  text.split(' ').map((word, i, all) => (
    <Fragment key={`${word}-${i}`}>
      {word.includes('-') ? <span style={{ whiteSpace: 'nowrap' }}>{word}</span> : word}
      {i < all.length - 1 ? ' ' : null}
    </Fragment>
  ));

/** Scene caption: step counter, word-by-word title, then body. Vertically centred in the stage. */
export const Caption = ({ index, total, title, body, side, width, gutter }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = title.split(' ');
  const kickerIn = enter(frame, fps, 4);
  const bodyIn = enter(frame, fps, TITLE_DELAY + words.length * TIMING.wordStagger + 4);
  const align = side === 'left' ? 'flex-start' : 'flex-end';

  return (
    <div
      style={{
        position: 'absolute',
        top: SAFE.top,
        height: STAGE_HEIGHT,
        width,
        [side]: gutter,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: align,
        textAlign: side,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: kickerIn, transform: `translateY(${(1 - kickerIn) * 16}px)` }}>
        <div style={{ width: 44, height: 4, borderRadius: 2, background: COLORS.accent }} />
        <span style={{ fontFamily: FONTS.mono, fontSize: 22, letterSpacing: '0.16em', color: COLORS.accent2 }}>
          {pad2(index + 1)} / {pad2(total)}
        </span>
      </div>
      <h2
        style={{
          margin: '28px 0 0',
          fontFamily: FONTS.display,
          fontWeight: 700,
          fontSize: titleFontSize(words, width),
          lineHeight: 1.08,
          letterSpacing: '-0.025em',
          color: COLORS.text,
        }}
      >
        {words.map((word, i) => {
          const progress = enter(frame, fps, TITLE_DELAY + i * TIMING.wordStagger);
          return (
            <Fragment key={`${word}-${i}`}>
              <span style={{ display: 'inline-block', opacity: progress, transform: `translateY(${(1 - progress) * 36}px)` }}>{word}</span>
              {i < words.length - 1 ? ' ' : null}
            </Fragment>
          );
        })}
      </h2>
      {body ? (
        <p
          style={{
            margin: '26px 0 0',
            maxWidth: width - 20,
            fontFamily: FONTS.body,
            fontWeight: 500,
            fontSize: 29,
            lineHeight: 1.45,
            color: COLORS.muted,
            opacity: bodyIn,
            transform: `translateY(${(1 - bodyIn) * 20}px)`,
          }}
        >
          {withUnbrokenHyphens(body)}
        </p>
      ) : null}
    </div>
  );
};

/** Alternate caption sides scene by scene for rhythm. */
export const captionSide = (index: number): Side => (index % 2 === 0 ? 'left' : 'right');
