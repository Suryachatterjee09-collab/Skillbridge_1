import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock, MessageSquare, Phone, Trash2, UserPlus, Video, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { MatchItem, PendingConnectionItem } from '../../types';
import { Avatar } from '../ui/Avatar';

interface MatchesViewProps {
  onOpenChat: (conversationId: number) => void;
  onNavigateDiscover: () => void;
}

export const MatchesView: React.FC<MatchesViewProps> = ({
  onOpenChat,
  onNavigateDiscover,
}) => {
  const { onlineProfileIds, startCall } = useAuth();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<PendingConnectionItem[]>([]);
  const [sentRequests, setSentRequests] = useState<PendingConnectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);
  const [busyProfileId, setBusyProfileId] = useState<number | null>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        matches: MatchItem[];
        incomingRequests?: PendingConnectionItem[];
        sentRequests?: PendingConnectionItem[];
      }>('/api/matches');
      setMatches(res.matches || []);
      setIncomingRequests(res.incomingRequests || []);
      setSentRequests(res.sentRequests || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load matches.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const handleRemove = async (matchId: number) => {
    try {
      await apiFetch(`/api/matches/${matchId}`, { method: 'DELETE' });
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
      setConfirmRemoveId(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to remove connection.');
    }
  };

  const handleRespondIncoming = async (profileId: number, action: 'like' | 'pass') => {
    setBusyProfileId(profileId);
    try {
      await apiFetch('/api/discover/action', {
        method: 'POST',
        body: JSON.stringify({ targetProfileId: profileId, action }),
      });
      await loadMatches();
    } catch (err: any) {
      setError(err?.message || 'Failed to process connection request.');
    } finally {
      setBusyProfileId(null);
    }
  };

  const handleCancelSent = async (profileId: number) => {
    setBusyProfileId(profileId);
    try {
      await apiFetch(`/api/matches/request/${profileId}`, { method: 'DELETE' });
      setSentRequests((prev) => prev.filter((r) => r.profile.id !== profileId));
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel connection request.');
    } finally {
      setBusyProfileId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-44 rounded-xl border border-slate-800 bg-[#0B1120] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Your Skill Matches</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Connections created through mutual interest. Start a conversation or live session.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 tabular-nums">
          {matches.length} {matches.length === 1 ? 'connection' : 'connections'}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {incomingRequests.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-violet-400" />
              <span>Incoming Connection Requests</span>
            </h3>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              {incomingRequests.length}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {incomingRequests.map((req) => (
              <div
                key={req.profile.id}
                className="rounded-xl border border-violet-500/30 bg-[#0D1424] p-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <Avatar
                    src={req.profile.avatarUrl}
                    name={req.profile.fullName}
                    size="md"
                    isOnline={onlineProfileIds.has(req.profile.id) || req.profile.isOnline}
                  />
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-white truncate">{req.profile.fullName}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {req.profile.collegeShortName} · {req.profile.departmentCode} · {req.compatibilityScore}% match
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyProfileId === req.profile.id}
                    onClick={() => handleRespondIncoming(req.profile.id, 'pass')}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    <X className="w-3.5 h-3.5 text-rose-400" />
                    <span>Pass</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyProfileId === req.profile.id}
                    onClick={() => handleRespondIncoming(req.profile.id, 'like')}
                    className="inline-flex items-center gap-1 rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Connect</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {matches.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0B1120] p-12 text-center max-w-lg mx-auto">
          <h3 className="text-lg font-display font-semibold text-white">No mutual matches yet</h3>
          <p className="mt-2 text-sm text-slate-400">
            Head to the Discovery feed and click Like & Connect on students whose skills complement your learning goals.
          </p>
          <button
            type="button"
            onClick={onNavigateDiscover}
            className="mt-5 rounded-lg bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Discover Students
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {matches.map((m) => {
            const isOnline = onlineProfileIds.has(m.partner.id) || m.partner.isOnline;
            return (
              <div
                key={m.id}
                className="rounded-xl border border-slate-800 bg-[#0D1424] p-6 flex flex-col justify-between gap-5"
              >
                <div className="flex items-start gap-4">
                  <Avatar src={m.partner.avatarUrl} name={m.partner.fullName} size="lg" isOnline={isOnline} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display font-semibold text-white text-lg truncate">
                          {m.partner.fullName}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {m.partner.collegeShortName} · {m.partner.departmentCode} · {m.partner.academicYear}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-semibold text-violet-400 tabular-nums">
                          {m.compatibilityScore}% match
                        </p>
                        <p className="text-xs text-slate-500 font-mono tabular-nums">
                          {new Date(m.matchedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <p className="mt-2.5 text-sm text-slate-300 line-clamp-2">{m.partner.bio}</p>

                    <div className="mt-3 text-xs text-slate-400 space-y-1">
                      <p className="truncate">
                        <span className="text-violet-400 font-medium">Teaches:</span>{' '}
                        {m.partner.teachingSkills.map((s) => s.name).join(' · ') || 'General mentoring'}
                      </p>
                      <p className="truncate">
                        <span className="text-blue-400 font-medium">Learning:</span>{' '}
                        {m.partner.learningSkills.map((s) => s.name).join(' · ') || 'Peer collaboration'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {m.conversationId && (
                      <button
                        type="button"
                        onClick={() => onOpenChat(m.conversationId!)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Message</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        startCall({
                          partnerId: m.partner.id,
                          partnerName: m.partner.fullName,
                          partnerAvatar: m.partner.avatarUrl,
                          matchId: m.id,
                          mode: 'audio',
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Audio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startCall({
                          partnerId: m.partner.id,
                          partnerName: m.partner.fullName,
                          partnerAvatar: m.partner.avatarUrl,
                          matchId: m.id,
                          mode: 'video',
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Video</span>
                    </button>
                  </div>

                  {confirmRemoveId === m.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRemove(m.id)}
                        className="rounded-lg bg-rose-600 hover:bg-rose-500 px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(null)}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(m.id)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sentRequests.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Sent Connection Requests</span>
            </h3>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              {sentRequests.length}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sentRequests.map((req) => (
              <div
                key={req.profile.id}
                className="rounded-xl border border-slate-800 bg-[#0B1120] p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={req.profile.avatarUrl}
                    name={req.profile.fullName}
                    size="md"
                    isOnline={onlineProfileIds.has(req.profile.id) || req.profile.isOnline}
                  />
                  <div className="min-w-0">
                    <p className="font-display font-medium text-white truncate">{req.profile.fullName}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {req.profile.collegeShortName} · {req.profile.departmentCode} · Pending acceptance
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyProfileId === req.profile.id}
                  onClick={() => handleCancelSent(req.profile.id)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-rose-500/40 hover:text-rose-300 shrink-0"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
