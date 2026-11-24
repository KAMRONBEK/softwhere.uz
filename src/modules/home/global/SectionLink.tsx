'use client';

import { useLocale } from 'next-intl';
import Link from 'next/link';
import { createContext, useContext, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import type { SectionId } from '../types';

/**
 * Where the header is: 'home' jumps to the page's own sections, 'site' (every
 * other page, site/SiteShell.tsx) links to them on the homepage.
 */
export type HeaderMode = 'home' | 'site';

export const HeaderModeContext = createContext<HeaderMode>('home');

export function useHeaderMode(): HeaderMode {
  return useContext(HeaderModeContext);
}

interface SectionLinkProps {
  target: SectionId;
  /** On the homepage: jump there. On other pages: the link was followed (close the open layer). */
  onJump: (id: SectionId) => void;
  className?: string;
  style?: CSSProperties;
  'aria-current'?: 'true';
  'data-magnetic'?: '';
  children: ReactNode;
}

/** A link to a homepage section: an in-page jump there, a real `/{locale}#id` link everywhere else. */
export function SectionLink({ target, onJump, children, ...rest }: SectionLinkProps) {
  const locale = useLocale();
  const isSite = useHeaderMode() === 'site';
  if (isSite) {
    return (
      <Link href={`/${locale}#${target}`} {...rest} onClick={() => onJump(target)}>
        {children}
      </Link>
    );
  }
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onJump(target);
  };
  return (
    <a href={`#${target}`} {...rest} onClick={onClick}>
      {children}
    </a>
  );
}
