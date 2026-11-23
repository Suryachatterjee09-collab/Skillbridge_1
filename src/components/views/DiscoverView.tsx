import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Ban,
  Check,
  ExternalLink,
  Heart,
  Info,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { DiscoveryCandidate, MatchInsight } from '../../types';
import { Avatar } from '../ui/Avatar';

interface DiscoverViewProps {
  onOpenChat: (conversationId: number) => void;
  onNavigateMatches: () => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  onOpenChat,
  onNavigateMatches,
}) => {
  const { colleges, onlineProfileIds } = useAuth();
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collegeFilter, setCollegeFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [acting, setActing] = useState(false);

  const [detailsCandidate, setDetailsCandidate] = useState<DiscoveryCandidate | null>(null);
  const [aiInsight, setAiInsight] = useState<MatchInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [matchBanner, setMatchBanner] = useState<{
    partnerName: string;
    partnerAvatar: string;
    score: number;
    conversationId: number | null;
  } | null>(null);

  const [reportTarget, setReportTarget] = useState<DiscoveryCandidate | null>(null);
  const [reportReason, setReportReason] = useState('Inappropriate behavior or spam');
  const [reportDetails, setReportDetails] = useState('');
  const [safetyMsg, setSafetyMsg] = useState<string | null>(null);

  const [passedInFilterCount, setPassedInFilterCount] = useState(0);
  const [seenAllModalOpen, setSeenAllModalOpen] = useState(false);

  const cyclePassedAndReload = useCallback(async () => {
    await apiFetch('/api/discover/reset-passes', {
      method: 'POST',
      body: JSON.stringify({
        collegeId: collegeFilter || null,
        category: categoryFilter,
      }),
    });
    const params = new URLSearchParams();
    if (collegeFilter) params.set('collegeId', collegeFilter);
    if (categoryFilter && categoryFilter !== 'All') params.set('category', categoryFilter);
    const refreshed = await apiFetch<{
      candidates: DiscoveryCandidate[];
      canUndo: boolean;
      passedInFilterCount?: number;
    }>(`/api/discover?${params.toString()}`);
    const nextCandidates = refreshed.candidates || [];
    setCandidates(nextCandidates);
    setCanUndo(Boolean(refreshed.canUndo));
    setPassedInFilterCount(refreshed.passedInFilterCount || 0);
    if (nextCandidates.length > 0) {
      setSeenAllModalOpen(true);
    }
  }, [collegeFilter, categoryFilter]);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (collegeFilter) params.set('collegeId', collegeFilter);
      if (categoryFilter && categoryFilter !== 'All') params.set('category', categoryFilter);
      const res = await apiFetch<{
        candidates: DiscoveryCandidate[];
        canUndo: boolean;
        passedInFilterCount?: number;
      }>(`/api/discover?${params.toString()}`);
      if ((res.candidates || []).length === 0 && (res.passedInFilterCount || 0) > 0) {
        await cyclePassedAndReload();
      } else {
        setCandidates(res.candidates || []);
        setCanUndo(Boolean(res.canUndo));
        setPassedInFilterCount(res.passedInFilterCount || 0);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load student recommendations.');
    } finally {
      setLoading(false);
    }
  }, [collegeFilter, categoryFilter, cyclePassedAndReload]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const current = candidates[0] || null;

  useEffect(() => {
    setAiInsight(null);
    setAiError(null);
  }, [current?.id]);

  const handleAction = async (action: 'like' | 'pass') => {
    if (!current || acting) return;
    setActing(true);
    const target = current;
    const isLastInQueue = candidates.length <= 1;

    if (!(action === 'pass' && isLastInQueue)) {
      setCandidates((prev) => prev.slice(1));
      if (action === 'pass') setCanUndo(true);
    }

    try {
      const res = await apiFetch<{
        ok: boolean;
        matched: boolean;
        pending?: boolean;
        match?: { matchId: number; conversationId: number | null; compatibilityScore: number };
      }>('/api/discover/action', {
        method: 'POST',
        body: JSON.stringify({ targetProfileId: target.id, action }),
      });

      if (res.matched && res.match) {
        setMatchBanner({
          partnerName: target.fullName,
          partnerAvatar: target.avatarUrl,
          score: res.match.compatibilityScore,
          conversationId: res.match.conversationId,
        });
      } else if (action === 'like' && res.pending) {
        setSafetyMsg(`Connection request sent to ${target.fullName}. View pending requests in Matches.`);
        setTimeout(() => setSafetyMsg(null), 4000);
      }
      setDetailsCandidate(null);

      if (action === 'pass' && isLastInQueue) {
        await cyclePassedAndReload();
      }
    } catch (err: any) {
      setError(err?.message || 'Could not record action.');
      loadCandidates();
    } finally {
      setActing(false);
    }
  };

  const handleUndo = async () => {
    if (acting) return;
    setActing(true);
    try {
      await apiFetch('/api/discover/undo', { method: 'POST' });
      await loadCandidates();
    } catch (err: any) {
      setError(err?.message || 'Nothing to undo.');
    } finally {
      setActing(false);
    }
  };

  const handleAskAi = async (candidate: DiscoveryCandidate) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiFetch<{ insight: MatchInsight }>('/api/ai/match-insights', {
        method: 'POST',
        body: JSON.stringify({ candidateId: candidate.id }),
      });
      setAiInsight(res.insight);
    } catch (err: any) {
      setAiError(err?.message || 'AI Advisor unavailable.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleBlock = async (candidate: DiscoveryCandidate) => {
    try {
      await apiFetch('/api/safety/block', {
        method: 'POST',
        body: JSON.stringify({ targetProfileId: candidate.id }),
      });
      setDetailsCandidate(null);
      setCandidates((prev) => prev.filter((c) => c.id !== candidate.id));
      setSafetyMsg(`${candidate.fullName} has been blocked.`);
      setTimeout(() => setSafetyMsg(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to block user.');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget) return;
    try {
      await apiFetch('/api/safety/report', {
        method: 'POST',
        body: JSON.stringify({
          targetProfileId: reportTarget.id,
          targetType: 'user',
          targetId: reportTarget.id,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      setReportTarget(null);
      setReportDetails('');
      setSafetyMsg('Report submitted for administrator review.');
      setTimeout(() => setSafetyMsg(null), 3500);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit report.');
    }
  };

  const categories = [
    'All',
    'Frontend & UI',
    'Backend & Cloud',
    'AI & Data Science',
    'Systems & Embedded',
    'Competitive Programming',
    'Mobile & Cross-Platform',
    'Design & Product',
    'Mechanical & Civil CAD',
  ];

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#0B1120] p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-400">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
          </div>
          <select
            value={collegeFilter}
            onChange={(e) => setCollegeFilter(e.target.value)}
            aria-label="Filter by college"
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            <option value="">All Colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName} — {c.city}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by skill category"
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'All Skill Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {candidates.length} {candidates.length === 1 ? 'peer' : 'peers'} in queue
          </span>
          <button
            type="button"
            disabled={!canUndo || acting}
            onClick={handleUndo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo Pass</span>
          </button>
        </div>
      </div>

      {safetyMsg && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
          {safetyMsg}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadCandidates} className="underline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-[520px] rounded-2xl border border-slate-800 bg-[#0B1120] animate-pulse p-6" />
          <div className="lg:col-span-5 h-[520px] rounded-2xl border border-slate-800 bg-[#0B1120] animate-pulse p-6" />
        </div>
      ) : !current ? (
        <div className="rounded-2xl border border-slate-800 bg-[#0B1120] p-12 text-center max-w-xl mx-auto">
          <h3 className="text-xl font-display font-semibold text-white">
            You have reviewed all matching students in this view
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Adjust your college or category filters, undo a recent pass, or check your mutual matches to start learning sessions.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {passedInFilterCount > 0 && (
              <button
                type="button"
                onClick={cyclePassedAndReload}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-semibold text-white"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Review from First</span>
              </button>
            )}
            {canUndo && (
              <button
                type="button"
                onClick={handleUndo}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Undo Last Pass</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setCollegeFilter('');
                setCategoryFilter('All');
              }}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={onNavigateMatches}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-900"
            >
              View Matches
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Tinder-Style Swipe Card */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.18 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_e, info) => {
                  if (info.offset.x > 110) handleAction('like');
                  else if (info.offset.x < -110) handleAction('pass');
                }}
                className="rounded-2xl border border-slate-800 bg-[#0D1424] overflow-hidden shadow-xl cursor-grab active:cursor-grabbing"
              >
                {/* Top Identity Header */}
                <div className="p-6 sm:p-8 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-5">
                  <Avatar
                    src={current.avatarUrl}
                    name={current.fullName}
                    size="xl"
                    isOnline={onlineProfileIds.has(current.id) || current.isOnline}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                          {current.fullName}
                        </h2>
                        <p className="text-sm text-slate-300 mt-0.5">
                          {current.collegeShortName} · {current.departmentCode} · {current.academicYear}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-400">Compatibility</p>
                        <p className="text-2xl font-mono font-bold text-violet-400 tabular-nums">
                          {current.compatibilityScore}%
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Experience: {current.experienceLevel} · Languages: {(current.preferredLanguages || []).join(', ')}
                    </p>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 sm:p-8 space-y-6">
                  <div>
                    <h3 className="text-xs font-medium text-slate-400 mb-1.5">About</h3>
                    <p className="text-sm text-slate-200 leading-relaxed">{current.bio}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-xs font-medium text-violet-400 mb-2.5">Can Teach</h3>
                      {current.teachingSkills.length === 0 ? (
                        <p className="text-xs text-slate-500">No teaching skills listed yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {current.teachingSkills.map((sk) => (
                            <li
                              key={sk.id}
                              className="flex items-center justify-between text-sm border-b border-slate-800/70 pb-1.5"
                            >
                              <span className="text-slate-100 font-medium">{sk.name}</span>
                              <span className="text-xs font-mono text-slate-400">{sk.level}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs font-medium text-blue-400 mb-2.5">Wants to Learn</h3>
                      {current.learningSkills.length === 0 ? (
                        <p className="text-xs text-slate-500">No learning goals listed yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {current.learningSkills.map((sk) => (
                            <li
                              key={sk.id}
                              className="flex items-center justify-between text-sm border-b border-slate-800/70 pb-1.5"
                            >
                              <span className="text-slate-100 font-medium">{sk.name}</span>
                              <span className="text-xs font-mono text-slate-400">{sk.level}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* Primary Swipe Controls */}
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => handleAction('pass')}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 py-3 px-4 text-sm font-semibold text-slate-200 transition-colors"
                    >
                      <X className="w-4 h-4 text-rose-400" />
                      <span>Pass</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDetailsCandidate(current)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 hover:bg-slate-900 py-3 px-4 text-sm font-medium text-slate-300 transition-colors"
                    >
                      <Info className="w-4 h-4" />
                      <span className="hidden sm:inline">Profile Details</span>
                    </button>

                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => handleAction('like')}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 py-3 px-4 text-sm font-semibold text-white transition-colors"
                    >
                      <Heart className="w-4 h-4" />
                      <span>Like & Connect</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Panel: Transparent Compatibility Breakdown + Gemini AI Match Advisor */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-[#0B1120] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-white">Compatibility Breakdown</h3>
                <span className="font-mono text-sm font-semibold text-violet-400 tabular-nums">
                  {current.compatibilityScore} / 100
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {[
                  { label: 'Reciprocal Skill Exchange', val: current.compatibilityBreakdown.reciprocalSkills, max: 45 },
                  { label: 'Shared Technical Domains', val: current.compatibilityBreakdown.sharedInterests, max: 15 },
                  { label: 'Aligned Learning Goals', val: current.compatibilityBreakdown.learningGoals, max: 12 },
                  { label: 'Experience Level Fit', val: current.compatibilityBreakdown.experienceFit, max: 10 },
                  { label: 'Language Compatibility', val: current.compatibilityBreakdown.languageFit, max: 10 },
                  { label: 'Availability Overlap', val: current.compatibilityBreakdown.availabilityFit, max: 8 },
                ].map((metric) => (
                  <div key={metric.label}>
                    <div className="flex items-center justify-between text-slate-300 mb-1">
                      <span>{metric.label}</span>
                      <span className="font-mono tabular-nums text-slate-400">
                        {metric.val}/{metric.max}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${Math.min(100, (metric.val / metric.max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {current.compatibilityBreakdown.matchedPairs.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-800">
                  <p className="text-xs font-medium text-slate-400 mb-2">Direct Skill Swaps</p>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {current.compatibilityBreakdown.matchedPairs.map((pair, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          <strong className="text-white">{pair.teacher}</strong> can teach{' '}
                          <strong className="text-violet-300">{pair.skill}</strong> to {pair.learner}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* AI Skill Matching Insights (Module 10) */}
            <div className="rounded-2xl border border-slate-800 bg-[#0B1120] p-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-display font-semibold text-white">AI Skill Match Advisor</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Analyzes public skill goals to suggest a joint study path.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={() => handleAskAi(current)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 hover:bg-blue-600/30 px-3 py-1.5 text-xs font-semibold text-blue-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{aiLoading ? 'Analyzing...' : aiInsight ? 'Refresh Plan' : 'Analyze Match'}</span>
                </button>
              </div>

              {aiError && (
                <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                  {aiError}
                </p>
              )}

              {aiInsight ? (
                <div className="space-y-4 mt-3 text-xs">
                  <p className="text-slate-200 leading-relaxed">{aiInsight.summary}</p>
                  {aiInsight.whyCompatible.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-400 mb-1.5">Why This Works</p>
                      <ul className="space-y-1 text-slate-300">
                        {aiInsight.whyCompatible.map((r, i) => (
                          <li key={i}>• {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiInsight.learningPath.length > 0 && (
                    <div>
                      <p className="font-medium text-slate-400 mb-1.5">Suggested 3-Session Roadmap</p>
                      <div className="space-y-2">
                        {aiInsight.learningPath.map((step, i) => (
                          <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                            <p className="font-semibold text-violet-300">
                              {step.step}: {step.focus}
                            </p>
                            <p className="text-slate-400 mt-0.5">{step.outcome}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-blue-300 font-medium">
                    First session idea: {aiInsight.starterTopic}
                  </p>
                </div>
              ) : (
                !aiLoading && (
                  <p className="text-xs text-slate-500">
                    Click "Analyze Match" to generate a tailored peer-learning path without sharing private messages or personal email.
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Details Modal */}
      {detailsCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#0D1424] p-6 sm:p-8 my-8">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-4">
                <Avatar src={detailsCandidate.avatarUrl} name={detailsCandidate.fullName} size="lg" />
                <div>
                  <h3 className="text-xl font-display font-bold text-white">
                    {detailsCandidate.fullName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    @{detailsCandidate.username} · {detailsCandidate.collegeName}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {detailsCandidate.departmentName} · {detailsCandidate.academicYear}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsCandidate(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <p className="text-slate-300">{detailsCandidate.bio}</p>

              <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs">
                <div>
                  <p className="text-slate-400">Availability</p>
                  <p className="text-white font-medium mt-0.5">
                    {(detailsCandidate.availability?.days || []).join(', ')}
                  </p>
                  <p className="text-slate-400 mt-0.5">{detailsCandidate.availability?.timeSlot}</p>
                </div>
                <div>
                  <p className="text-slate-400">Preferred Languages</p>
                  <p className="text-white font-medium mt-0.5">
                    {(detailsCandidate.preferredLanguages || []).join(', ')}
                  </p>
                </div>
              </div>

              {(detailsCandidate.githubUrl || detailsCandidate.linkedinUrl || detailsCandidate.portfolioUrl) && (
                <div className="flex flex-wrap gap-3 text-xs">
                  {detailsCandidate.githubUrl && (
                    <a
                      href={detailsCandidate.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-slate-300 hover:text-white underline"
                    >
                      GitHub <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {detailsCandidate.linkedinUrl && (
                    <a
                      href={detailsCandidate.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-slate-300 hover:text-white underline"
                    >
                      LinkedIn <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {detailsCandidate.portfolioUrl && (
                    <a
                      href={detailsCandidate.portfolioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-slate-300 hover:text-white underline"
                    >
                      Portfolio <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBlock(detailsCandidate)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 hover:border-rose-500/40 px-3 py-1.5 text-xs text-slate-400 hover:text-rose-300"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Block</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportTarget(detailsCandidate);
                      setDetailsCandidate(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 hover:border-amber-500/40 px-3 py-1.5 text-xs text-slate-400 hover:text-amber-300"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Report</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => handleAction('pass')}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Pass
                  </button>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => handleAction('like')}
                    className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Like & Connect
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-md rounded-xl border border-slate-800 bg-[#0D1424] p-6 space-y-4"
          >
            <h3 className="font-display font-bold text-white text-lg">
              Report {reportTarget.fullName}
            </h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Reason</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option>Inappropriate behavior or spam</option>
                <option>Fake college or impersonation</option>
                <option>Harassment or abusive language</option>
                <option>Misleading skills or solicitation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Additional Details</label>
              <textarea
                rows={3}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Provide context for the moderation team..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-semibold text-white"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mutual Match Modal */}
      {matchBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-violet-500/40 bg-[#0D1424] p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex justify-center">
              <Avatar src={matchBanner.partnerAvatar} name={matchBanner.partnerName} size="xl" isOnline />
            </div>
            <p className="text-xs font-medium text-violet-400">Mutual Skill Match</p>
            <h3 className="mt-1 text-2xl font-display font-bold text-white">
              You matched with {matchBanner.partnerName}
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Compatibility score:{' '}
              <span className="font-mono font-semibold text-violet-300 tabular-nums">
                {matchBanner.score}%
              </span>
              . Real-time messaging and WebRTC calling are now unlocked.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setMatchBanner(null)}
                className="flex-1 rounded-lg border border-slate-700 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Keep Discovering
              </button>
              {matchBanner.conversationId && (
                <button
                  type="button"
                  onClick={() => {
                    const cid = matchBanner.conversationId!;
                    setMatchBanner(null);
                    onOpenChat(cid);
                  }}
                  className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-500 py-2.5 text-sm font-semibold text-white"
                >
                  Start Conversation
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Seen All Students Pop-Up Modal */}
      {seenAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-violet-500/40 bg-[#0D1424] p-7 text-center shadow-2xl">
            <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-display font-bold text-white">
              You have seen all students
            </h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              You have passed through all available students in{' '}
              <span className="text-white font-medium">
                {categoryFilter === 'All' ? 'this discovery queue' : categoryFilter}
              </span>
              . We brought you back to the first student so you can review them again.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setSeenAllModalOpen(false)}
                className="flex-1 rounded-lg bg-violet-600 hover:bg-violet-500 py-2.5 px-4 text-sm font-semibold text-white transition-colors"
              >
                Back to First Student
              </button>
              {(collegeFilter !== '' || categoryFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSeenAllModalOpen(false);
                    setCollegeFilter('');
                    setCategoryFilter('All');
                  }}
                  className="flex-1 rounded-lg border border-slate-700 py-2.5 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Show All Skills
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
