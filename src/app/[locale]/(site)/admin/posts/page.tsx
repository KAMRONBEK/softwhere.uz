'use client';

import { AdminBadge, AdminButton, AdminInput, AdminLoading, AdminSelect } from '@/modules/admin/components/index';
import PostPreviewModal from '@/modules/admin/components/PostPreviewModal';
import { adminFetch } from '@/modules/admin/utils/adminFetch';
import { BLOG_CATEGORIES } from '@/modules/admin/constants';
import { BlogPost, GenerationRequest, PostGroup } from '@/modules/admin/types';
import { format } from 'date-fns';
import React, { useCallback, useEffect, useState } from 'react';

const ALL_LOCALES = ['en', 'ru', 'uz'] as const;

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [postGroups, setPostGroups] = useState<PostGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [fillingGroups, setFillingGroups] = useState<Set<string>>(new Set());
  const [genMode, setGenMode] = useState<'topic' | 'source'>('topic');
  const [generationForm, setGenerationForm] = useState<GenerationRequest>({
    category: 'auto',
    customTopic: '',
    sourceUrl: '',
    sourceText: '',
    locales: ['en', 'ru', 'uz'],
  });

  const openPreview = async (post: BlogPost) => {
    if (previewLoading) return;
    if (post.content) {
      setSelectedPost(post);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await adminFetch(`/api/admin/posts/${post._id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPost({ ...post, content: data.post.content });
      }
    } catch {
      setSelectedPost(post);
    } finally {
      setPreviewLoading(false);
    }
  };

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

      // One locale per request: research + a full 8K-token draft don't fit
      // 3× into the route's 300s budget. The first call creates the group;
      // follow-ups continue it via generationGroupId (reusing topic/images).
      let groupId: string | undefined;
      let createdCount = 0;
      const failedLocales: string[] = [];

      for (const locale of generationForm.locales) {
        const payload: Record<string, unknown> = { locales: [locale] };
        if (groupId) {
          payload.generationGroupId = groupId;
        } else if (genMode === 'source') {
          if (generationForm.sourceUrl) payload.sourceUrl = generationForm.sourceUrl;
          else if (generationForm.sourceText) payload.sourceText = generationForm.sourceText;
        } else {
          if (generationForm.customTopic) payload.customTopic = generationForm.customTopic;
          else if (generationForm.category) payload.category = generationForm.category;
        }

        try {
          const response = await adminFetch('/api/blog/generate', {
            method: 'POST',
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            const data = await response.json();
            groupId = data.generationGroupId ?? groupId;
            createdCount += data.posts?.length ?? 0;
          } else {
            let message = `HTTP ${response.status}`;
            try {
              message = (await response.json()).error ?? message;
            } catch {
              /* non-JSON error body */
            }
            failedLocales.push(`${locale}: ${message}`);
          }
        } catch {
          failedLocales.push(`${locale}: network error`);
        }
      }

      if (createdCount > 0) {
        alert(
          `Generated ${createdCount} blog post(s)!${failedLocales.length > 0 ? `\nFailed — retry these via the same topic: ${failedLocales.join('; ')}` : ''}`
        );
        fetchPosts();
        setShowGenerator(false);
      } else {
        alert(`Error: ${failedLocales.join('; ') || 'no posts generated'}`);
      }
    } catch (error) {
      console.error('Error generating posts:', error);
      alert('Failed to generate posts');
    } finally {
      setGenerating(false);
    }
  };

  // Locales a generation group lacks. Ungrouped single posts are excluded:
  // their synthetic group id is the post id, which the continuation API
  // can't resolve to a topic.
  const missingLocales = (group: PostGroup): string[] => {
    if (!group.posts[0]?.generationGroupId) return [];
    return ALL_LOCALES.filter(locale => !group.posts.some(p => p.locale === locale));
  };

  // Fill a group's missing locales via the generate API's continuation mode
  // (reuses the group's topic/images/meta and anchors to its EN post). One
  // locale per request — same 300s-budget reasoning as generatePosts above.
  const generateMissing = async (group: PostGroup) => {
    const missing = missingLocales(group);
    if (missing.length === 0 || fillingGroups.has(group.generationGroupId)) return;

    setFillingGroups(prev => new Set(prev).add(group.generationGroupId));
    let createdCount = 0;
    const failedLocales: string[] = [];
    try {
      for (const [index, locale] of missing.entries()) {
        let succeeded = false;
        try {
          const response = await adminFetch('/api/blog/generate', {
            method: 'POST',
            body: JSON.stringify({ generationGroupId: group.generationGroupId, locales: [locale] }),
          });
          if (response.ok) {
            const data = await response.json();
            createdCount += data.posts?.length ?? 0;
            succeeded = true;
          } else {
            let message = `HTTP ${response.status}`;
            try {
              message = (await response.json()).error ?? message;
            } catch {
              /* non-JSON error body */
            }
            failedLocales.push(`${locale}: ${message}`);
          }
        } catch {
          failedLocales.push(`${locale}: network error`);
        }
        // RU/UZ are anchored to the EN body — generating them after a failed
        // EN would silently produce diverging, unanchored articles.
        if (locale === 'en' && !succeeded) {
          failedLocales.push(...missing.slice(index + 1).map(l => `${l}: skipped (needs the EN post as anchor)`));
          break;
        }
      }

      if (createdCount > 0) {
        alert(
          `Generated ${createdCount} missing post(s) as draft(s) — preview, then publish.${failedLocales.length > 0 ? `\nFailed: ${failedLocales.join('; ')}` : ''}`
        );
        fetchPosts();
      } else {
        alert(`Error: ${failedLocales.join('; ') || 'no posts generated'}`);
      }
    } finally {
      setFillingGroups(prev => {
        const next = new Set(prev);
        next.delete(group.generationGroupId);
        return next;
      });
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
      alert(
        allOk
          ? `${groups.length} group(s) ${status === 'published' ? 'published' : 'unpublished'} successfully!`
          : 'Some posts failed to update'
      );
    } catch {
      alert('Failed to update posts');
    }
  };

  const batchDelete = async () => {
    const groups = getSelectedGroups();
    const allPosts = groups.flatMap(g => g.posts);
    if (!confirm(`Delete ${groups.length} group(s) (${allPosts.length} posts total)?`)) return;
    try {
      const results = await Promise.all(allPosts.map(post => adminFetch(`/api/admin/posts/${post._id}`, { method: 'DELETE' })));
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
      <div className='min-h-screen bg-ember-bg flex items-center justify-center'>
        <AdminLoading message='Loading posts...' />
      </div>
    );
  }

  return (
    <div className='page-layout !pt-0 min-h-screen bg-ember-bg'>
      {/* Header */}
      <div className='bg-ember-surface border-b border-ember-border sticky top-[var(--lab-header-offset,0px)] z-40'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex flex-wrap gap-4 justify-between items-center py-6'>
            <div>
              <h1 className='text-[length:calc(2rem*var(--display-scale,1))] leading-tight [font-weight:var(--display-weight)] tracking-[var(--display-tracking)] text-ember-text font-display'>
                Content Management
              </h1>
              <p className='mt-1 text-sm text-ember-muted'>Manage and generate blog posts for your website</p>
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
            <div className='bg-ember-surface rounded-[var(--radius)] border border-ember-border overflow-hidden'>
              <div className='bg-ember-surface2 px-6 py-4 border-b border-ember-border'>
                <h3 className='text-lg font-semibold text-ember-text flex items-center'>
                  <svg className='w-5 h-5 mr-2 text-ember-accent' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
                    ></path>
                  </svg>
                  AI Content Generator
                </h3>
                <p className='text-sm text-ember-muted mt-1'>Generate high-quality blog posts using AI</p>
              </div>

              <div className='p-6'>
                {/* Mode tabs */}
                <div className='flex space-x-1 mb-6 bg-ember-surface2 rounded-[calc(var(--radius)*0.7)] p-1'>
                  <button
                    onClick={() => setGenMode('topic')}
                    className={`flex-1 min-h-[44px] py-2 px-4 text-sm font-medium rounded-[calc(var(--radius)*0.7)] transition-colors ${genMode === 'topic' ? 'bg-ember-surface text-ember-text' : 'text-ember-muted hover:text-ember-text'}`}
                  >
                    Topic / Category
                  </button>
                  <button
                    onClick={() => setGenMode('source')}
                    className={`flex-1 min-h-[44px] py-2 px-4 text-sm font-medium rounded-[calc(var(--radius)*0.7)] transition-colors ${genMode === 'source' ? 'bg-ember-surface text-ember-text' : 'text-ember-muted hover:text-ember-text'}`}
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
                          <label className='block text-sm font-medium text-ember-muted mb-1'>Or Paste Content</label>
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
                            className='w-full rounded-[calc(var(--radius)*0.7)] px-3 py-2 text-base bg-ember-bg border border-[color:var(--border-strong)] text-ember-text placeholder:text-ember-muted focus:border-ember-accent focus:ring-2 focus:ring-[color:var(--accent)] disabled:bg-ember-surface2 disabled:text-ember-muted'
                          />
                          <p className='mt-1 text-xs text-ember-muted'>
                            {generationForm.sourceText?.length ?? 0}/5000 chars. AI will write an original post using this as context.
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className='space-y-4'>
                    <div>
                      <label className='block text-sm font-medium text-ember-muted mb-3'>Target Languages</label>
                      <div className='grid grid-cols-3 gap-3'>
                        {['en', 'ru', 'uz'].map(locale => (
                          <label
                            key={locale}
                            className='flex items-center p-3 border border-ember-border rounded-[calc(var(--radius)*0.7)] cursor-pointer hover:bg-ember-surface2 transition-colors'
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
                              className='mr-3 w-4 h-4 accent-[color:var(--accent)]'
                            />
                            <span className='text-sm font-medium text-ember-text'>{locale.toUpperCase()}</span>
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
        <div className='bg-ember-surface rounded-[var(--radius)] border border-ember-border overflow-hidden'>
          <div className='px-6 py-4 border-b border-ember-border bg-ember-surface2'>
            <div className='flex flex-wrap gap-3 justify-between items-center'>
              <div className='flex items-center space-x-4'>
                {postGroups.length > 0 && (
                  <input
                    type='checkbox'
                    checked={postGroups.length > 0 && selectedGroups.size === postGroups.length}
                    onChange={toggleAll}
                    className='w-4 h-4 accent-[color:var(--accent)] cursor-pointer'
                  />
                )}
                <div>
                  <h3 className='text-lg font-semibold text-ember-text'>
                    {selectedGroups.size > 0 ? `${selectedGroups.size} of ${postGroups.length} groups selected` : 'All Posts'}
                  </h3>
                  <p className='text-sm text-ember-muted'>
                    {posts.length} total posts in {postGroups.length} groups
                  </p>
                </div>
              </div>
              <div className='flex space-x-2'>
                <span className='inline-flex items-center px-2.5 py-1 rounded-[var(--radius)] text-xs font-medium bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] text-ember-text'>
                  {posts.filter(p => p.status === 'published').length} Published
                </span>
                <span className='inline-flex items-center px-2.5 py-1 rounded-[var(--radius)] text-xs font-medium bg-ember-surface2 text-ember-muted'>
                  {posts.filter(p => p.status === 'draft').length} Drafts
                </span>
              </div>
            </div>
          </div>

          {postGroups.length === 0 ? (
            <div className='py-16 text-center'>
              <svg className='mx-auto h-12 w-12 text-ember-muted' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                ></path>
              </svg>
              <h3 className='mt-4 text-lg font-medium text-ember-text'>No posts yet</h3>
              <p className='mt-2 text-ember-muted'>Get started by generating your first blog post.</p>
            </div>
          ) : (
            <div className='divide-y divide-ember-border'>
              {postGroups.map((group, _groupIndex) => (
                <div key={group.generationGroupId} className='p-4 sm:p-6'>
                  {/* Group Header */}
                  <div className='flex flex-wrap gap-3 justify-between items-start mb-4'>
                    <div className='flex items-center min-w-0'>
                      <input
                        type='checkbox'
                        checked={selectedGroups.has(group.generationGroupId)}
                        onChange={() => toggleGroup(group.generationGroupId)}
                        className='w-4 h-4 mr-4 accent-[color:var(--accent)] cursor-pointer flex-shrink-0'
                      />
                      <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
                        <h4 className='text-sm font-medium text-ember-text'>
                          {group.posts.length > 1 ? `Post Group (${group.posts.length} languages)` : 'Individual Post'}
                        </h4>
                        <AdminBadge variant='status' status={group.status}>
                          {group.status}
                        </AdminBadge>
                        {missingLocales(group).length > 0 && (
                          <span className='inline-flex items-center px-2.5 py-1 rounded-[var(--radius)] text-xs font-medium border border-dashed border-[color:var(--border-strong)] text-ember-text'>
                            missing:{' '}
                            {missingLocales(group)
                              .map(l => l.toUpperCase())
                              .join(', ')}
                          </span>
                        )}
                        <span className='text-xs text-ember-muted'>{format(new Date(group.createdAt), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>

                    {/* Group Actions */}
                    <div className='flex flex-wrap gap-2'>
                      {missingLocales(group).length > 0 && (
                        <button
                          onClick={() => generateMissing(group)}
                          disabled={fillingGroups.has(group.generationGroupId)}
                          className='inline-flex items-center px-3 py-1.5 min-h-[44px] border border-dashed border-[color:var(--border-strong)] text-xs font-medium rounded-[calc(var(--radius)*0.7)] text-ember-text bg-ember-surface hover:border-ember-accent transition-colors disabled:opacity-50'
                        >
                          {fillingGroups.has(group.generationGroupId) ? (
                            <>
                              <svg className='animate-spin w-4 h-4 mr-1' fill='none' viewBox='0 0 24 24'>
                                <circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
                                <path
                                  className='opacity-75'
                                  fill='currentColor'
                                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                                ></path>
                              </svg>
                              Generating…
                            </>
                          ) : (
                            <>
                              <svg className='w-4 h-4 mr-1' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth='2'
                                  d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                                ></path>
                              </svg>
                              Generate{' '}
                              {missingLocales(group)
                                .map(l => l.toUpperCase())
                                .join(', ')}
                            </>
                          )}
                        </button>
                      )}
                      {group.status !== 'published' && (
                        <button
                          onClick={() => updateGroupStatus(group, 'published')}
                          className='inline-flex items-center px-3 py-1.5 min-h-[44px] border border-transparent text-xs font-semibold rounded-[calc(var(--radius)*0.7)] text-[color:var(--on-accent)] bg-ember-accent transition-colors'
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
                          className='inline-flex items-center px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-[calc(var(--radius)*0.7)] bg-ember-surface border border-ember-border text-ember-text hover:border-ember-accent transition-colors'
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
                        className='inline-flex items-center px-3 py-1.5 min-h-[44px] border border-[color:var(--accent)] text-xs font-medium rounded-[calc(var(--radius)*0.7)] text-ember-text bg-transparent hover:bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] transition-colors'
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
                      <div
                        key={post._id}
                        className='flex flex-wrap gap-3 items-center justify-between p-4 bg-ember-surface2 rounded-[calc(var(--radius)*0.7)]'
                      >
                        <div className='flex-1 min-w-[min(100%,260px)]'>
                          <div className='flex items-center space-x-3'>
                            <AdminBadge variant='locale' locale={post.locale as 'en' | 'ru' | 'uz'}>
                              {post.locale.toUpperCase()}
                            </AdminBadge>
                            <div className='flex-1 min-w-0'>
                              <p className='text-sm font-medium text-ember-text truncate'>{post.title}</p>
                              <p className='text-xs text-ember-muted truncate'>
                                /{post.locale}/blog/{post.slug}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className='flex space-x-2'>
                          <button
                            onClick={() => openPreview(post)}
                            // Not disabled: that would drop its focus, which the dialog gives back on close.
                            aria-disabled={previewLoading}
                            className='inline-flex items-center px-3 py-1.5 min-h-[44px] border border-ember-border text-xs font-medium rounded-[calc(var(--radius)*0.7)] text-ember-text bg-ember-surface hover:border-ember-accent transition-colors aria-disabled:opacity-50'
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
                            className='inline-flex items-center px-3 py-1.5 min-h-[44px] border border-ember-border text-xs font-medium rounded-[calc(var(--radius)*0.7)] text-ember-text bg-ember-surface hover:border-ember-accent transition-colors'
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
        {selectedPost && <PostPreviewModal post={selectedPost} onClose={() => setSelectedPost(null)} />}
      </div>

      {selectedGroups.size > 0 && (
        <div className='fixed bottom-0 inset-x-0 z-50 bg-ember-surface border-t border-ember-border'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap gap-3 items-center justify-between'>
            <span className='text-sm font-medium text-ember-muted'>
              {selectedGroups.size} group(s) selected ({getSelectedGroups().flatMap(g => g.posts).length} posts)
            </span>
            <div className='flex flex-wrap items-center gap-3'>
              <button
                onClick={() => batchUpdateStatus('published')}
                className='inline-flex items-center px-4 py-2 min-h-[44px] text-sm font-semibold rounded-[calc(var(--radius)*0.7)] text-[color:var(--on-accent)] bg-ember-accent transition-colors'
              >
                Publish Selected
              </button>
              <button
                onClick={() => batchUpdateStatus('draft')}
                className='inline-flex items-center px-4 py-2 min-h-[44px] text-sm font-medium rounded-[calc(var(--radius)*0.7)] bg-ember-surface border border-ember-border text-ember-text hover:border-ember-accent transition-colors'
              >
                Unpublish Selected
              </button>
              <button
                onClick={batchDelete}
                className='inline-flex items-center px-4 py-2 min-h-[44px] text-sm font-medium rounded-[calc(var(--radius)*0.7)] border border-[color:var(--accent)] text-ember-text hover:bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] transition-colors'
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedGroups(new Set())}
                className='inline-flex items-center px-4 py-2 min-h-[44px] text-sm font-medium rounded-[calc(var(--radius)*0.7)] bg-ember-surface border border-ember-border text-ember-text hover:border-ember-accent transition-colors'
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
