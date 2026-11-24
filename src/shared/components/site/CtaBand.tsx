import type { ReactNode } from 'react';
import css from './CtaBand.module.css';

interface CtaBandProps {
  title: ReactNode;
  body?: ReactNode;
  /** <ButtonLink>s, the primary first. */
  actions: ReactNode;
}

/** The closing call to action: the finale's raised panel, inside a <Section> or <Container>. */
export function CtaBand({ title, body, actions }: CtaBandProps) {
  return (
    <div className={css.band}>
      <div className={css.copy}>
        <h2 className={css.title}>{title}</h2>
        {body ? <p className={css.body}>{body}</p> : null}
      </div>
      <div className={css.actions}>{actions}</div>
    </div>
  );
}
