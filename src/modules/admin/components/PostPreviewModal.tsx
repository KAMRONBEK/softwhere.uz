'use client';

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { format } from 'date-fns';
import { AdminBadge, AdminButton } from '@/modules/admin/components/index';
import { markdownToHtml } from '@/modules/admin/utils/markdown';
import { BlogPost } from '@/modules/admin/types';

interface PostPreviewModalProps {
  post: BlogPost;
  onClose: () => void;
}

export default function PostPreviewModal({ post: selectedPost, onClose }: PostPreviewModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus moves into the dialog and back to what opened it; the page behind does not scroll.
  useEffect(() => {
    const opener = document.activeElement;
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      html.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const keepFocusInside = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const stops = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button');
    if (!stops?.length) return;
    const [first, last] = [stops[0], stops[stops.length - 1]];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className='fixed inset-0 bg-[color:color-mix(in_srgb,var(--bg)_78%,transparent)] flex items-center justify-center p-4 z-[100]'>
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        onKeyDown={keepFocusInside}
        className='bg-ember-surface border border-ember-border text-ember-text rounded-[var(--radius)] max-w-5xl w-full max-h-[90vh] overflow-hidden'
      >
        {/* Modal Header */}
        <div className='flex justify-between items-start p-6 border-b border-ember-border'>
          <div className='flex-1 min-w-0'>
            <h3 id={titleId} className='text-xl font-bold text-ember-text truncate'>
              {selectedPost.title}
            </h3>
            <div className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ember-muted'>
              <span className='flex items-center'>
                <svg className='w-4 h-4 mr-1' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'></path>
                </svg>
                {format(new Date(selectedPost.createdAt), 'MMM dd, yyyy')}
              </span>
              <AdminBadge variant='locale' locale={selectedPost.locale as 'en' | 'ru' | 'uz'}>
                {selectedPost.locale.toUpperCase()}
              </AdminBadge>
              <AdminBadge variant='status' status={selectedPost.status}>
                {selectedPost.status}
              </AdminBadge>
            </div>
          </div>
          <button
            ref={closeRef}
            type='button'
            aria-label='Close'
            onClick={onClose}
            className='ml-4 text-ember-muted hover:text-ember-text transition-colors min-w-[44px] min-h-[44px] p-2.5 hover:bg-ember-surface2 rounded-[calc(var(--radius)*0.7)]'
          >
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12'></path>
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className='overflow-y-auto max-h-[60vh] bg-ember-surface'>
          {selectedPost.coverImage?.url && (
            <div className='relative w-full h-48 md:h-64 bg-ember-surface2'>
              <img src={selectedPost.coverImage.url} alt={selectedPost.title} className='w-full h-full object-cover' />
              <span className='absolute bottom-2 right-3 text-xs text-ember-text bg-ember-bg px-2 py-1'>
                Photo by {selectedPost.coverImage.authorName}
              </span>
            </div>
          )}
          <article className='[overflow-wrap:anywhere] p-5 sm:p-8 text-ember-text [&_*]:!text-inherit'>
            {selectedPost.content ? (
              <div
                className='leading-relaxed'
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(selectedPost.content),
                }}
              />
            ) : (
              <p className='text-ember-muted italic'>Content not available in preview.</p>
            )}
          </article>
        </div>

        {/* Modal Footer */}
        <div className='p-6 border-t border-ember-border bg-ember-surface2 flex flex-wrap gap-3 justify-between items-center'>
          <div className='text-sm text-ember-muted min-w-0 break-words'>
            URL: /{selectedPost.locale}/blog/{selectedPost.slug}
          </div>
          <div className='flex space-x-3'>
            <AdminButton onClick={onClose} variant='secondary'>
              Close
            </AdminButton>
            <a href={`/${selectedPost.locale}/blog/${selectedPost.slug}`} target='_blank' rel='noopener noreferrer'>
              <AdminButton variant='primary'>
                <svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                  ></path>
                </svg>
                View Live
              </AdminButton>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
