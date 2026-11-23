import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Search, Shield, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { Avatar } from '../ui/Avatar';

const AVATAR_PRESETS = [
  '/src/assets/images/avatar_student_arjun_1795456799974.jpg',
  '/src/assets/images/avatar_student_priya_1795456800427.jpg',
  '/src/assets/images/avatar_student_rohan_1795456800020.jpg',
  '/src/assets/images/avatar_student_ananya_1795456800848.jpg',
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ProfileView: React.FC = () => {
  const {
    profile,
    firebaseUser,
    colleges,
    departments,
    skillsCatalog,
    setProfile,
    setSkillsCatalog,
    resendVerification,
  } = useAuth();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '');
  const [collegeId, setCollegeId] = useState<number>(profile?.collegeId || colleges[0]?.id || 1);
  const [departmentId, setDepartmentId] = useState<number>(profile?.departmentId || departments[0]?.id || 1);
  const [academicYear, setAcademicYear] = useState(profile?.academicYear || '3rd Year');
  const [experienceLevel, setExperienceLevel] = useState(profile?.experienceLevel || 'Intermediate');
  const [bio, setBio] = useState(profile?.bio || '');
  const [languagesInput, setLanguagesInput] = useState((profile?.preferredLanguages || ['English']).join(', '));
  const [days, setDays] = useState<string[]>(profile?.availability?.days || ['Mon', 'Wed', 'Sat']);
  const [timeSlot, setTimeSlot] = useState(profile?.availability?.timeSlot || 'Evening (6 PM - 9 PM)');
  const [hoursPerWeek, setHoursPerWeek] = useState(profile?.availability?.hoursPerWeek || 5);
  const [githubUrl, setGithubUrl] = useState(profile?.githubUrl || '');
  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedinUrl || '');
  const [portfolioUrl, setPortfolioUrl] = useState(profile?.portfolioUrl || '');
  const [isPublic, setIsPublic] = useState(profile?.isPublic ?? true);

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Skill management state (Module 4)
  const [skillMode, setSkillMode] = useState<'teach' | 'learn'>('teach');
  const [skillSearch, setSkillSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedSkillId, setSelectedSkillId] = useState<number>(skillsCatalog[0]?.id || 0);
  const [customSkillName, setCustomSkillName] = useState('');
  const [skillLevel, setSkillLevel] = useState('Intermediate');
  const [skillNote, setSkillNote] = useState('');

  // Blocked users state (Module 14)
  const [blockedUsers, setBlockedUsers] = useState<{ id: number; fullName: string; username: string; avatarUrl: string }[]>([]);

  useEffect(() => {
    apiFetch<{ blocked: any[] }>('/api/safety/blocks')
      .then((res) => setBlockedUsers(res.blocked || []))
      .catch(() => {});
  }, []);

  const collegeDepts = useMemo(
    () => departments.filter((d) => d.collegeId === Number(collegeId)),
    [departments, collegeId]
  );

  const filteredSkills = useMemo(() => {
    return skillsCatalog.filter((s) => {
      if (categoryFilter !== 'All' && s.category !== categoryFilter) return false;
      if (skillSearch && !s.name.toLowerCase().includes(skillSearch.toLowerCase())) return false;
      return true;
    });
  }, [skillsCatalog, categoryFilter, skillSearch]);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(skillsCatalog.map((s) => s.category)))],
    [skillsCatalog]
  );

  if (!profile) return null;

  const toggleDay = (day: string) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const preferredLanguages = languagesInput
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName,
          username,
          avatarUrl,
          collegeId: Number(collegeId),
          departmentId: Number(departmentId),
          academicYear,
          experienceLevel,
          bio,
          preferredLanguages,
          availability: { days, timeSlot, hoursPerWeek: Number(hoursPerWeek) },
          githubUrl,
          linkedinUrl,
          portfolioUrl,
          isPublic,
        }),
      });
      setProfile(res.profile);
      setStatusMsg('Profile changes saved.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const resizeImageToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (file.type === 'image/gif') {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 360;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas unavailable');
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          URL.revokeObjectURL(objectUrl);
          resolve(dataUrl);
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not decode selected image.'));
      };
      img.src = objectUrl;
    });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setStatusMsg(null);

    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
    if (!allowedTypes.has(file.type)) {
      setErrorMsg('Please select a PNG, JPG, WEBP, or GIF image from your device.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Selected image must be under 8MB.');
      return;
    }

    setUploadingPhoto(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatarUrl(dataUrl);
      const res = await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      setProfile(res.profile);
      setStatusMsg('Profile photo uploaded and saved.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to upload profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const endpoint = skillMode === 'teach' ? '/api/skills/teaching' : '/api/skills/learning';
      const payload = customSkillName.trim()
        ? {
            customName: customSkillName.trim(),
            category: categoryFilter === 'All' ? 'Backend & Cloud' : categoryFilter,
            level: skillLevel,
            description: skillNote,
            notes: skillNote,
          }
        : {
            skillId: selectedSkillId || filteredSkills[0]?.id,
            level: skillLevel,
            description: skillNote,
            notes: skillNote,
          };

      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              teachingSkills: res.teachingSkills ?? prev.teachingSkills,
              learningSkills: res.learningSkills ?? prev.learningSkills,
            }
          : prev
      );
      if (res.skillsCatalog) setSkillsCatalog(res.skillsCatalog);
      setCustomSkillName('');
      setSkillNote('');
      setStatusMsg('Skill updated.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not add skill.');
    }
  };

  const handleRemoveSkill = async (mode: 'teach' | 'learn', id: number) => {
    try {
      const endpoint = mode === 'teach' ? `/api/skills/teaching/${id}` : `/api/skills/learning/${id}`;
      const res = await apiFetch(endpoint, { method: 'DELETE' });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              teachingSkills: res.teachingSkills ?? prev.teachingSkills,
              learningSkills: res.learningSkills ?? prev.learningSkills,
            }
          : prev
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to remove skill.');
    }
  };

  const handleUnblock = async (id: number) => {
    await apiFetch(`/api/safety/block/${id}`, { method: 'DELETE' });
    setBlockedUsers((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-2xl font-display font-bold text-white">Profile & Skill Management</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Keep your teaching strengths, learning interests, and study availability accurate for higher-quality matches.
        </p>
      </div>

      {firebaseUser && !firebaseUser.emailVerified && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
          <span>Your email address ({profile.email}) is not yet verified.</span>
          <button
            type="button"
            onClick={() => resendVerification().then(() => setStatusMsg('Verification email sent.'))}
            className="rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-1.5 font-semibold text-white whitespace-nowrap shrink-0"
          >
            Resend Verification Email
          </button>
        </div>
      )}

      {statusMsg && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Profile Details Form */}
      <form onSubmit={handleSaveProfile} className="rounded-2xl border border-slate-800 bg-[#0D1424] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-slate-800">
          <Avatar src={avatarUrl} name={fullName || profile.fullName} size="xl" />
          <div className="space-y-2.5 flex-1">
            <p className="text-xs font-medium text-slate-300">Profile Portrait</p>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingPhoto ? 'Uploading...' : 'Upload from Device / Gallery'}</span>
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="rounded-lg border border-slate-800 hover:border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  Remove Photo
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-500 mr-1">Or choose preset:</span>
              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAvatarUrl(preset)}
                  className={`rounded-lg p-0.5 border ${
                    avatarUrl === preset ? 'border-violet-500' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <img src={preset} alt="Avatar preset" className="w-8 h-8 rounded-md object-cover" />
                </button>
              ))}
            </div>
            <input
              type="url"
              value={avatarUrl.startsWith('data:image/') ? '' : avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder={
                avatarUrl.startsWith('data:image/')
                  ? 'Custom device photo uploaded (or paste image URL to replace)...'
                  : 'Or paste custom avatar image URL...'
              }
              className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">College</label>
            <select
              value={collegeId}
              onChange={(e) => {
                const c = Number(e.target.value);
                setCollegeId(c);
                const first = departments.find((d) => d.collegeId === c);
                if (first) setDepartmentId(first.id);
              }}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.shortName})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Department</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {(collegeDepts.length ? collegeDepts : departments).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate'].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Overall Experience Level</label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            >
              {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-300 mb-1">Biography</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Preferred Languages (comma-separated)</label>
            <input
              type="text"
              value={languagesInput}
              onChange={(e) => setLanguagesInput(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Preferred Time Slot</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option>Morning (8 AM - 12 PM)</option>
                <option>Afternoon (2 PM - 5 PM)</option>
                <option>Evening (6 PM - 9 PM)</option>
                <option>Night (9 PM - 11 PM)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Hours / Week</label>
              <input
                type="number"
                min={1}
                max={40}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs text-slate-300 mb-2">Weekly Availability</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const active = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-violet-500 bg-violet-600/20 text-violet-200'
                      : 'border-slate-800 bg-slate-950 text-slate-400'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1">GitHub URL</label>
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">LinkedIn URL</label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">Portfolio URL</label>
            <input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-800">
          <label className="inline-flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-violet-600"
            />
            <span>Make my student profile visible in Discovery recommendations (email always stays private)</span>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>

      {/* Module 4: Skill Management */}
      <div className="rounded-2xl border border-slate-800 bg-[#0D1424] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-display font-bold text-white">Skill Management</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Search categories, add skills you teach or want to learn, or register a custom skill.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800 self-start">
            <button
              type="button"
              onClick={() => setSkillMode('teach')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                skillMode === 'teach' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              I Can Teach
            </button>
            <button
              type="button"
              onClick={() => setSkillMode('learn')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                skillMode === 'learn' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              I Want to Learn
            </button>
          </div>
        </div>

        <form onSubmit={handleAddSkill} className="rounded-xl border border-slate-800 bg-[#080D18] p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                placeholder="Search skill catalog..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 py-2 text-xs text-white"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map((lv) => (
                <option key={lv} value={lv}>
                  {skillMode === 'teach' ? `Level: ${lv}` : `Target: ${lv}`}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Select from Catalog</label>
              <select
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                {filteredSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Or Add Custom Skill Name</label>
              <input
                type="text"
                value={customSkillName}
                onChange={(e) => setCustomSkillName(e.target.value)}
                placeholder="e.g. Rust & WebAssembly"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={skillNote}
              onChange={(e) => setSkillNote(e.target.value)}
              placeholder={
                skillMode === 'teach'
                  ? 'Brief description of your mentoring experience...'
                  : 'What specific goal do you want to achieve?'
              }
              className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{skillMode === 'teach' ? 'Add Teaching Skill' : 'Add Learning Interest'}</span>
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-xs font-semibold text-violet-400 mb-3">
              Teaching Skills ({profile.teachingSkills.length})
            </h4>
            <div className="space-y-2.5">
              {profile.teachingSkills.map((sk) => (
                <div
                  key={sk.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {sk.name} <span className="text-xs font-mono text-violet-300">· {sk.level}</span>
                    </p>
                    {sk.description && <p className="text-xs text-slate-400 mt-0.5">{sk.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill('teach', sk.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Remove skill"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-blue-400 mb-3">
              Learning Interests ({profile.learningSkills.length})
            </h4>
            <div className="space-y-2.5">
              {profile.learningSkills.map((sk) => (
                <div
                  key={sk.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 flex items-start justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {sk.name} <span className="text-xs font-mono text-blue-300">· {sk.level}</span>
                    </p>
                    {sk.notes && <p className="text-xs text-slate-400 mt-0.5">{sk.notes}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill('learn', sk.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Remove skill"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Blocked Users Safety Panel */}
      {blockedUsers.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-[#0D1424] p-6">
          <h3 className="text-sm font-display font-semibold text-white inline-flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-slate-400" />
            Blocked Accounts ({blockedUsers.length})
          </h3>
          <div className="space-y-2">
            {blockedUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between border-b border-slate-800/70 pb-2 text-xs">
                <span className="text-slate-300">
                  {u.fullName} (@{u.username})
                </span>
                <button
                  type="button"
                  onClick={() => handleUnblock(u.id)}
                  className="text-violet-400 hover:text-violet-300 underline"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
