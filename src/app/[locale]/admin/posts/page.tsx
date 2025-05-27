'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { TbRobot } from 'react-icons/tb';
import Button from '@/components/Button';

// Define the shape of the post data expected from the admin API
interface AdminPostSummary {
    _id: string;
    title: string;
    slug: string;
    status: 'draft' | 'published';
    locale: 'en' | 'ru' | 'uz';
    createdAt: string;
}

// Helper function to fetch data (refactored for reuse)
const fetchAdminPosts = async (): Promise<AdminPostSummary[]> => {
    try {
        const res = await fetch('/api/admin/posts');
        if (!res.ok) {
            const errorBody = await res.text();
            console.error(`Failed to fetch posts: ${res.status} ${res.statusText}`, errorBody);
            throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
        }
        const data: { posts: AdminPostSummary[] } = await res.json();
        return data.posts || [];
    } catch (error) {
        console.error("Error fetching admin posts:", error);
        throw error;
    }
};

// Function to trigger AI generation
async function triggerAIGeneration(): Promise<{ message: string; postId?: string; title?: string; slug?: string; posts?: any[]; errors?: any[] }> {
    const res = await fetch('/api/blog/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    const data = await res.json();

    if (!res.ok && res.status !== 207) {
        console.error("AI Generation API Error:", data);
        throw new Error(data.error || `HTTP error ${res.status}`);
    }

    return data;
}

export default function AdminPostsPage({ params }: { params: { locale: string } }): JSX.Element {
    const [posts, setPosts] = useState<AdminPostSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [generationStatus, setGenerationStatus] = useState<string | null>(null);

    const { locale } = params;

    // useCallback to memoize the fetch function
    const loadPosts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedPosts = await fetchAdminPosts();
            setPosts(fetchedPosts);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An unknown error occurred fetching posts");
            console.error("Failed to load posts:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadPosts();
    }, [loadPosts]);

    // Handler for the generate button
    const handleGeneratePost = async () => {
        setIsGenerating(true);
        setGenerationStatus("Generating post (this may take a while)...");
        setError(null);
        try {
            const result = await triggerAIGeneration();
            let statusMsg = result.message;
            if (result.errors && result.errors.length > 0) {
                statusMsg += ` Errors: ${JSON.stringify(result.errors)}`;
            }
            setGenerationStatus(statusMsg + " Refreshing list...");

            setTimeout(() => {
                loadPosts();
                setGenerationStatus(null);
            }, 2500);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : "An unknown error occurred during generation";
            setError(`Generation failed: ${errorMsg}`);
            setGenerationStatus(null);
            console.error("Failed to generate post:", err);
        } finally {
            setTimeout(() => setIsGenerating(false), 2500);
        }
    };

    const getStatusBadge = (status: string) => {
        if (status === 'published') {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <svg className="w-2 h-2 mr-1" fill="currentColor" viewBox="0 0 8 8">
                        <circle cx={4} cy={4} r={3} />
                    </svg>
                    Published
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <svg className="w-2 h-2 mr-1" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx={4} cy={4} r={3} />
                </svg>
                Draft
            </span>
        );
    };

    const getLocaleBadge = (locale: string) => {
        const localeMap = {
            'ru': { flag: '🇷🇺', name: 'Russian' },
            'uz': { flag: '🇺🇿', name: 'Uzbek' },
            'en': { flag: '🇬🇧', name: 'English' }
        };
        const localeInfo = localeMap[locale as keyof typeof localeMap] || { flag: '🌐', name: locale };

        return (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                <span className="mr-1">{localeInfo.flag}</span>
                {localeInfo.name}
            </span>
        );
    };

    return (
        <div className="admin-layout">
            <div className="container mx-auto px-6 py-8">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Blog Posts</h1>
                            <p className="text-gray-600">Manage your blog posts and create new content</p>
                        </div>
                        <Link
                            href={`/${locale}/admin/posts/new`}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-lg hover:bg-green-700 transition-colors duration-200"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Post
                        </Link>
                    </div>

                    {/* AI Generation Section */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">AI Content Generation</h3>
                                <p className="text-sm text-gray-600">Generate new blog posts automatically using AI</p>
                            </div>
                            <Button
                                onClick={handleGeneratePost}
                                disabled={isGenerating || loading}
                                className={`inline-flex items-center px-4 py-2 text-sm font-medium ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <TbRobot className="w-4 h-4 mr-2" />
                                {isGenerating ? 'Generating...' : 'Generate Post'}
                            </Button>
                        </div>

                        {generationStatus && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-800">{generationStatus}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <h3 className="text-sm font-medium text-red-800">Error</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="bg-white rounded-lg border border-gray-200 p-8">
                        <div className="flex items-center justify-center">
                            <svg className="animate-spin h-8 w-8 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-gray-600">Loading posts...</span>
                        </div>
                    </div>
                )}

                {/* Posts Table */}
                {!loading && !error && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-lg font-semibold text-gray-900">All Posts</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                {posts.length} {posts.length === 1 ? 'post' : 'posts'} total
                            </p>
                        </div>

                        {posts.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Title
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Language
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Created
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {posts.map((post) => (
                                            <tr key={post._id} className="hover:bg-gray-50 transition-colors duration-150">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <Link
                                                            href={`/${locale}/admin/posts/edit/${post._id}`}
                                                            className="text-sm font-medium text-gray-900 hover:text-orange-600 transition-colors duration-150"
                                                        >
                                                            {post.title}
                                                        </Link>
                                                        <span className="text-xs text-gray-500 mt-1 font-mono">
                                                            /{post.slug}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {getLocaleBadge(post.locale)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {getStatusBadge(post.status)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {post.createdAt ? format(new Date(post.createdAt), 'MMM dd, yyyy') : 'N/A'}
                                                    <div className="text-xs text-gray-400">
                                                        {post.createdAt ? format(new Date(post.createdAt), 'HH:mm') : ''}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium">
                                                    <div className="flex items-center space-x-3">
                                                        <Link
                                                            href={`/${locale}/admin/posts/edit/${post._id}`}
                                                            className="text-orange-600 hover:text-orange-900 transition-colors duration-150"
                                                        >
                                                            Edit
                                                        </Link>
                                                        <Link
                                                            href={`/${locale}/blog/${post.slug}`}
                                                            target="_blank"
                                                            className="text-gray-600 hover:text-gray-900 transition-colors duration-150"
                                                        >
                                                            View
                                                        </Link>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center">
                                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                                <p className="text-gray-600 mb-4">Get started by creating your first blog post.</p>
                                <Link
                                    href={`/${locale}/admin/posts/new`}
                                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-lg hover:bg-orange-700 transition-colors duration-200"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Create your first post
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
} 