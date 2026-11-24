import Link from 'next/link';
import type { ReactNode } from 'react';
import { Container } from './Page';
import css from './PageHero.module.css';

export interface Crumb {
  label: string;
  /** Omit on the current page (the last crumb). */
  href?: string;
}

interface BreadcrumbsProps {
  items: readonly Crumb[];
  /** The nav's accessible name, in the page's language. */
  label: string;
}

export function Breadcrumbs({ items, label }: BreadcrumbsProps) {
  return (
    <nav aria-label={label} className={css.crumbs}>
      <ol>
        {items.map(item => (
          <li key={item.label}>{item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current='page'>{item.label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

interface PageHeroProps {
  /** The page's h1. */
  title: ReactNode;
  lead?: ReactNode;
  /** A short label above the h1, with the homepage's accent dot. */
  eyebrow?: ReactNode;
  /** <Breadcrumbs>, or any node, above everything. */
  breadcrumb?: ReactNode;
  /** Buttons under the lead. */
  actions?: ReactNode;
  /** A line under the title (date, reading time, "last updated"). */
  meta?: ReactNode;
  /** 'page': poster-size h1, the lead beside it on desktop. 'article': for long titles, stacked. */
  size?: 'page' | 'article';
  width?: 'wide' | 'prose';
}

/** A page's opening: h1 in the look's display face over the page's ground, as the homepage's sections open. */
export function PageHero({ title, lead, eyebrow, breadcrumb, actions, meta, size = 'page', width }: PageHeroProps) {
  const isSplit = size === 'page' && width !== 'prose' && Boolean(lead || actions);
  return (
    <header className={css.hero} data-size={size}>
      <Container width={width}>
        {breadcrumb}
        {eyebrow ? <p className={css.eyebrow}>{eyebrow}</p> : null}
        <div className={css.body} data-split={isSplit ? '' : undefined}>
          <div className={css.titleBlock}>
            <h1 className={css.title}>{title}</h1>
            {meta ? <div className={css.meta}>{meta}</div> : null}
          </div>
          {lead || actions ? (
            <div className={css.aside}>
              {lead ? <p className={css.lead}>{lead}</p> : null}
              {actions ? <div className={css.actions}>{actions}</div> : null}
            </div>
          ) : null}
        </div>
      </Container>
    </header>
  );
}
