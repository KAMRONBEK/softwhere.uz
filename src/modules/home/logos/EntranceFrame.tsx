'use client';

import { useRef } from 'react';
import type { LogoFrameProps } from '.';
import { useLogoEntrance } from './entrance';
import css from './logos.module.css';

/** The logo's <svg> with its entrance (GSAP): `<Logo frame={EntranceFrame} />`. */
export default function EntranceFrame({ logoId, geometry, viewBox, className, title, children }: LogoFrameProps) {
  const ref = useRef<SVGSVGElement>(null);
  useLogoEntrance(ref, geometry.axis);
  const classes = [css.logo, className ?? ''].filter(Boolean).join(' ');
  return (
    <svg ref={ref} viewBox={viewBox} role='img' aria-label={title} className={classes} data-logo={logoId}>
      {children}
    </svg>
  );
}
