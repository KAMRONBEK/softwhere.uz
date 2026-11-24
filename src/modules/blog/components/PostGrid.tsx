import type { ReactNode } from 'react';
import css from './blog.module.css';

/** The list that holds <PostCard>s. */
export default function PostGrid({ children }: { children: ReactNode }) {
  return <ul className={css.grid}>{children}</ul>;
}
