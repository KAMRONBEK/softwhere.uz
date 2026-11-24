'use client';

import Image from 'next/image';
import { useState, type CSSProperties, type ReactNode } from 'react';
import css from './blog.module.css';

interface PostCoverProps {
  /** Unsplash thumbnail; without one the card wears a piece of the brand's halftone. */
  src?: string;
  alt: string;
  /** Moves the halftone's bright spot, so neighbouring cards differ. */
  seed: string;
  sizes: string;
  isPriority?: boolean;
  /** The photo's credit: goes when the photo does. */
  credit?: ReactNode;
}

function spot(seed: string): { x: number; y: number } {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 9973;
  return { x: 15 + (hash % 71), y: 10 + (Math.floor(hash / 71) % 81) };
}

/** A post card's picture. */
export default function PostCover({ src, alt, seed, sizes, isPriority, credit }: PostCoverProps) {
  // Unsplash authors delete photos: a dead one gets the halftone too.
  const [failedSrc, setFailedSrc] = useState<string>();
  if (src && src !== failedSrc) {
    return (
      <>
        <div className={css.cover}>
          <Image
            src={src}
            alt={alt}
            fill
            className={css.coverImage}
            sizes={sizes}
            priority={isPriority}
            onError={() => setFailedSrc(src)}
          />
        </div>
        {credit}
      </>
    );
  }
  const { x, y } = spot(seed);
  return (
    <div className={css.cover} aria-hidden='true'>
      <div className={css.halftone} style={{ '--x': `${x}%`, '--y': `${y}%` } as CSSProperties} />
    </div>
  );
}
