import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { CSSProperties } from 'react';
import { industryLabel, locationLabel, toDescriptorLocale } from '../media/labels';
import { tileOf, wallOrder, WALL_PROJECTS } from '../sections/s09/data';
import css from '../components/SectionFallback.module.css';

/** Tiles the stand-in shows: the wall's first rows. */
const STANDIN_TILES = 12;
/** The tile stills' intrinsic height (as WallCard sets it). */
const TILE_HEIGHT = 440;

interface WorkStandInProps {
  locale: Locale;
}

/**
 * 13 · Work wall: the wall's first projects in its own order, each with its
 * still, name and caption (industry · market, the same describer the live
 * tiles use). Descriptions stay in the lightbox.
 */
export default async function WorkStandIn({ locale }: WorkStandInProps) {
  const t = await getTranslations({ locale, namespace: 'home.work-wall' });
  const descriptorLocale = toDescriptorLocale(locale);
  const projects = wallOrder(locale)
    .slice(0, STANDIN_TILES)
    .map(index => WALL_PROJECTS[index]);
  return (
    <ul className={css.standinWork}>
      {projects.map(project => {
        const tile = tileOf(project);
        return (
          <li key={project.slug} style={{ '--aspect': tile.aspect } as CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-cropped ~15 KB WebP, as the live wall (WallCard) */}
            <img
              src={tile.src}
              alt={t('thumbAlt', { name: project.name })}
              width={Math.round(TILE_HEIGHT * tile.aspect)}
              height={TILE_HEIGHT}
              loading='lazy'
              decoding='async'
            />
            <h3>{project.name}</h3>
            <p>
              {industryLabel(project.type, descriptorLocale)} · {locationLabel(project.location, descriptorLocale)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
