'use client';

import { useTranslations } from 'next-intl';
import type { CSSProperties, RefObject } from 'react';
import { tileOf, WALL_PROJECTS } from './data';
import css from './list.module.css';
import { useWallLabels } from './useWallCopy';

interface ProjectListProps {
  indices: readonly number[];
  listRef: RefObject<HTMLUListElement | null>;
  onOpen: (index: number, media: HTMLElement | null) => void;
}

/**
 * "See all": every project as a calm, justified gallery (rows of equal
 * height, each tile in its own shape). The reduced-motion default, and one
 * tap away for everyone else. Same order and filters as the wall; tiles open
 * the same lightbox.
 */
export default function ProjectList({ indices, listRef, onOpen }: ProjectListProps) {
  const t = useTranslations('home.work-wall');
  const labels = useWallLabels();
  return (
    <ul ref={listRef} className={css.list} aria-label={t('listLabel')}>
      {indices.map(index => {
        const project = WALL_PROJECTS[index];
        const tile = tileOf(project);
        return (
          <li
            key={project.slug}
            className={css.item}
            style={{ '--aspect': tile.aspect } as CSSProperties}
            data-flip-id={`list-${project.slug}`}
          >
            <button
              type='button'
              className={css.tile}
              aria-label={labels.card(project)}
              onClick={event => onOpen(index, event.currentTarget.querySelector<HTMLElement>('[data-media]'))}
            >
              <span className={css.frame}>
                <span className={css.media} data-media=''>
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-cropped ~15 KB WebP, no optimizer round trip */}
                  <img
                    className={css.thumb}
                    src={tile.src}
                    alt=''
                    width={Math.round(440 * tile.aspect)}
                    height={440}
                    loading='lazy'
                    decoding='async'
                    onError={event => event.currentTarget.setAttribute('data-failed', '')}
                  />
                </span>
              </span>
              <span className={css.name}>{project.name}</span>
              <span className={css.meta}>
                {labels.category(project)} · {labels.market(project)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
