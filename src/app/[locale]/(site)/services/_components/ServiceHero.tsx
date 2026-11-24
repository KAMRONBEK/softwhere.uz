import type { ReactNode } from 'react';
import { Container } from '@/shared/components/site';
import { HalftoneGlyph, type GlyphName } from './HalftoneGlyph';
import css from './ServiceHero.module.css';

interface ServiceHeroProps {
  title: string;
  lead: string;
  glyph: GlyphName;
  breadcrumb?: ReactNode;
  actions: ReactNode;
}

/** The homepage's opening, at rest: the words low on the left, a figure in dots on the right. */
export function ServiceHero({ title, lead, glyph, breadcrumb, actions }: ServiceHeroProps) {
  return (
    <header className={css.hero} data-ink={glyph === 'mark' ? 'logo' : undefined}>
      <Container className={css.inner}>
        {breadcrumb}
        <div className={css.body}>
          <div className={css.copy}>
            <h1 className={css.title}>{title}</h1>
            <p className={css.lead}>{lead}</p>
            <div className={css.actions}>{actions}</div>
          </div>
          <HalftoneGlyph name={glyph} className={css.figure} />
        </div>
      </Container>
    </header>
  );
}
