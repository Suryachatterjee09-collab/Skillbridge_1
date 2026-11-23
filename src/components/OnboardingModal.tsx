import React, { useMemo, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export const OnboardingModal: React.FC = () => {
  const { profile, colleges, departments, skillsCatalog, refreshProfile, setProfile } = useAuth();
  const [collegeId, setCollegeId] = useState<number>(profile?.collegeId || colleges[0]?.id || 1);
  const [departmentId, setDepartmentId] = useState<number>(profile?.departmentId || departments[0]?.id || 1);
  const [academicYear, setAcademicYear] = useState(profile?.academicYear || '3rd Year');
  const [bio, setBio] = useState(profile?.bio || '');
  const [selectedTeachIds, setSelectedTeachIds] = useState<number[]>([]);
  const [selectedLearnIds, setSelectedLearnIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const collegeDepartments = useMemo(
    () => departments.filter((d) => d.collegeId === Number(collegeId)),
    [departments, collegeId]
  );

  if (!profile || profile.onboardingCompleted) return null;

  const toggleId = (list: number[], setList: React.Dispatch<React.SetStateAction<number[]>>, id: number) => {
    setList((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          collegeId: Number(collegeId),
          departmentId: Number(departmentId) || collegeDepartments[0]?.id,
          academicYear,
          bio: bio.trim() || 'Engineering student looking to collaborate and swap practical skills.',
          onboardingCompleted: true,
        }),
      });

      for (const skillId of selectedTeachIds) {
        await apiFetch('/api/skills/teaching', {
          method: 'POST',
          body: JSON.stringify({ skillId, level: 'Intermediate', description: 'Ready to mentor peers.' }),
        });
      }
      for (const skillId of selectedLearnIds) {
        await apiFetch('/api/skills/learning', {
          method: 'POST',
          body: JSON.stringify({ skillId, level: 'Intermediate', notes: 'Looking for study sessions.' }),
        });
      }

      await refreshProfile();
    } catch (err: any) {
      setError(err?.message || 'Failed to save onboarding details.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ onboardingCompleted: true }),
      });
      setProfile(res.profile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-[#0D1322] p-6 sm:p-8 my-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-medium text-violet-400">Welcome to SkillBridge</p>
            <h2 className="text-2xl font-display font-bold text-white mt-1">
              Set up your student exchange profile
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Choose your campus, department, and initial skills so the matching engine can rank compatible peers.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="text-xs text-slate-400 hover:text-white whitespace-nowrap shrink-0"
          >
            Skip for now
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleComplete} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">College</label>
              <select
                value={collegeId}
                onChange={(e) => {
                  const nextCollege = Number(e.target.value);
                  setCollegeId(nextCollege);
                  const firstDept = departments.find((d) => d.collegeId === nextCollege);
                  if (firstDept) setDepartmentId(firstDept.id);
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.shortName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Academic Year</label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate'].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            >
              {(collegeDepartments.length ? collegeDepartments : departments).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Short Bio</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="What are you building or studying this semester?"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-300 mb-2">Skills you can teach (select any)</p>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-1">
              {skillsCatalog.slice(0, 12).map((sk) => {
                const active = selectedTeachIds.includes(sk.id);
                return (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => toggleId(selectedTeachIds, setSelectedTeachIds, sk.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-violet-500 bg-violet-600/20 text-violet-200'
                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    <span>{sk.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-300 mb-2">Skills you want to learn (select any)</p>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-1">
              {skillsCatalog.slice(0, 12).map((sk) => {
                const active = selectedLearnIds.includes(sk.id);
                return (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => toggleId(selectedLearnIds, setSelectedLearnIds, sk.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    <span>{sk.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              <span>{saving ? 'Saving profile...' : 'Save & Start Discovering'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
