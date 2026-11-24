'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { CoverImage } from '@/shared/types';
import css from './article.module.css';

/** An article's picture and its credit; nothing when the photo is gone (Unsplash authors delete photos). */
export default function ArticleCover({ cover, alt }: { cover: CoverImage; alt: string }) {
  const [hasFailed, setHasFailed] = useState(false);
  if (hasFailed) return null;
  return (
    <figure className={css.coverFigure}>
      <div className={css.coverFrame}>
        <Image src={cover.url} alt={alt} fill priority sizes='(max-width: 1200px) 100vw, 1080px' onError={() => setHasFailed(true)} />
      </div>
      <figcaption>
        Photo by{' '}
        <a href={`${cover.authorUrl}?utm_source=softwhere&utm_medium=referral`} target='_blank' rel='noopener noreferrer'>
          {cover.authorName}
        </a>
        {' on '}
        <a href='https://unsplash.com?utm_source=softwhere&utm_medium=referral' target='_blank' rel='noopener noreferrer'>
          Unsplash
        </a>
      </figcaption>
    </figure>
  );
}
