import type { CSSProperties } from 'react';
import Image from 'next/image';
import css from './blog.module.css';

interface PostCoverProps {
  /** Unsplash thumbnail; without one the card wears a piece of the brand's halftone. */
  src?: string;
  alt: string;
  /** Moves the halftone's bright spot, so neighbouring cards differ. */
  seed: string;
  sizes: string;
  isPriority?: boolean;
}

function spot(seed: string): { x: number; y: number } {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 9973;
  return { x: 15 + (hash % 71), y: 10 + (Math.floor(hash / 71) % 81) };
}

/** A post card's picture. */
export default function PostCover({ src, alt, seed, sizes, isPriority }: PostCoverProps) {
  if (src) {
    return (
      <div className={css.cover}>
        <Image src={src} alt={alt} fill className={css.coverImage} sizes={sizes} priority={isPriority} />
      </div>
    );
  }
  const { x, y } = spot(seed);
  return (
    <div className={css.cover} aria-hidden='true'>
      <div className={css.halftone} style={{ '--x': `${x}%`, '--y': `${y}%` } as CSSProperties} />
    </div>
  );
}
