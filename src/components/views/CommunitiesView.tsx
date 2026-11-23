import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, MessageSquarePlus, Users } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { CommunityItem } from '../../types';
import { Avatar } from '../ui/Avatar';

export const CommunitiesView: React.FC = () => {
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'discussion' | 'resource' | 'study_partner'>('discussion');
  const [resourceUrl, setResourceUrl] = useState('');
  const [posting, setPosting] = useState(false);

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ communities: CommunityItem[] }>('/api/communities');
      const list = res.communities || [];
      setCommunities(list);
      setSelectedId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0]?.id || null));
    } catch (err: any) {
      setError(err?.message || 'Unable to load communities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  const active = communities.find((c) => c.id === selectedId) || null;

  const handleToggleJoin = async (id: number) => {
    try {
      await apiFetch(`/api/communities/${id}/join`, { method: 'POST' });
      await loadCommunities();
    } catch (err: any) {
      setError(err?.message || 'Failed to update membership.');
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || posting) return;
    setPosting(true);
    setError(null);
    try {
      await apiFetch(`/api/communities/${active.id}/posts`, {
        method: 'POST',
        body: JSON.stringify({ title, content, postType, resourceUrl }),
      });
      setTitle('');
      setContent('');
      setResourceUrl('');
      await loadCommunities();
    } catch (err: any) {
      setError(err?.message || 'Failed to create post.');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return <div className="h-96 rounded-2xl border border-slate-800 bg-[#0B1120] animate-pulse" />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Community Directory */}
      <aside className="lg:col-span-4 space-y-3">
        <div className="mb-2">
          <h2 className="text-xl font-display font-bold text-white">Campus Communities</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Department hubs across BUIE and partner colleges.
          </p>
        </div>

        {communities.map((c) => {
          const isSelected = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left rounded-xl border p-4 transition-colors ${
                isSelected
                  ? 'border-violet-500/60 bg-violet-600/10'
                  : 'border-slate-800 bg-[#0B1120] hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-blue-400 font-medium">
                  {c.collegeName} · {c.departmentCode}
                </span>
                <span className="text-xs font-mono text-slate-400 tabular-nums inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {c.memberCount}
                </span>
              </div>
              <h3 className="mt-1 font-display font-semibold text-white text-sm">{c.name}</h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">{c.description}</p>
            </button>
          );
        })}
      </aside>

      {/* Active Community Feed */}
      <section className="lg:col-span-8 space-y-5">
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {active && (
          <>
            <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-blue-400 font-medium">
                  {active.collegeName} · {active.departmentCode} · {active.memberCount} members
                </p>
                <h3 className="text-xl font-display font-bold text-white mt-1">{active.name}</h3>
                <p className="text-sm text-slate-400 mt-1">{active.description}</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleJoin(active.id)}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active.isMember
                    ? 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                    : 'bg-violet-600 hover:bg-violet-500 text-white'
                }`}
              >
                {active.isMember ? 'Joined (Leave)' : 'Join Community'}
              </button>
            </div>

            {/* Post Composer */}
            <form
              onSubmit={handlePost}
              className="rounded-xl border border-slate-800 bg-[#0B1120] p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-semibold text-slate-300 inline-flex items-center gap-1.5">
                  <MessageSquarePlus className="w-4 h-4 text-violet-400" />
                  Post to {active.name}
                </span>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800">
                  {[
                    { id: 'discussion', label: 'Discussion' },
                    { id: 'resource', label: 'Resource' },
                    { id: 'study_partner', label: 'Study Partner' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPostType(tab.id as any)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        postType === tab.id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post headline..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
              />
              <textarea
                rows={2}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share notes, ask a technical question, or look for a study partner..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
              />
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <input
                  type="url"
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="Optional resource link (https://...)"
                  className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={posting}
                  className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                >
                  {posting ? 'Publishing...' : 'Publish Post'}
                </button>
              </div>
            </form>

            {/* Posts List */}
            <div className="space-y-4">
              {active.posts.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-8 text-center text-sm text-slate-400">
                  No posts in this community yet. Start the first discussion above!
                </div>
              ) : (
                active.posts.map((post) => (
                  <article
                    key={post.id}
                    className="rounded-xl border border-slate-800 bg-[#0D1424] p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={post.authorAvatar} name={post.authorName} size="sm" />
                        <div>
                          <p className="text-sm font-semibold text-white">{post.authorName}</p>
                          <p className="text-xs text-slate-400">
                            {post.authorYear || 'Student'} ·{' '}
                            {post.postType === 'study_partner'
                              ? 'Study Partner Request'
                              : post.postType === 'resource'
                                ? 'Learning Resource'
                                : 'Technical Discussion'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-mono text-slate-500 tabular-nums">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="font-display font-semibold text-white text-base">{post.title}</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">{post.content}</p>

                    {post.resourceUrl && (
                      <a
                        href={post.resourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 underline"
                      >
                        <span>Open shared resource</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
