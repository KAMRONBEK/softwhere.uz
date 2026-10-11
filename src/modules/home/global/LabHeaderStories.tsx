'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useRef, type CSSProperties, type MouseEvent } from 'react';
import type { SectionId } from '../types';
import { BUILD_STORIES } from './LabHeader.copy';
import { useDismiss, useSectionProgress, type DismissReason } from './LabHeader.hooks';
import css from './LabHeaderStories.module.css';

/** One menu per page (the header's); a fixed id keeps server and client markup identical. */
const POPOVER_ID = 'lab-build-stories';

interface StoryListProps {
  /** 'list' in the desktop dropdown (with a line per story), 'grid' in the phone sheet. */
  variant: 'list' | 'grid';
  currentSection: SectionId | null;
  /** Updates the reading-progress bars while true (the list is on screen). */
  isLive: boolean;
  onJump: (id: SectionId) => void;
  /** Index of the first story for the sheet's staggered entrance. */
  staggerFrom?: number;
}

/**
 * The five "how we build" stories as jump links, each with how far the
 * visitor has read it: the bar fills as its scroll story plays.
 */
export function StoryList({ variant, currentSection, isLive, onJump, staggerFrom = 0 }: StoryListProps) {
  const t = useTranslations('home.header.stories');
  const listRef = useRef<HTMLUListElement>(null);
  useSectionProgress(listRef, isLive);

  const jump = (target: SectionId) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onJump(target);
  };

  return (
    <ul ref={listRef} className={variant === 'list' ? css.list : css.grid}>
      {BUILD_STORIES.map((story, index) => (
        <li key={story} style={{ '--i': staggerFrom + index } as CSSProperties}>
          <a href={`#${story}`} className={css.story} aria-current={currentSection === story ? 'true' : undefined} onClick={jump(story)}>
            <span className={css.index} aria-hidden='true'>
              {index + 1}
            </span>
            <span className={css.text}>
              <span className={css.label}>{t(`${story}.label`)}</span>
              {variant === 'list' && <span className={css.note}>{t(`${story}.note`)}</span>}
              <span className={css.track} aria-hidden='true'>
                <span className={css.fill} data-progress-for={story} />
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

interface BuildMenuProps {
  isOpen: boolean;
  isCurrent: boolean;
  currentSection: SectionId | null;
  onOpenChange: (isOpen: boolean) => void;
  onJump: (id: SectionId) => void;
}

/**
 * Desktop nav's first item: "How we build" opens the five stories (an owner
 * who only needs a website skips straight to it) instead of jumping to the
 * first one. Underlined while the visitor is anywhere in the chapter.
 */
export function BuildMenu({ isOpen, isCurrent, currentSection, onOpenChange, onJump }: BuildMenuProps) {
  const t = useTranslations('home.header.build');
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const dismiss = useCallback(
    (reason: DismissReason) => {
      onOpenChange(false);
      if (reason === 'escape') triggerRef.current?.focus({ preventScroll: true });
    },
    [onOpenChange]
  );
  useDismiss(wrapRef, isOpen, dismiss);

  return (
    <div ref={wrapRef} className={css.menu}>
      <button
        ref={triggerRef}
        type='button'
        className={css.trigger}
        aria-expanded={isOpen}
        aria-controls={POPOVER_ID}
        data-current={isCurrent ? 'true' : undefined}
        onClick={() => onOpenChange(!isOpen)}
      >
        {t('label')}
        <svg className={css.chevron} viewBox='0 0 10 6' aria-hidden='true'>
          <path d='M1 1l4 4 4-4' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      </button>
      {isOpen && (
        <div id={POPOVER_ID} className={css.popover} data-lenis-prevent=''>
          <p className={css.title}>{t('title')}</p>
          <StoryList variant='list' currentSection={currentSection} isLive onJump={onJump} />
        </div>
      )}
    </div>
  );
}
