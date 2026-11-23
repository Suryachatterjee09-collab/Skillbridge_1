import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Clock, Plus, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { LearningSessionItem, MatchItem, UserSkill } from '../../types';
import { Avatar } from '../ui/Avatar';

interface DashboardData {
  teachingSkills: UserSkill[];
  learningSkills: UserSkill[];
  activePartnerships: number;
  upcomingSessions: LearningSessionItem[];
  completedSessions: LearningSessionItem[];
  allSessions: LearningSessionItem[];
}

export const LearningDashboardView: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [matchId, setMatchId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [skillTopic, setSkillTopic] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, matchRes] = await Promise.all([
        apiFetch<DashboardData>('/api/learning/dashboard'),
        apiFetch<{ matches: MatchItem[] }>('/api/matches'),
      ]);
      setData(dash);
      setMatches(matchRes.matches || []);
      if (matchRes.matches?.length && !matchId) {
        setMatchId(String(matchRes.matches[0].id));
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load learning dashboard.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/learning/sessions', {
        method: 'POST',
        body: JSON.stringify({
          matchId: Number(matchId),
          title,
          skillTopic,
          scheduledAt,
          durationMinutes: Number(durationMinutes),
          notes,
        }),
      });
      setModalOpen(false);
      setTitle('');
      setSkillTopic('');
      setNotes('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to schedule session.');
    } finally {
      setSaving(false);
    }
  };

  const updateSessionStatus = async (id: number, status: 'completed' | 'cancelled') => {
    try {
      await apiFetch(`/api/learning/sessions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update session.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-slate-800 bg-[#0B1120] animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl border border-slate-800 bg-[#0B1120] animate-pulse" />
      </div>
    );
  }

  const totalHoursCompleted = Math.round(
    ((data?.completedSessions || []).reduce((acc, s) => acc + s.durationMinutes, 0) / 60) * 10
  ) / 10;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Learning Dashboard</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Track peer sessions, active teaching exchanges, and skill milestones.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={matches.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Learning Session</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-5">
          <p className="text-xs text-slate-400">Active Partnerships</p>
          <p className="mt-1 text-2xl font-mono font-bold text-white tabular-nums">
            {data?.activePartnerships ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-5">
          <p className="text-xs text-slate-400">Upcoming Sessions</p>
          <p className="mt-1 text-2xl font-mono font-bold text-violet-400 tabular-nums">
            {data?.upcomingSessions.length ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-5">
          <p className="text-xs text-slate-400">Completed Sessions</p>
          <p className="mt-1 text-2xl font-mono font-bold text-emerald-400 tabular-nums">
            {data?.completedSessions.length ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-5">
          <p className="text-xs text-slate-400">Logged Study Hours</p>
          <p className="mt-1 text-2xl font-mono font-bold text-blue-400 tabular-nums">
            {totalHoursCompleted}h
          </p>
        </div>
      </div>

      {/* Skills Teaching & Learning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-6">
          <h3 className="font-display font-semibold text-white mb-4">Skills Currently Taught</h3>
          {data?.teachingSkills.length === 0 ? (
            <p className="text-xs text-slate-400">Add teaching skills in your Profile tab to mentor peers.</p>
          ) : (
            <div className="space-y-3">
              {data?.teachingSkills.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div>
                    <p className="text-sm font-medium text-white">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.category}</p>
                  </div>
                  <span className="text-xs font-mono text-violet-300">{s.level}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-6">
          <h3 className="font-display font-semibold text-white mb-4">Skills Currently Learned</h3>
          {data?.learningSkills.length === 0 ? (
            <p className="text-xs text-slate-400">Add learning goals in your Profile tab to track progress.</p>
          ) : (
            <div className="space-y-3">
              {data?.learningSkills.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div>
                    <p className="text-sm font-medium text-white">{s.name}</p>
                    <p className="text-xs text-slate-400">{s.category}</p>
                  </div>
                  <span className="text-xs font-mono text-blue-300">Target: {s.level}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sessions Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0B1120] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-display font-semibold text-white">Learning Sessions & History</h3>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {data?.allSessions.length ?? 0} total
          </span>
        </div>

        {!data?.allSessions.length ? (
          <div className="p-10 text-center text-sm text-slate-400">
            {matches.length === 0
              ? 'Match with a student first to schedule your first peer learning session.'
              : 'No sessions scheduled yet. Click "Schedule Learning Session" above to book a study slot.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {data.allSessions.map((s) => (
              <div
                key={s.id}
                className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-900/40"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {s.partner && <Avatar src={s.partner.avatarUrl} name={s.partner.fullName} size="sm" />}
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-sm text-white truncate">{s.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                      <span>{s.skillTopic}</span>
                      <span aria-hidden="true">·</span>
                      <span>with {s.partner?.fullName || 'Matched Peer'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(s.scheduledAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {s.durationMinutes}m
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-mono capitalize ${
                      s.status === 'completed'
                        ? 'text-emerald-400'
                        : s.status === 'cancelled'
                          ? 'text-slate-500'
                          : 'text-violet-400'
                    }`}
                  >
                    {s.status}
                  </span>
                  {s.status === 'scheduled' && (
                    <>
                      <button
                        type="button"
                        onClick={() => updateSessionStatus(s.id, 'completed')}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-300"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Complete</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSessionStatus(s.id, 'cancelled')}
                        className="rounded-lg border border-slate-800 hover:border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={handleSchedule}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0D1424] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">Schedule Peer Session</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Matched Partner</label>
              <select
                required
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.partner.fullName} ({m.partner.collegeShortName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Session Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. React Hooks & TypeScript Pair Session"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Skill Topic</label>
                <input
                  type="text"
                  required
                  value={skillTopic}
                  onChange={(e) => setSkillTopic(e.target.value)}
                  placeholder="e.g. React & TypeScript"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Duration (mins)</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Agenda / Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Topics or repo links to cover..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white"
              >
                {saving ? 'Scheduling...' : 'Send Session Invite'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
