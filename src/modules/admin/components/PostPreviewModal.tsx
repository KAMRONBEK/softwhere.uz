'use client';

import { format } from 'date-fns';
import { AdminBadge, AdminButton } from '@/modules/admin/components/index';
import { markdownToHtml } from '@/modules/admin/utils/markdown';
import { BlogPost } from '@/modules/admin/types';

interface PostPreviewModalProps {
  post: BlogPost;
  onClose: () => void;
}

export default function PostPreviewModal({ post: selectedPost, onClose }: PostPreviewModalProps) {
  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
      <div className='bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl'>
        {/* Modal Header */}
        <div className='flex justify-between items-start p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900'>
          <div className='flex-1 min-w-0'>
            <h3 className='text-xl font-bold text-gray-900 dark:text-gray-100 truncate'>{selectedPost.title}</h3>
            <div className='mt-2 flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400'>
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
          <button onClick={onClose} className='ml-4 text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-200 rounded-lg'>
            <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12'></path>
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className='overflow-y-auto max-h-[60vh] bg-white dark:bg-gray-800'>
          {selectedPost.coverImage?.url && (
            <div className='relative w-full h-48 md:h-64 bg-gray-100'>
              <img src={selectedPost.coverImage.url} alt={selectedPost.title} className='w-full h-full object-cover' />
              <span className='absolute bottom-2 right-3 text-[10px] text-white/80 bg-black/40 px-2 py-1 rounded'>
                Photo by {selectedPost.coverImage.authorName}
              </span>
            </div>
          )}
          <article className='prose prose-lg max-w-none p-8'>
            {selectedPost.content ? (
              <div
                className='text-gray-800 leading-relaxed'
                dangerouslySetInnerHTML={{
                  __html: markdownToHtml(selectedPost.content),
                }}
              />
            ) : (
              <p className='text-gray-400 italic'>Content not available in preview.</p>
            )}
          </article>
        </div>

        {/* Modal Footer */}
        <div className='p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center'>
          <div className='text-sm text-gray-500 dark:text-gray-400'>
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
