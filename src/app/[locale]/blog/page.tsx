'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { AdminSectionTitle, AdminDescription, AdminLoading } from '@/components/AdminComponents/index';

interface BlogPostSummary {
  title: string;
  slug: string;
  createdAt: string;
  locale: string;
}

export default function BlogPage({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const t = useTranslations('blog');
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPosts() {
      try {
        setLoading(true);
        // Only fetch posts in the current language
        const url = `/api/blog/posts?locale=${locale}`;

        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Error fetching posts: ${res.status}`);
        }

        const data = await res.json();

        setPosts(data.posts || []);
      } catch (err) {
        console.error('Error loading posts:', err);
        setError(err instanceof Error ? err.message : 'Failed to load blog posts');
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, [locale]);

  if (loading) {
    return <AdminLoading message='Loading posts...' />;
  }

  if (error) {
    return (
      <div className='page-layout' style={{ backgroundColor: 'var(--gray-100)' }}>
        <div className='container py-20'>
          <div className='text-center py-12'>
            <div className='text-red-500 mb-4 text-xl font-semibold'>Error: {error}</div>
            <p className='text-gray-600'>Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='page-layout' style={{ backgroundColor: 'var(--gray-100)' }}>
      <div className='container py-20'>
        <header className='mb-16 text-center'>
          <AdminSectionTitle className='text-center'>{t('title')}</AdminSectionTitle>
          <AdminDescription className='text-center max-w-2xl mx-auto'>
            Discover insights about mobile app development, web development, and Telegram bots
          </AdminDescription>
        </header>

        {posts.length === 0 ? (
          <div className='text-center py-16'>
            <p className='text-xl text-gray-500'>{t('noPostsAvailable')}</p>
          </div>
        ) : (
          <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-8'>
            {posts.map(post => (
              <div
                key={post.slug}
                className='bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl hover:-translate-y-2 transition-all duration-300 border border-gray-100'
              >
                <div className='p-6'>
                  <h2 className='text-xl font-bold text-gray-900 mb-3 line-clamp-2 leading-tight'>
                    <Link href={`/${locale}/blog/${post.slug}`} className='hover:text-[#fe4502] transition-colors duration-300'>
                      {post.title}
                    </Link>
                  </h2>
                  <div className='text-sm text-gray-500 mb-4 font-medium'>{format(new Date(post.createdAt), 'MMMM dd, yyyy')}</div>
                  <div className='mt-6'>
                    <Link
                      href={`/${locale}/blog/${post.slug}`}
                      className='inline-flex items-center text-[#fe4502] hover:text-[#ff5f24] font-semibold text-sm transition-colors duration-300'
                    >
                      {t('readMore')}
                      <svg className='w-4 h-4 ml-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 5l7 7-7 7'></path>
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
