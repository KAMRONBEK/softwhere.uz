import type { ReactNode } from 'react';
import css from './Prose.module.css';

/**
 * Long text (an article's markdown, the privacy policy). `proseClass` goes on
 * an element of your own. Element rules carry one class of specificity, so a
 * class on an element inside still wins when it is declared later.
 */
export const proseClass = css.prose;

export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `${css.prose} ${className}` : css.prose}>{children}</div>;
}
