'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useTranslations } from 'next-intl';
import { useBlogContext } from '@/contexts/BlogContext';

interface BlogPost {
    _id: string;
    title: string;
    slug: string;
    content: string;
    status: 'draft' | 'published';
    locale: 'en' | 'ru' | 'uz';
    generationGroupId?: string;
    createdAt: string;
    updatedAt: string;
}

export default function BlogPostPage({ params }: { params: { locale: string; slug: string } }) {
    const { locale, slug } = params;
    const t = useTranslations('blog');
    const { setCurrentPost } = useBlogContext();
    const [post, setPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [readingTime, setReadingTime] = useState(0);

    useEffect(() => {
        async function fetchPost() {
            try {
                setLoading(true);
                const res = await fetch(`/api/blog/posts/${slug}?locale=${locale}`);

                if (!res.ok) {
                    if (res.status === 404) {
                        throw new Error('Post not found');
                    }
                    throw new Error(`Error fetching post: ${res.status}`);
                }

                const data = await res.json();
                setPost(data.post);
                
                // Set current post in context for language switching
                setCurrentPost({
                    generationGroupId: data.post.generationGroupId,
                    locale: data.post.locale,
                    slug: data.post.slug
                });

                // Calculate reading time (average 200 words per minute)
                const wordCount = data.post.content.split(/\s+/).length;
                const estimatedReadingTime = Math.ceil(wordCount / 200);
                setReadingTime(estimatedReadingTime);
            } catch (err) {
                console.error('Error loading post:', err);
                setError(err instanceof Error ? err.message : 'Failed to load blog post');
            } finally {
                setLoading(false);
            }
        }

        fetchPost();
        
        // Cleanup function to clear current post when leaving the page
        return () => {
            setCurrentPost(null);
        };
    }, [slug, locale, setCurrentPost]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading post...</p>
                </div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-500 mb-4 text-lg">Error: {error || 'Post not found'}</div>
                    <Link href={`/${locale}/blog`} className="text-blue-600 hover:underline">
                        {t('backToBlog')}
                    </Link>
                </div>
            </div>
        );
    }



    const formattedDate = format(new Date(post.createdAt), 'MMMM dd, yyyy');

    return (
        <div className="page-layout min-h-screen" style={{ backgroundColor: 'var(--gray-100)' }}>
            {/* Header with navigation */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                <div className="container py-4">
                    <Link 
                        href={`/${locale}/blog`} 
                        className="inline-flex items-center text-gray-600 hover:text-[#fe4502] transition-colors duration-300 font-medium"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                        </svg>
                        {t('backToBlog')}
                    </Link>
                </div>
            </header>

            

                        {/* Main content */}
            <main className="container py-12">
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <article className="p-8 md:p-12">
                        {/* Article header */}
                        <header className="mb-12 text-center">
                            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-8 leading-tight tracking-wide">
                                {post.title}
                            </h1>
                            
                            <div className="flex items-center justify-center space-x-8 text-gray-500 text-sm font-medium">
                                <div className="flex items-center">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                {formattedDate}
                                </div>
                                <div className="flex items-center">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    {readingTime} {t('readingTime')}
                                </div>
                                <div className="flex items-center">
                                    <span className="px-3 py-1 bg-[#fe4502] text-white text-xs font-semibold rounded-full">
                                        {post.locale.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </header>

                    {/* Article content with Medium-style typography */}
                    <div className="prose prose-lg prose-gray max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                            components={{
                                h1: ({ children }) => (
                                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mt-12 mb-6 leading-tight">
                                        {children}
                                    </h1>
                                ),
                                h2: ({ children }) => (
                                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-10 mb-5 leading-tight">
                                        {children}
                                    </h2>
                                ),
                                h3: ({ children }) => (
                                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 mt-8 mb-4 leading-tight">
                                        {children}
                                    </h3>
                                ),
                                p: ({ children }) => (
                                    <p className="text-lg text-gray-700 leading-relaxed mb-6 font-light">
                                        {children}
                                    </p>
                                ),
                                ul: ({ children }) => (
                                    <ul className="list-disc pl-6 mb-6 space-y-2 text-lg text-gray-700">
                                        {children}
                                    </ul>
                                ),
                                ol: ({ children }) => (
                                    <ol className="list-decimal pl-6 mb-6 space-y-2 text-lg text-gray-700">
                                        {children}
                                    </ol>
                                ),
                                li: ({ children }) => (
                                    <li className="leading-relaxed">
                                        {children}
                                    </li>
                                ),
                                blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-blue-500 pl-6 py-2 my-8 bg-gray-50 italic text-lg text-gray-700 rounded-r-lg">
                                        {children}
                                    </blockquote>
                                ),
                                a: ({ href, children }) => (
                                    <a 
                                        href={href} 
                                        className="text-blue-600 hover:text-blue-800 underline decoration-2 underline-offset-2 transition-colors"
                                        target={href?.startsWith('http') ? '_blank' : undefined}
                                        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                                    >
                                        {children}
                                    </a>
                                ),
                                strong: ({ children }) => (
                                    <strong className="font-semibold text-gray-900">
                                        {children}
                                    </strong>
                                ),
                                em: ({ children }) => (
                                    <em className="italic text-gray-700">
                                        {children}
                                    </em>
                                ),
                                code: ({ className, children }) => {
                                    const isInline = !className;
                                    
                                    if (isInline) {
                                        return (
                                            <code className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-mono">
                                                {children}
                                            </code>
                                        );
                                    }
                                    
                                    return (
                                        <code className={className}>
                                            {children}
                                        </code>
                                    );
                                },
                                pre: ({ children }) => (
                                    <div className="my-8 rounded-lg overflow-hidden shadow-lg">
                                        <pre className="bg-gray-900 text-gray-100 p-6 overflow-x-auto text-sm leading-relaxed">
                                            {children}
                                        </pre>
                                    </div>
                                ),
                                table: ({ children }) => (
                                    <div className="my-8 overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                                            {children}
                                        </table>
                                    </div>
                                ),
                                thead: ({ children }) => (
                                    <thead className="bg-gray-50">
                                        {children}
                                    </thead>
                                ),
                                th: ({ children }) => (
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {children}
                                    </th>
                                ),
                                td: ({ children }) => (
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {children}
                                    </td>
                                ),
                                hr: () => (
                                    <hr className="my-12 border-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
                                ),
                            }}
                        >
                            {post.content}
                        </ReactMarkdown>
                    </div>

                        {/* Call to action */}
                        <div className="mt-16 p-8 bg-gradient-to-r from-[#fe4502] to-[#ff5f24] rounded-xl text-white">
                            <div className="text-center">
                                <h3 className="text-2xl font-bold mb-4">
                                    {t('cta.title')}
                                </h3>
                                <p className="text-lg mb-6 max-w-2xl mx-auto opacity-90">
                                    {t('cta.description')}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                    <Link
                                        href={`/${locale}#contact`}
                                        className="inline-flex items-center px-6 py-3 bg-white text-[#fe4502] font-semibold rounded-lg hover:bg-gray-100 transition-colors duration-300"
                                    >
                                        {t('cta.getStarted')}
                                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                        </svg>
                                    </Link>
                                    <Link
                                        href={`/${locale}#portfolio`}
                                        className="inline-flex items-center px-6 py-3 bg-transparent text-white font-semibold rounded-lg border-2 border-white hover:bg-white hover:text-[#fe4502] transition-colors duration-300"
                                    >
                                        {t('cta.viewWork')}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </article>
                </div>

                                {/* Related posts or back to blog */}
                <div className="mt-16 pt-8 text-center">
                    <Link
                        href={`/${locale}/blog`}
                        className="inline-flex items-center text-[#fe4502] hover:text-[#ff5f24] font-semibold transition-colors duration-300"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                    </svg>
                        {t('readMoreArticles')}
                </Link>
            </div>
            </main>
        </div>
    );
} 