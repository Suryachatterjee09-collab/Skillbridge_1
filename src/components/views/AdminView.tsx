import React, { useCallback, useEffect, useState } from 'react';
import { Building2, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface AdminOverview {
  stats: {
    totalStudents: number;
    totalColleges: number;
    totalMatches: number;
    totalMessages: number;
    totalProjects: number;
    openReports: number;
  };
  colleges: { id: number; name: string; shortName: string; city: string; state: string; domain: string | null }[];
  students: {
    id: number;
    fullName: string;
    username: string;
    role: string;
    academicYear: string;
    isSuspended: boolean;
    createdAt: string;
  }[];
  reports: {
    id: number;
    reporterName: string;
    targetName: string;
    targetType: string;
    reason: string;
    details: string;
    status: string;
    createdAt: string;
  }[];
}

export const AdminView: React.FC = () => {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [collegeName, setCollegeName] = useState('');
  const [shortName, setShortName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('West Bengal');
  const [domain, setDomain] = useState('');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<AdminOverview>('/api/admin/overview');
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Admin access denied or failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleReportAction = async (id: number, status: 'resolved' | 'dismissed') => {
    await apiFetch(`/api/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadOverview();
  };

  const handleToggleSuspend = async (id: number, current: boolean) => {
    await apiFetch(`/api/admin/users/${id}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ isSuspended: !current }),
    });
    await loadOverview();
  };

  const handleAddCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/colleges', {
        method: 'POST',
        body: JSON.stringify({ name: collegeName, shortName, city, state, domain }),
      });
      setCollegeName('');
      setShortName('');
      setCity('');
      setDomain('');
      await loadOverview();
    } catch (err: any) {
      setError(err?.message || 'Failed to add college.');
    }
  };

  if (loading) {
    return <div className="h-96 rounded-2xl border border-slate-800 bg-[#0B1120] animate-pulse" />;
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
        {error || 'Unable to load administrator console.'}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-display font-bold text-white">Administration Console</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Platform telemetry, safety moderation queue, account governance, and verified college registry.
        </p>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Students', value: data.stats.totalStudents },
          { label: 'Colleges', value: data.stats.totalColleges },
          { label: 'Matches', value: data.stats.totalMatches },
          { label: 'Messages', value: data.stats.totalMessages },
          { label: 'Projects', value: data.stats.totalProjects },
          { label: 'Open Reports', value: data.stats.openReports },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-800 bg-[#0B1120] p-4">
            <p className="text-xs text-slate-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-mono font-bold text-white tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Reports Queue */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1424] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h3 className="font-display font-semibold text-white">Moderation & User Reports</h3>
        </div>
        {data.reports.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No reports filed.</div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {data.reports.map((r) => (
              <div key={r.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {r.reason} <span className="text-xs font-mono text-amber-400">({r.status})</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Target: {r.targetName} ({r.targetType}) · Reported by {r.reporterName}
                  </p>
                  {r.details && <p className="text-xs text-slate-300 mt-1">{r.details}</p>}
                </div>
                {r.status === 'open' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReportAction(r.id, 'resolved')}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReportAction(r.id, 'dismissed')}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Account Moderation */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-[#0B1120] overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h3 className="font-display font-semibold text-white">Student Accounts</h3>
          </div>
          <div className="divide-y divide-slate-800/70 max-h-96 overflow-y-auto">
            {data.students.map((st) => (
              <div key={st.id} className="px-6 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {st.fullName}{' '}
                    <span className="text-xs font-mono text-slate-400">@{st.username}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {st.role} · {st.academicYear} · {st.isSuspended ? 'Suspended' : 'Active'}
                  </p>
                </div>
                {st.role !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleToggleSuspend(st.id, st.isSuspended)}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium shrink-0 ${
                      st.isSuspended
                        ? 'border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                        : 'border border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
                    }`}
                  >
                    {st.isSuspended ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                    <span>{st.isSuspended ? 'Reinstate' : 'Suspend'}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Add College */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-[#0D1424] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-violet-400" />
            <h3 className="font-display font-semibold text-white">Manage Colleges</h3>
          </div>

          <ul className="space-y-1.5 text-xs text-slate-300 border-b border-slate-800 pb-4">
            {data.colleges.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span>
                  {c.name} ({c.shortName})
                </span>
                <span className="text-slate-500">{c.city}</span>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAddCollege} className="space-y-3">
            <p className="text-xs font-medium text-slate-300">Add Partner College</p>
            <input
              type="text"
              required
              value={collegeName}
              onChange={(e) => setCollegeName(e.target.value)}
              placeholder="Full institution name"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="Abbrev (e.g. KGEC)"
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="Domain (optional)"
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 py-2 text-xs font-semibold text-white"
            >
              Register College
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
