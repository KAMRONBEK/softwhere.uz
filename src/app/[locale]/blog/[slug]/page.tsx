'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { useTranslations } from 'next-intl';

interface BlogPost {
    _id: string;
    title: string;
    slug: string;
    content: string;
    status: 'draft' | 'published';
    locale: 'en' | 'ru' | 'uz';
    createdAt: string;
    updatedAt: string;
}

export default function BlogPostPage({ params }: { params: { locale: string; slug: string } }) {
    const { locale, slug } = params;
    const t = useTranslations('blog');
    const [post, setPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isWrongLocale, setIsWrongLocale] = useState(false);

    useEffect(() => {
        async function fetchPost() {
            try {
                setLoading(true);
                // Include locale as a query parameter
                const res = await fetch(`/api/blog/posts/${slug}?locale=${locale}`);

                if (!res.ok) {
                    if (res.status === 404) {
                        throw new Error('Post not found');
                    }
                    throw new Error(`Error fetching post: ${res.status}`);
                }

                const data = await res.json();
                setPost(data.post);

                // Check if the post's locale matches the URL locale
                if (data.post && data.post.locale !== locale) {
                    setIsWrongLocale(true);
                }
            } catch (err) {
                console.error('Error loading post:', err);
                setError(err instanceof Error ? err.message : 'Failed to load blog post');
            } finally {
                setLoading(false);
            }
        }

        fetchPost();
    }, [slug, locale]);

    // Process content to fix Python code blocks with # comments
    useEffect(() => {
        if (post && post.content) {
            // We don't need to modify the content here after our component changes
            // This is just a placeholder in case we need to preprocess the content
        }
    }, [post]);

    if (loading) {
        return (
            <div className="page-layout bg-gray-50">
                <div className="container mx-auto px-4 py-12">
                    <div className="text-center py-10">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                        <p className="mt-4 text-lg">Loading post...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="page-layout bg-gray-50">
                <div className="container mx-auto px-4 py-12">
                    <div className="text-center py-10">
                        <div className="text-red-500 mb-4">Error: {error || 'Post not found'}</div>
                        <Link href={`/${locale}/blog`} className="text-blue-600 hover:underline">
                            {t('backToBlog')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Get localized language name
    const getLocalizedLanguage = (postLocale: string) => {
        switch (postLocale) {
            case 'ru': return t('russian');
            case 'uz': return t('uzbek');
            case 'en': return t('english');
            default: return postLocale;
        }
    };

    // Format the date
    const formattedDate = format(new Date(post.createdAt), 'MMMM dd, yyyy');

    return (
        <div className="page-layout bg-gray-50 py-12">
            <div className="container mx-auto px-4 max-w-4xl">
                {/* Navigation and language warning */}
                <div className="mb-8">
                    <Link href={`/${locale}/blog`} className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 transition-colors">
                        <svg className="w-4 h-4 mr-2 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                        {t('backToBlog')}
                    </Link>

                    {isWrongLocale && (
                        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-8 rounded-r-md shadow-sm">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-amber-700">
                                        {t.raw('availableIn').replace('{language}', getLocalizedLanguage(post.locale))}
                                        <Link href={`/${post.locale}/blog/${post.slug}`} className="font-medium underline ml-1 hover:text-amber-800 transition-colors">
                                            {t.raw('viewIn').replace('{language}', getLocalizedLanguage(post.locale))}
                                        </Link>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main blog article */}
                <article className="bg-white rounded-lg shadow-md overflow-hidden">
                    {/* Article header */}
                    <header className="p-8 border-b border-gray-100">
                        <h1 className="text-4xl font-bold mb-4 text-gray-900">{post.title}</h1>
                        <div className="text-gray-500 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            {formattedDate}
                        </div>
                    </header>

                    {/* Article content */}
                    <div className="p-8">
                        <div className="prose prose-lg max-w-none">
                            <ReactMarkdown
                                components={{
                                    h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mt-8 mb-4" {...props} />,
                                    h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-8 mb-3" {...props} />,
                                    h3: ({ node, ...props }) => <h3 className="text-xl font-bold mt-6 mb-3" {...props} />,
                                    p: ({ node, ...props }) => <p className="my-4 text-gray-700 leading-relaxed" {...props} />,
                                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-4" {...props} />,
                                    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-4" {...props} />,
                                    li: ({ node, ...props }) => <li className="ml-2 mb-2" {...props} />,
                                    blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-gray-200 pl-4 italic my-4" {...props} />,
                                    a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" {...props} />,
                                    code: ({ node, className, children, ...props }) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        // Default to python for code blocks that look like python (with # comments)
                                        const content = String(children).trim();
                                        const isPythonLike = !match && content.includes('def ') || content.split('\n').some(line => line.trim().startsWith('#'));

                                        const language = match ? match[1] : (isPythonLike ? 'python' : '');
                                        const isInline = !className && !isPythonLike;

                                        if (isInline) {
                                            return (
                                                <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props}>
                                                    {children}
                                                </code>
                                            );
                                        }

                                        return (
                                            <div className="my-6 rounded-md overflow-hidden">
                                                {language && (
                                                    <div className="bg-gray-700 text-gray-200 text-xs py-1 px-4 uppercase">
                                                        {language}
                                                    </div>
                                                )}
                                                <pre className="bg-gray-800 text-white overflow-x-auto p-4 m-0">
                                                    <code className={language ? `language-${language}` : ''} {...props}>
                                                        {content.split('\n').map((line, i) => {
                                                            // Style Python comments
                                                            if (language === 'python' && line.trim().startsWith('#')) {
                                                                return (
                                                                    <div key={i} className="text-green-400">
                                                                        {line}
                                                                    </div>
                                                                );
                                                            }
                                                            return <div key={i}>{line}</div>;
                                                        })}
                                                    </code>
                                                </pre>
                                            </div>
                                        );
                                    }
                                }}
                            >
                                {post.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                </article>

                {/* Related posts or comments could go here */}
                <div className="mt-8 text-center">
                    <Link href={`/${locale}/blog`} className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
                        {t('backToBlog')}
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
                        </svg>
                    </Link>
                </div>
            </div>
        </div>
    );
} 