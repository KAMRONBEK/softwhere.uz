'use client';

import { AdminBadge, AdminButton, AdminInput, AdminLoading, AdminSelect } from '@/components/AdminComponents/index';
import { adminFetch } from '@/utils/adminFetch';
import { format } from 'date-fns';
import React, { useCallback, useEffect, useState } from 'react';

interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published';
  locale: 'en' | 'ru' | 'uz';
  generationGroupId?: string;
  coverImage?: { url: string; thumbUrl: string; authorName: string; authorUrl: string; keyword: string };
  createdAt: string;
  updatedAt: string;
}

interface PostGroup {
  generationGroupId: string;
  posts: BlogPost[];
  createdAt: string;
  status: 'draft' | 'published' | 'mixed';
}

interface GenerationRequest {
  category?: string;
  customTopic?: string;
  sourceUrl?: string;
  sourceText?: string;
  locales: string[];
}

const BLOG_CATEGORIES = {
  auto: 'Auto (Smart Selection)',
  random: 'Random Topic (All Categories)',
  'mobile-app-development': 'Mobile App Development',
  'mvp-startup': 'MVP & Startup Development',
  'ai-solutions': 'AI Solutions & RAG',
  'web-app-development': 'Web App Development',
  'telegram-bot-development': 'Telegram Bot Development',
  'crm-development': 'CRM Development',
  'business-automation': 'Business Automation',
  'saas-development': 'SaaS Development',
  outsourcing: 'Developer Outsourcing',
  'project-rescue': 'Project Rescue',
  ecommerce: 'E-commerce Development',
  'ui-ux-design': 'UI/UX Design',
  'maintenance-support': 'Maintenance & Support',
  cybersecurity: 'Cybersecurity',
};

// Markdown to HTML converter (simple version)
const markdownToHtml = (markdown: string) => {
  return markdown
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-gray-900 mt-8 mb-6">$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/\*(.*)\*/gim, '<em class="italic">$1</em>')
    .replace(/^\- (.*$)/gim, '<li class="ml-4 mb-1">• $1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 mb-1 list-decimal">$1</li>')
    .replace(/\n\n/gim, '</p><p class="mb-4 text-gray-700 leading-relaxed">')
    .replace(/\n/gim, '<br>')
    .replace(/^(.*)$/gim, '<p class="mb-4 text-gray-700 leading-relaxed">$1</p>');
};

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [postGroups, setPostGroups] = useState<PostGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [genMode, setGenMode] = useState<'topic' | 'source'>('topic');
  const [generationForm, setGenerationForm] = useState<GenerationRequest>({
    category: 'auto',
    customTopic: '',
    sourceUrl: '',
    sourceText: '',
    locales: ['en', 'ru', 'uz'],
  });

  const groupPosts = useCallback(() => {
    const grouped = new Map<string, BlogPost[]>();
    const ungrouped: BlogPost[] = [];

    posts.forEach(post => {
      if (post.generationGroupId) {
        if (!grouped.has(post.generationGroupId)) {
          grouped.set(post.generationGroupId, []);
        }
        grouped.get(post.generationGroupId)!.push(post);
      } else {
        ungrouped.push(post);
      }
    });

    const groups: PostGroup[] = [];

    // Add grouped posts
    grouped.forEach((groupPosts, groupId) => {
      const statuses = Array.from(new Set(groupPosts.map(p => p.status)));
      const status = statuses.length === 1 ? statuses[0] : 'mixed';

      groups.push({
        generationGroupId: groupId,
        posts: groupPosts.sort((a, b) => a.locale.localeCompare(b.locale)),
        createdAt: groupPosts[0].createdAt,
        status: status as 'draft' | 'published' | 'mixed',
      });
    });

    // Add ungrouped posts as individual groups
    ungrouped.forEach(post => {
      groups.push({
        generationGroupId: post._id,
        posts: [post],
        createdAt: post.createdAt,
        status: post.status,
      });
    });

    // Sort by creation date
    groups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setPostGroups(groups);
  }, [posts]);

  useEffect(() => {
    fetchPosts();
  }, []);

  useEffect(() => {
    groupPosts();
  }, [groupPosts]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await adminFetch('/api/admin/posts');

      if (response.ok) {
        const data = await response.json();

        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePosts = async () => {
    try {
      setGenerating(true);

      const payload: Record<string, unknown> = { locales: generationForm.locales };
      if (genMode === 'source') {
        if (generationForm.sourceUrl) payload.sourceUrl = generationForm.sourceUrl;
        else if (generationForm.sourceText) payload.sourceText = generationForm.sourceText;
      } else {
        if (generationForm.customTopic) payload.customTopic = generationForm.customTopic;
        else if (generationForm.category) payload.category = generationForm.category;
      }

      const response = await adminFetch('/api/blog/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();

        alert(`Successfully generated ${data.posts.length} blog post(s)!`);
        fetchPosts();
        setShowGenerator(false);
      } else {
        const error = await response.json();

        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error generating posts:', error);
      alert('Failed to generate posts');
    } finally {
      setGenerating(false);
    }
  };

  const updateGroupStatus = async (group: PostGroup, status: 'draft' | 'published') => {
    try {
      const promises = group.posts.map(post =>
        adminFetch(`/api/admin/posts/${post._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        })
      );

      const results = await Promise.all(promises);
      const allSuccessful = results.every(res => res.ok);

      if (allSuccessful) {
        fetchPosts();
        alert(`All posts ${status === 'published' ? 'published' : 'saved as draft'} successfully!`);
      } else {
        alert('Some posts failed to update');
      }
    } catch (error) {
      console.error('Error updating posts:', error);
      alert('Failed to update posts');
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedGroups.size === postGroups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(postGroups.map(g => g.generationGroupId)));
    }
  };

  const getSelectedGroups = () => postGroups.filter(g => selectedGroups.has(g.generationGroupId));

  const batchUpdateStatus = async (status: 'draft' | 'published') => {
    const groups = getSelectedGroups();
    const allPosts = groups.flatMap(g => g.posts);
    try {
      const results = await Promise.all(
        allPosts.map(post =>
          adminFetch(`/api/admin/posts/${post._id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          })
        )
      );
      const allOk = results.every(r => r.ok);
      setSelectedGroups(new Set());
      fetchPosts();
      alert(allOk
        ? `${groups.length} group(s) ${status === 'published' ? 'published' : 'unpublished'} successfully!`
        : 'Some posts failed to update');
    } catch {
      alert('Failed to update posts');
    }
  };

  const batchDelete = async () => {
    const groups = getSelectedGroups();
    const allPosts = groups.flatMap(g => g.posts);
    if (!confirm(`Delete ${groups.length} group(s) (${allPosts.length} posts total)?`)) return;
    try {
      const results = await Promise.all(
        allPosts.map(post =>
          adminFetch(`/api/admin/posts/${post._id}`, { method: 'DELETE' })
        )
      );
      const allOk = results.every(r => r.ok);
      setSelectedGroups(new Set());
      fetchPosts();
      alert(allOk ? 'Selected groups deleted!' : 'Some posts failed to delete');
    } catch {
      alert('Failed to delete posts');
    }
  };

  const deleteGroup = async (group: PostGroup) => {
    if (!confirm(`Are you sure you want to delete ${group.posts.length} post(s)?`)) return;

    try {
      const promises = group.posts.map(post =>
        adminFetch(`/api/admin/posts/${post._id}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.all(promises);
      const allSuccessful = results.every(res => res.ok);

      if (allSuccessful) {
        fetchPosts();
        alert('Posts deleted successfully!');
      } else {
        alert('Some posts failed to delete');
      }
    } catch (error) {
      console.error('Error deleting posts:', error);
      alert('Failed to delete posts');
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <AdminLoading message='Loading posts...' />
      </div>
    );
  }

  return (
    <div className='page-layout min-h-screen bg-gray-50'>
      {/* Header */}
      <div className='bg-white border-b border-gray-200 sticky top-0 z-40'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-6'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900'>Content Management</h1>
              <p className='mt-1 text-sm text-gray-500'>Manage and generate blog posts for your website</p>
            </div>
            <div className='flex space-x-3'>
              <AdminButton
                onClick={() => setShowGenerator(!showGenerator)}
                variant={showGenerator ? 'secondary' : 'primary'}
                className='shadow-sm'
              >
                <svg className='w-5 h-5 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 6v6m0 0v6m0-6h6m-6 0H6'></path>
                </svg>
                {showGenerator ? 'Hide Generator' : 'Generate New Posts'}
              </AdminButton>
            </div>
          </div>
        </div>
      </div>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Post Generator */}
        {showGenerator && (
          <div className='mb-8'>
            <div className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
              <div className='bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200'>
                <h3 className='text-lg font-semibold text-gray-900 flex items-center'>
                  <svg className='w-5 h-5 mr-2 text-blue-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
                    ></path>
                  </svg>
                  AI Content Generator
                </h3>
                <p className='text-sm text-gray-600 mt-1'>Generate high-quality blog posts using AI</p>
              </div>

              <div className='p-6'>
                {/* Mode tabs */}
                <div className='flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1'>
                  <button
                    onClick={() => setGenMode('topic')}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${genMode === 'topic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Topic / Category
                  </button>
                  <button
                    onClick={() => setGenMode('source')}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${genMode === 'source' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    From Source
                  </button>
                </div>

                <div className='grid lg:grid-cols-2 gap-6'>
                  <div className='space-y-4'>
                    {genMode === 'topic' ? (
                      <>
                        <AdminSelect
                          label='Content Category'
                          value={generationForm.category}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            setGenerationForm({
                              ...generationForm,
                              category: e.target.value,
                            })
                          }
                          options={Object.entries(BLOG_CATEGORIES).map(([key, label]) => ({
                            value: key,
                            label,
                          }))}
                        />

                        <AdminInput
                          label='Custom Topic (Optional)'
                          type='text'
                          value={generationForm.customTopic}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setGenerationForm({
                              ...generationForm,
                              customTopic: e.target.value,
                            })
                          }
                          placeholder='Enter a specific topic...'
                        />
                      </>
                    ) : (
                      <>
                        <AdminInput
                          label='Source URL'
                          type='url'
                          value={generationForm.sourceUrl}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setGenerationForm({
                              ...generationForm,
                              sourceUrl: e.target.value,
                              sourceText: e.target.value ? '' : generationForm.sourceText,
                            })
                          }
                          placeholder='https://example.com/news-article...'
                        />

                        <div>
                          <label className='block text-sm font-medium text-gray-700 mb-1'>Or Paste Content</label>
                          <textarea
                            value={generationForm.sourceText}
                            onChange={e =>
                              setGenerationForm({
                                ...generationForm,
                                sourceText: e.target.value,
                                sourceUrl: e.target.value ? '' : generationForm.sourceUrl,
                              })
                            }
                            placeholder='Paste article text, news content, or any source material...'
                            rows={5}
                            maxLength={5000}
                            disabled={!!generationForm.sourceUrl}
                            className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400'
                          />
                          <p className='mt-1 text-xs text-gray-400'>
                            {generationForm.sourceText?.length ?? 0}/5000 chars. AI will write an original post using this as context.
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className='space-y-4'>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 mb-3'>Target Languages</label>
                      <div className='grid grid-cols-3 gap-3'>
                        {['en', 'ru', 'uz'].map(locale => (
                          <label
                            key={locale}
                            className='flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors'
                          >
                            <input
                              type='checkbox'
                              checked={generationForm.locales.includes(locale)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setGenerationForm({
                                    ...generationForm,
                                    locales: [...generationForm.locales, locale],
                                  });
                                } else {
                                  setGenerationForm({
                                    ...generationForm,
                                    locales: generationForm.locales.filter(l => l !== locale),
                                  });
                                }
                              }}
                              className='mr-3 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                            />
                            <span className='text-sm font-medium text-gray-900'>{locale.toUpperCase()}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className='mt-6 flex justify-end space-x-3'>
                  <AdminButton onClick={() => setShowGenerator(false)} variant='secondary'>
                    Cancel
                  </AdminButton>
                  <AdminButton
                    onClick={generatePosts}
                    disabled={
                      generating ||
                      generationForm.locales.length === 0 ||
                      (genMode === 'source' && !generationForm.sourceUrl && !generationForm.sourceText)
                    }
                    variant='success'
                    className='min-w-[140px]'
                  >
                    {generating ? (
                      <div className='flex items-center'>
                        <svg className='animate-spin -ml-1 mr-2 h-4 w-4' fill='none' viewBox='0 0 24 24'>
                          <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                          <path
                            className='opacity-75'
                            fill='currentColor'
                            d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                          ></path>
                        </svg>
                        Generating...
                      </div>
                    ) : (
                      'Generate Posts'
                    )}
                  </AdminButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Posts Overview */}
        <div className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
          <div className='px-6 py-4 border-b border-gray-200 bg-gray-50'>
            <div className='flex justify-between items-center'>
              <div className='flex items-center space-x-4'>
                {postGroups.length > 0 && (
                  <input
                    type='checkbox'
                    checked={postGroups.length > 0 && selectedGroups.size === postGroups.length}
                    onChange={toggleAll}
                    className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer'
                  />
                )}
                <div>
                  <h3 className='text-lg font-semibold text-gray-900'>
                    {selectedGroups.size > 0
                      ? `${selectedGroups.size} of ${postGroups.length} groups selected`
                      : 'All Posts'}
                  </h3>
                  <p className='text-sm text-gray-600'>
                    {posts.length} total posts in {postGroups.length} groups
                  </p>
                </div>
              </div>
              <div className='flex space-x-2'>
                <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                  {posts.filter(p => p.status === 'published').length} Published
                </span>
                <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'>
                  {posts.filter(p => p.status === 'draft').length} Drafts
                </span>
              </div>
            </div>
          </div>

          {postGroups.length === 0 ? (
            <div className='py-16 text-center'>
              <svg className='mx-auto h-12 w-12 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                ></path>
              </svg>
              <h3 className='mt-4 text-lg font-medium text-gray-900'>No posts yet</h3>
              <p className='mt-2 text-gray-500'>Get started by generating your first blog post.</p>
            </div>
          ) : (
            <div className='divide-y divide-gray-200'>
              {postGroups.map((group, _groupIndex) => (
                <div key={group.generationGroupId} className='p-6'>
                  {/* Group Header */}
                  <div className='flex justify-between items-start mb-4'>
                    <div className='flex items-center flex-1 min-w-0'>
                      <input
                        type='checkbox'
                        checked={selectedGroups.has(group.generationGroupId)}
                        onChange={() => toggleGroup(group.generationGroupId)}
                        className='w-4 h-4 mr-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer flex-shrink-0'
                      />
                      <div className='flex items-center space-x-3'>
                        <h4 className='text-sm font-medium text-gray-900'>
                          {group.posts.length > 1 ? `Post Group (${group.posts.length} languages)` : 'Individual Post'}
                        </h4>
                        <AdminBadge variant='status' status={group.status}>
                          {group.status}
                        </AdminBadge>
                        <span className='text-xs text-gray-500'>{format(new Date(group.createdAt), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>

                    {/* Group Actions */}
                    <div className='flex space-x-2'>
                      {group.status !== 'published' && (
                        <button
                          onClick={() => updateGroupStatus(group, 'published')}
                          className='inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors'
                        >
                          <svg className='w-4 h-4 mr-1' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M5 13l4 4L19 7'></path>
                          </svg>
                          Publish All
                        </button>
                      )}
                      {group.status !== 'draft' && (
                        <button
                          onClick={() => updateGroupStatus(group, 'draft')}
                          className='inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors'
                        >
                          <svg className='w-4 h-4 mr-1' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2'
                              d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                            ></path>
                          </svg>
                          Unpublish All
                        </button>
                      )}
                      <button
                        onClick={() => deleteGroup(group)}
                        className='inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors'
                      >
                        <svg className='w-4 h-4 mr-1' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth='2'
                            d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                          ></path>
                        </svg>
                        Delete All
                      </button>
                    </div>
                  </div>

                  {/* Posts in Group */}
                  <div className='space-y-3'>
                    {group.posts.map(post => (
                      <div key={post._id} className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
                        <div className='flex-1 min-w-0'>
                          <div className='flex items-center space-x-3'>
                            <AdminBadge variant='locale' locale={post.locale as 'en' | 'ru' | 'uz'}>
                              {post.locale.toUpperCase()}
                            </AdminBadge>
                            <div className='flex-1 min-w-0'>
                              <p className='text-sm font-medium text-gray-900 truncate'>{post.title}</p>
                              <p className='text-xs text-gray-500 truncate'>
                                /{post.locale}/blog/{post.slug}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className='flex space-x-2'>
                          <button
                            onClick={() => setSelectedPost(post)}
                            className='inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors'
                          >
                            <svg className='w-4 h-4 mr-1' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='2'
                                d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                              ></path>
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='2'
                                d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                              ></path>
                            </svg>
                            Preview
                          </button>
                          <a
                            href={`/${post.locale}/blog/${post.slug}`}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors'
                          >
                            <svg className='w-4 h-4 mr-1' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='2'
                                d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                              ></path>
                            </svg>
                            Live
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Enhanced Post Preview Modal */}
        {selectedPost && (
          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
            <div className='bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl'>
              {/* Modal Header */}
              <div className='flex justify-between items-start p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100'>
                <div className='flex-1 min-w-0'>
                  <h3 className='text-xl font-bold text-gray-900 truncate'>{selectedPost.title}</h3>
                  <div className='mt-2 flex items-center space-x-4 text-sm text-gray-500'>
                    <span className='flex items-center'>
                      <svg className='w-4 h-4 mr-1' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth='2'
                          d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                        ></path>
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
                  onClick={() => setSelectedPost(null)}
                  className='ml-4 text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-200 rounded-lg'
                >
                  <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12'></path>
                  </svg>
                </button>
              </div>

              {/* Modal Content */}
              <div className='overflow-y-auto max-h-[60vh] bg-white'>
                {selectedPost.coverImage?.url && (
                  <div className='relative w-full h-48 md:h-64 bg-gray-100'>
                    <img src={selectedPost.coverImage.url} alt={selectedPost.title} className='w-full h-full object-cover' />
                    <span className='absolute bottom-2 right-3 text-[10px] text-white/80 bg-black/40 px-2 py-1 rounded'>
                      Photo by {selectedPost.coverImage.authorName}
                    </span>
                  </div>
                )}
                <article className='prose prose-lg max-w-none p-8'>
                  <div
                    className='text-gray-800 leading-relaxed'
                    dangerouslySetInnerHTML={{
                      __html: markdownToHtml(selectedPost.content),
                    }}
                  />
                </article>
              </div>

              {/* Modal Footer */}
              <div className='p-6 border-t border-gray-200 bg-gray-50 flex justify-between items-center'>
                <div className='text-sm text-gray-500'>
                  URL: /{selectedPost.locale}/blog/{selectedPost.slug}
                </div>
                <div className='flex space-x-3'>
                  <AdminButton onClick={() => setSelectedPost(null)} variant='secondary'>
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
        )}
      </div>

      {selectedGroups.size > 0 && (
        <div className='fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 shadow-lg'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between'>
            <span className='text-sm font-medium text-gray-700'>
              {selectedGroups.size} group(s) selected ({getSelectedGroups().flatMap(g => g.posts).length} posts)
            </span>
            <div className='flex items-center space-x-3'>
              <button
                onClick={() => batchUpdateStatus('published')}
                className='inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 transition-colors'
              >
                Publish Selected
              </button>
              <button
                onClick={() => batchUpdateStatus('draft')}
                className='inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 transition-colors'
              >
                Unpublish Selected
              </button>
              <button
                onClick={batchDelete}
                className='inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors'
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedGroups(new Set())}
                className='inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
