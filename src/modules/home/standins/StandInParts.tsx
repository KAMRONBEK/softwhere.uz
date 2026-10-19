import Link from 'next/link';
import css from '../components/SectionFallback.module.css';

/** A term and its one line, as the live section lists them. */
export interface StandInItem {
  id: string;
  term: string;
  text: string;
}

interface TermListProps {
  items: readonly StandInItem[];
  label?: string;
}

/** The section's steps or parts: each term a heading (h3 under the section's h2), its line under it. */
export function TermList({ items, label }: TermListProps) {
  return (
    <ol className={css.standinList} aria-label={label}>
      {items.map(item => (
        <li key={item.id}>
          <h3>{item.term}</h3>
          <p>{item.text}</p>
        </li>
      ))}
    </ol>
  );
}

interface DeliverListProps {
  title: string;
  items: readonly string[];
}

/** "What you get": a plain label (not a heading: three sections share it) and the list. */
export function DeliverList({ title, items }: DeliverListProps) {
  return (
    <>
      <p className={css.extra}>{title}</p>
      <ul className={css.standinList}>
        {items.map(item => (
          <li key={item}>
            <p>{item}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

interface ServiceLinkProps {
  href: string;
  label: string;
}

/** A contextual link from the section to its service page. */
export function ServiceLink({ href, label }: ServiceLinkProps) {
  return (
    <p className={css.extra}>
      <Link href={href}>{label}</Link>
    </p>
  );
}
