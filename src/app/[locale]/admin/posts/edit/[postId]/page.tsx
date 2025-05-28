'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/Button';

interface PostData {
  _id: string;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published';
  locale: 'en' | 'ru' | 'uz';
  createdAt: string;
  updatedAt: string;
}

export default function EditPostPage({
  params,
}: {
  params: { locale: string; postId: string };
}) {
  const router = useRouter();
  const { locale, postId } = params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<PostData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [postLocale, setPostLocale] = useState<'en' | 'ru' | 'uz'>('ru');

  // Fetch post data
  useEffect(() => {
    async function loadPost() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/posts/${postId}`);

        if (!res.ok) {
          const errorData = await res.json();

          throw new Error(errorData.error || `HTTP error ${res.status}`);
        }

        const data = await res.json();

        setPost(data.post);

        // Populate form fields
        setTitle(data.post.title);
        setSlug(data.post.slug);
        setContent(data.post.content);
        setStatus(data.post.status);
        setPostLocale(data.post.locale);
      } catch (err) {
        console.error('Error loading post:', err);
        setError(err instanceof Error ? err.message : 'Failed to load post');
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [postId]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const updateData = {
        title,
        slug,
        content,
        status,
        locale: postLocale,
      };

      const res = await fetch(`/api/admin/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const errorData = await res.json();

        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }

      setSaveSuccess(true);

      // Auto-redirect after successful save
      setTimeout(() => {
        router.push(`/${locale}/admin/posts`);
      }, 1500);
    } catch (err) {
      console.error('Error saving post:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  // Auto-generate slug from title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;

    setTitle(newTitle);

    // Only auto-generate slug if user hasn't manually edited it
    if (!slug || slug === slugify(title)) {
      setSlug(slugify(newTitle));
    }
  };

  // Simple slugify function
  function slugify(text: string) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^\w\-]+/g, '') // Remove non-word chars
      .replace(/\-\-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+/, '') // Trim hyphens from start
      .replace(/-+$/, ''); // Trim hyphens from end
  }

  if (loading) {
    return (
      <div className='admin-layout'>
        <div className='container mx-auto px-6 py-8'>
          <div className='bg-white rounded-lg border border-gray-200 p-8'>
            <div className='flex items-center justify-center'>
              <svg
                className='animate-spin h-8 w-8 text-gray-400 mr-3'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                ></circle>
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                ></path>
              </svg>
              <span className='text-gray-600 text-lg'>Loading post...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='admin-layout'>
        <div className='container mx-auto px-6 py-8'>
          <div className='bg-white rounded-lg border border-gray-200 p-8 text-center'>
            <svg
              className='mx-auto h-12 w-12 text-red-400 mb-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
              />
            </svg>
            <h3 className='text-lg font-medium text-gray-900 mb-2'>
              Error Loading Post
            </h3>
            <p className='text-red-600 mb-4'>{error}</p>
            <Link
              href={`/${locale}/admin/posts`}
              className='inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200'
            >
              <svg
                className='w-4 h-4 mr-2'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M10 19l-7-7m0 0l7-7m-7 7h18'
                />
              </svg>
              Return to Posts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='admin-layout'>
      <div className='container mx-auto px-6 py-8'>
        {/* Header Section */}
        <div className='mb-8'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900 mb-2'>
                Edit Post
              </h1>
              <p className='text-gray-600'>Make changes to your blog post</p>
              {post && (
                <div className='flex items-center mt-2 text-sm text-gray-500'>
                  <svg
                    className='w-4 h-4 mr-1'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                    />
                  </svg>
                  Last updated: {new Date(post.updatedAt).toLocaleDateString()}
                </div>
              )}
            </div>
            <div className='flex space-x-3'>
              {post && (
                <Link
                  href={`/${locale}/blog/${post.slug}`}
                  target='_blank'
                  className='inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200'
                >
                  <svg
                    className='w-4 h-4 mr-2'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                    />
                  </svg>
                  Preview
                </Link>
              )}
              <Link
                href={`/${locale}/admin/posts`}
                className='inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200'
              >
                <svg
                  className='w-4 h-4 mr-2'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M10 19l-7-7m0 0l7-7m-7 7h18'
                  />
                </svg>
                Back to Posts
              </Link>
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {saveSuccess && (
          <div className='mb-6 p-4 bg-green-50 border border-green-200 rounded-lg'>
            <div className='flex items-center'>
              <svg
                className='w-5 h-5 text-green-400 mr-3'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                  clipRule='evenodd'
                />
              </svg>
              <div>
                <h3 className='text-sm font-medium text-green-800'>
                  Post saved successfully!
                </h3>
                <p className='text-sm text-green-700 mt-1'>
                  Redirecting to posts list...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {saveError && (
          <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-lg'>
            <div className='flex items-center'>
              <svg
                className='w-5 h-5 text-red-400 mr-3'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                  clipRule='evenodd'
                />
              </svg>
              <div>
                <h3 className='text-sm font-medium text-red-800'>
                  Error saving post
                </h3>
                <p className='text-sm text-red-700 mt-1'>{saveError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Form */}
        <div className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
          <div className='px-6 py-4 border-b border-gray-200 bg-gray-50'>
            <h2 className='text-lg font-semibold text-gray-900'>
              Post Details
            </h2>
            <p className='text-sm text-gray-600 mt-1'>
              Update the information below to modify your post
            </p>
          </div>

          <form onSubmit={handleSubmit} className='p-6 space-y-6'>
            {/* Title Field */}
            <div>
              <label
                htmlFor='title'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Title *
              </label>
              <input
                type='text'
                id='title'
                value={title}
                onChange={handleTitleChange}
                className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors duration-200'
                placeholder='Enter post title...'
                required
              />
            </div>

            {/* Slug Field */}
            <div>
              <label
                htmlFor='slug'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                URL Slug *
              </label>
              <div className='relative'>
                <input
                  type='text'
                  id='slug'
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors duration-200'
                  placeholder='url-friendly-slug'
                  required
                />
                <div className='absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none'>
                  <svg
                    className='h-5 w-5 text-gray-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1'
                    />
                  </svg>
                </div>
              </div>
              <p className='text-xs text-gray-500 mt-1'>
                This will be used in the URL for your post
              </p>
            </div>

            {/* Status and Language Row */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div>
                <label
                  htmlFor='status'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Status
                </label>
                <select
                  id='status'
                  value={status}
                  onChange={e =>
                    setStatus(e.target.value as 'draft' | 'published')
                  }
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors duration-200'
                >
                  <option value='draft'>Draft</option>
                  <option value='published'>Published</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor='locale'
                  className='block text-sm font-medium text-gray-700 mb-2'
                >
                  Language *
                </label>
                <select
                  id='locale'
                  value={postLocale}
                  onChange={e =>
                    setPostLocale(e.target.value as 'en' | 'ru' | 'uz')
                  }
                  className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors duration-200'
                >
                  <option value='ru'>🇷🇺 Russian</option>
                  <option value='uz'>🇺🇿 Uzbek</option>
                  <option value='en'>🇬🇧 English</option>
                </select>
              </div>
            </div>

            {/* Content Field */}
            <div>
              <label
                htmlFor='content'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Content (Markdown) *
              </label>
              <textarea
                id='content'
                value={content}
                onChange={e => setContent(e.target.value)}
                className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors duration-200 font-mono text-sm'
                rows={12}
                placeholder='Write your post content in Markdown format...'
                required
              />
              <p className='text-xs text-gray-500 mt-1'>
                You can use Markdown syntax for formatting.
                <a
                  href='https://www.markdownguide.org/basic-syntax/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-orange-600 hover:text-orange-700 ml-1'
                >
                  Learn Markdown syntax
                </a>
              </p>
            </div>

            {/* Form Actions */}
            <div className='flex items-center justify-end pt-6 border-t border-gray-200'>
              <div className='flex space-x-3'>
                <button
                  type='button'
                  onClick={() => router.push(`/${locale}/admin/posts`)}
                  className='px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200'
                >
                  Cancel
                </button>
                <Button
                  type='submit'
                  disabled={saving}
                  className={`px-6 py-3 text-sm font-medium ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {saving ? (
                    <div className='flex items-center'>
                      <svg
                        className='animate-spin -ml-1 mr-2 h-4 w-4 text-white'
                        fill='none'
                        viewBox='0 0 24 24'
                      >
                        <circle
                          className='opacity-25'
                          cx='12'
                          cy='12'
                          r='10'
                          stroke='currentColor'
                          strokeWidth='4'
                        ></circle>
                        <path
                          className='opacity-75'
                          fill='currentColor'
                          d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                        ></path>
                      </svg>
                      Saving...
                    </div>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
