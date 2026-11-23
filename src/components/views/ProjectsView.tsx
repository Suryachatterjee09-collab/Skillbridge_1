import React, { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Users, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ProjectItem } from '../../types';
import { Avatar } from '../ui/Avatar';

export const ProjectsView: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [maxMembers, setMaxMembers] = useState(4);
  const [submitting, setSubmitting] = useState(false);

  const [applyProject, setApplyProject] = useState<ProjectItem | null>(null);
  const [applyRole, setApplyRole] = useState('Frontend Developer');
  const [applyMotivation, setApplyMotivation] = useState('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ projects: ProjectItem[] }>('/api/projects');
      setProjects(res.projects || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const requiredSkills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await apiFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ title, description, requiredSkills, maxMembers }),
      });
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setSkillsInput('');
      await loadProjects();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyProject) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/projects/${applyProject.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ role: applyRole, motivation: applyMotivation }),
      });
      setApplyProject(null);
      setApplyMotivation('');
      await loadProjects();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMemberDecision = async (
    projectId: number,
    memberId: number,
    status: 'accepted' | 'rejected'
  ) => {
    try {
      await apiFetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadProjects();
    } catch (err: any) {
      setError(err?.message || 'Failed to update applicant.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Project Collaboration</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Pitch capstone or hackathon ideas, specify required skills, and assemble balanced student teams.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Publish Project Idea</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="h-56 rounded-xl border border-slate-800 bg-[#0B1120] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((proj) => {
            const pendingApplicants = proj.members.filter((m) => m.status === 'pending');
            const acceptedMembers = proj.members.filter((m) => m.status === 'accepted');

            return (
              <div
                key={proj.id}
                className="rounded-xl border border-slate-800 bg-[#0D1424] p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-blue-400 font-medium">
                      {proj.collegeShortName} · Lead: {proj.ownerName}
                    </span>
                    <span className="font-mono text-slate-400 tabular-nums inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {proj.acceptedCount}/{proj.maxMembers} · {proj.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-display font-bold text-white">{proj.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{proj.description}</p>

                  {proj.requiredSkills.length > 0 && (
                    <p className="text-xs text-slate-400">
                      <span className="text-violet-400 font-medium">Needed:</span>{' '}
                      {proj.requiredSkills.join(' · ')}
                    </p>
                  )}

                  {/* Accepted Team Members */}
                  <div className="pt-2 flex items-center gap-2 flex-wrap">
                    {acceptedMembers.map((m) => (
                      <div
                        key={m.id}
                        className="inline-flex items-center gap-2 text-xs text-slate-300 pr-2"
                      >
                        <Avatar src={m.avatarUrl} name={m.fullName} size="xs" />
                        <span>
                          {m.fullName.split(' ')[0]} ({m.role})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Owner Application Review */}
                {proj.isOwner && pendingApplicants.length > 0 && (
                  <div className="pt-4 border-t border-slate-800 space-y-2.5">
                    <p className="text-xs font-semibold text-amber-300">
                      Pending Applications ({pendingApplicants.length})
                    </p>
                    {pendingApplicants.map((app) => (
                      <div
                        key={app.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white">
                            {app.fullName} — {app.role}
                          </p>
                          <p className="text-xs text-slate-400 truncate">{app.motivation}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMemberDecision(proj.id, app.id, 'accepted')}
                            className="rounded-md bg-emerald-600 hover:bg-emerald-500 p-1.5 text-white"
                            title="Accept applicant"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMemberDecision(proj.id, app.id, 'rejected')}
                            className="rounded-md bg-slate-800 hover:bg-rose-600 p-1.5 text-slate-300 hover:text-white"
                            title="Decline applicant"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    Posted {new Date(proj.createdAt).toLocaleDateString()}
                  </span>
                  {proj.isOwner ? (
                    <span className="text-xs font-medium text-violet-400">Your Project</span>
                  ) : proj.myStatus ? (
                    <span className="text-xs font-mono capitalize text-blue-300">
                      Application: {proj.myStatus}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setApplyProject(proj)}
                      className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white"
                    >
                      Apply to Join
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={handleCreateProject}
            className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0D1424] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white">Publish Project Idea</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Project Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Campus Energy Usage Telemetry Dashboard"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Description</label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the problem, architecture, and what collaborators will build..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-300 mb-1">Required Skills (comma-separated)</label>
                <input
                  type="text"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                  placeholder="React & TypeScript, Node.js, ESP32"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Team Size</label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white"
              >
                {submitting ? 'Publishing...' : 'Publish Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Apply Modal */}
      {applyProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={handleApply}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0D1424] p-6 space-y-4"
          >
            <h3 className="font-display font-bold text-lg text-white">
              Apply to {applyProject.title}
            </h3>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Desired Role</label>
              <input
                type="text"
                required
                value={applyRole}
                onChange={(e) => setApplyRole(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">How can you contribute?</label>
              <textarea
                rows={3}
                required
                value={applyMotivation}
                onChange={(e) => setApplyMotivation(e.target.value)}
                placeholder="Mention relevant coursework, GitHub repos, or skills..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApplyProject(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white"
              >
                Submit Application
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
