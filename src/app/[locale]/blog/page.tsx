'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';

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
    const [showAllLocales, setShowAllLocales] = useState(false);

    useEffect(() => {
        async function fetchPosts() {
            try {
                setLoading(true);
                // Add locale parameter to only fetch posts in the current language
                const url = showAllLocales
                    ? '/api/blog/posts'
                    : `/api/blog/posts?locale=${locale}`;

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
    }, [locale, showAllLocales]);

    if (loading) {
        return (
            <div className="page-layout bg-gray-50">
                <div className="container mx-auto px-4 py-12">
                    <div className="text-center py-10">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                        <p className="mt-4 text-lg">Loading posts...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page-layout bg-gray-50">
                <div className="container mx-auto px-4 py-12">
                    <div className="text-center py-10">
                        <div className="text-red-500 mb-4">Error: {error}</div>
                        <p>Please try again later.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-layout bg-gray-50">
            <div className="container mx-auto px-4 py-12">
                <header className="mb-12">
                    <h1 className="text-4xl font-bold text-center mb-6">{t('title')}</h1>
                    <div className="flex justify-center">
                        <button
                            onClick={() => setShowAllLocales(!showAllLocales)}
                            className={`px-4 py-2 text-sm rounded-md transition-colors ${showAllLocales
                                ? 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                : 'bg-blue-100 hover:bg-blue-200 text-blue-800'
                                }`}
                        >
                            {showAllLocales ? t('showCurrentLocale') : t('showAllLocales')}
                        </button>
                    </div>
                </header>

                {posts.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-lg text-gray-600">{t('noPostsAvailable')}</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {posts.map((post) => (
                            <div key={post.slug} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
                                <div className="p-6">
                                    {showAllLocales && post.locale !== locale && post.locale && (
                                        <div className="text-xs font-medium mb-2 inline-block px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                                            {post.locale.toUpperCase()}
                                        </div>
                                    )}
                                    <h2 className="text-xl font-semibold mb-2 line-clamp-2">
                                        <Link href={`/${post.locale}/blog/${post.slug}`} className="text-gray-900 hover:text-blue-600">
                                            {post.title}
                                        </Link>
                                    </h2>
                                    <div className="text-sm text-gray-500 mt-4">
                                        {format(new Date(post.createdAt), 'MMMM dd, yyyy')}
                                    </div>
                                    <div className="mt-4">
                                        <Link
                                            href={`/${post.locale}/blog/${post.slug}`}
                                            className="inline-flex items-center text-blue-600 hover:text-blue-800"
                                        >
                                            {t('readMore')}
                                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
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