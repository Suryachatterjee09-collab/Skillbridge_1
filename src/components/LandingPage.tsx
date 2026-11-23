import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Layers, MessageSquare, ShieldCheck, Users, Video } from 'lucide-react';
import { PublicProfile, SkillCatalogItem } from '../types';
import { Avatar } from './ui/Avatar';

interface LandingData {
  stats: {
    students: number;
    colleges: number;
    skills: number;
    matches: number;
    sessions: number;
  };
  featuredSkills: SkillCatalogItem[];
  featuredStudents: PublicProfile[];
}

interface LandingPageProps {
  onOpenAuth: (mode?: 'signin' | 'register') => void;
  isAuthenticated: boolean;
  onEnterWorkspace: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAuth,
  isAuthenticated,
  onEnterWorkspace,
}) => {
  const [data, setData] = useState<LandingData | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  useEffect(() => {
    fetch('/api/public/landing')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  const handlePrimaryAction = () => {
    if (isAuthenticated) {
      onEnterWorkspace();
    } else {
      onOpenAuth('signin');
    }
  };

  const testimonials = [
    {
      name: 'Arjun Chatterjee',
      role: '3rd Year CSE · Bankura Unnayani Institute of Engineering (BUIE)',
      quote:
        'Before SkillBridge, finding someone on campus who actually wanted to trade PyTorch fundamentals for React TypeScript took weeks of asking around. Within two days I matched with a 4th-year IT peer and shipped our semester project together.',
    },
    {
      name: 'Priya Sen',
      role: '4th Year IT · Bankura Unnayani Institute of Engineering (BUIE)',
      quote:
        'Teaching backend FastAPI pipelines to juniors while learning Figma design systems in return cut our hackathon prep time in half. Every session feels focused because both sides are invested.',
    },
    {
      name: 'Sourav Mondal',
      role: '4th Year CSE · Jadavpur University',
      quote:
        'Cross-college matching opened up study sessions outside my own department. Pairing over built-in WebRTC calls and sharing code snippets directly after matching keeps momentum high.',
    },
  ];

  const howItWorks = [
    {
      num: '01.',
      title: 'Map what you teach and what you want to learn',
      desc: 'Build a verified student profile listing your academic department, experience levels, preferred languages, and weekly study availability.',
    },
    {
      num: '02.',
      title: 'Swipe on transparent compatibility matches',
      desc: 'Review candidate cards scored across reciprocal skill overlap, availability, and shared engineering interests—with optional AI roadmap insights.',
    },
    {
      num: '03.',
      title: 'Connect only on mutual interest',
      desc: 'Zero cold spam. Conversations unlock only when both students independently express interest, keeping every exchange intentional and safe.',
    },
    {
      num: '04.',
      title: 'Chat, call, and schedule peer sessions',
      desc: 'Collaborate in real-time messaging with file sharing, jump onto live WebRTC audio/video calls, and track completed learning sessions.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070B14]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          {/* Zone 1: Single clean wordmark */}
          <a
            href="#top"
            className="text-xl font-display font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            SkillBridge
          </a>

          {/* Zone 2: 4 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a href="#how-it-works" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#skills" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Featured Skills
            </a>
            <a href="#benefits" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Peer Learning
            </a>
            <a href="#stories" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Student Stories
            </a>
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
            >
              {isAuthenticated ? 'Open Workspace' : 'Discover Students'}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split Section */}
        <section className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-medium text-blue-400 mb-3">
                Launching at Bankura Unnayani Institute of Engineering (BUIE) · Multi-College Network
              </p>
              <h1
                className="font-display font-bold tracking-tight text-white leading-[1.08] mb-5"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.75rem)', textWrap: 'balance' }}
              >
                Find Your Match. Share Your Skills. Grow Together.
              </h1>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl mb-8">
                SkillBridge pairs college students through reciprocal skill matching, real-time messaging, live audio and video calls, and project team formation—turning every campus into a collaborative studio.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-6 py-3 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{isAuthenticated ? 'Enter Discovery Feed' : 'Discover Students'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                {!isAuthenticated && (
                  <button
                    type="button"
                    onClick={() => onOpenAuth('register')}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 hover:border-slate-500 bg-slate-900/60 px-5 py-3 text-sm font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    Create Student Account
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] rounded-xl overflow-hidden border border-slate-800 bg-[#0D1322]">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_campus_collaboration_1795456799819.jpg"
                    alt="Engineering students collaborating around laptops and design notebooks in a campus studio"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-900 via-[#0E1629] to-violet-950/40 flex items-center justify-center p-8 text-center">
                    <div>
                      <Users className="w-10 h-10 text-violet-400 mx-auto mb-3" />
                      <p className="font-display font-semibold text-white">BUIE & Partner Campus Studio</p>
                      <p className="text-sm text-slate-400 mt-1">Peer-to-peer technical mentorship and project teams</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#070B14]/90 via-[#070B14]/25 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-blue-300">BUIE Innovation Hub · Live Directory</p>
                    <p className="text-base font-display font-semibold text-white mt-0.5">
                      Reciprocal Skill Exchange Across Engineering Departments
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width Platform Statistics Row */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 border border-slate-800/90 rounded-xl bg-[#0B1120] divide-y sm:divide-y-0 sm:divide-x divide-slate-800/90">
            <div className="p-6">
              <p className="text-xs text-slate-400">Active Student Profiles</p>
              <p className="mt-1.5 text-2xl sm:text-3xl font-mono font-semibold text-white tabular-nums">
                {data?.stats?.students ?? 8}
              </p>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-400">Indexed Peer Skills</p>
              <p className="mt-1.5 text-2xl sm:text-3xl font-mono font-semibold text-white tabular-nums">
                {data?.stats?.skills ?? 20}
              </p>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-400">Partner Engineering Colleges</p>
              <p className="mt-1.5 text-2xl sm:text-3xl font-mono font-semibold text-white tabular-nums">
                {data?.stats?.colleges ?? 4}
              </p>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-400">Matching Architecture</p>
              <p className="mt-1.5 text-2xl sm:text-3xl font-mono font-semibold text-violet-400 tabular-nums">
                100% Mutual
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="border-t border-slate-800/70 bg-[#090E1A]">
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="max-w-2xl mb-12">
              <h2 className="text-3xl font-display font-bold tracking-tight text-white">
                How SkillBridge Works
              </h2>
              <p className="mt-3 text-slate-400 text-base">
                Structured peer matching replaces noisy group chats with clear compatibility signals and focused 1-on-1 collaboration.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {howItWorks.map((item) => (
                <div
                  key={item.num}
                  className="rounded-xl border border-slate-800 bg-[#0D1424] p-6 flex flex-col justify-between"
                >
                  <div>
                    <span className="font-mono text-sm font-semibold text-violet-400">{item.num}</span>
                    <h3 className="mt-3 text-lg font-display font-semibold text-white leading-snug">
                      {item.title}
                    </h3>
                    <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured Skills & Live Community Profiles */}
        <section id="skills" className="border-t border-slate-800/70">
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h2 className="text-3xl font-display font-bold tracking-tight text-white">
                  Featured Skills & Campus Builders
                </h2>
                <p className="mt-2 text-slate-400 max-w-2xl">
                  From full-stack TypeScript and PyTorch to ESP32 embedded systems—find peers ready to swap real engineering skills.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-400 hover:text-violet-300 whitespace-nowrap shrink-0"
              >
                <span>Browse all skills</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

            {/* Clean unboxed skills directory grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              {(data?.featuredSkills || []).slice(0, 8).map((sk) => (
                <div
                  key={sk.id}
                  className="rounded-xl border border-slate-800/90 bg-[#0B1120] p-4 hover:border-slate-700 transition-colors"
                >
                  <p className="text-xs text-blue-400 font-medium">{sk.category}</p>
                  <h3 className="mt-1 font-display font-semibold text-white">{sk.name}</h3>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">{sk.description}</p>
                </div>
              ))}
            </div>

            {/* Student Previews */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(data?.featuredStudents || []).map((st) => (
                <div
                  key={st.id}
                  className="rounded-xl border border-slate-800 bg-[#0D1424] p-6 flex flex-col sm:flex-row gap-5"
                >
                  <Avatar src={st.avatarUrl} name={st.fullName} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-semibold text-white truncate">{st.fullName}</h3>
                      <span className="text-xs font-mono text-slate-400 shrink-0">{st.academicYear}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {st.collegeShortName} · {st.departmentCode} · {st.experienceLevel}
                    </p>
                    <p className="mt-2.5 text-sm text-slate-300 line-clamp-2">{st.bio}</p>
                    <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400 space-y-1">
                      <p className="truncate">
                        <span className="text-violet-400 font-medium">Teaches:</span>{' '}
                        {st.teachingSkills.map((s) => s.name).join(' · ') || 'Engineering fundamentals'}
                      </p>
                      <p className="truncate">
                        <span className="text-blue-400 font-medium">Learning:</span>{' '}
                        {st.learningSkills.map((s) => s.name).join(' · ') || 'Systems architecture'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits of Peer-to-Peer Learning */}
        <section id="benefits" className="border-t border-slate-800/70 bg-[#090E1A]">
          <div className="max-w-7xl mx-auto px-6 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              <div className="lg:col-span-5">
                <h2 className="text-3xl font-display font-bold tracking-tight text-white" style={{ textWrap: 'balance' }}>
                  Why Peer-to-Peer Learning Outperforms Passive Tutorials
                </h2>
                <p className="mt-4 text-slate-400 leading-relaxed">
                  Students retain far more when they explain concepts to a teammate and ship real projects together. SkillBridge builds accountability directly into your campus schedule.
                </p>
                <div className="mt-8 space-y-4">
                  {[
                    'Mutual matching prevents unsolicited messages and keeps interactions high-signal.',
                    'Built-in real-time chat, file sharing, and WebRTC video calling—no external links needed.',
                    'College and department communities starting at BUIE, open to cross-campus projects.',
                    'Privacy-first design: personal email addresses are never exposed publicly.',
                  ].map((point) => (
                    <div key={point} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-violet-400 shrink-0 mt-1" />
                      <span className="text-sm text-slate-300">{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-6">
                  <Layers className="w-5 h-5 text-violet-400 mb-3" />
                  <h3 className="font-display font-semibold text-white">Transparent Compatibility</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    Every match score breaks down reciprocal skills, overlapping study hours, and shared languages—backed by optional Gemini learning roadmaps.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-6">
                  <MessageSquare className="w-5 h-5 text-blue-400 mb-3" />
                  <h3 className="font-display font-semibold text-white">Real-Time Collaboration</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    Instant WebSocket messaging with typing indicators, read receipts, and validated image or PDF study note attachments.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-6">
                  <Video className="w-5 h-5 text-violet-400 mb-3" />
                  <h3 className="font-display font-semibold text-white">Live Audio & Video Rooms</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    Launch peer-to-peer WebRTC voice or video calls with screen sharing directly inside any matched conversation.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#0D1424] p-6">
                  <ShieldCheck className="w-5 h-5 text-blue-400 mb-3" />
                  <h3 className="font-display font-semibold text-white">Campus Safety & Moderation</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    One-click block controls, report workflows, rate-limited actions, and verified role-based moderation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="stories" className="border-t border-slate-800/70">
          <div className="max-w-7xl mx-auto px-6 py-20">
            <h2 className="text-3xl font-display font-bold tracking-tight text-white mb-10">
              Student Stories
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <blockquote
                  key={t.name}
                  className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 flex flex-col justify-between"
                >
                  <p className="text-sm text-slate-300 leading-relaxed">"{t.quote}"</p>
                  <footer className="mt-6 pt-4 border-t border-slate-800/80">
                    <p className="font-display font-semibold text-white text-sm">{t.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.role}</p>
                  </footer>
                </blockquote>
              ))}
            </div>

            <div className="mt-14 rounded-xl border border-slate-800 bg-[#0D1424] p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-display font-bold text-white">
                  Ready to swap skills with peers across campus?
                </h3>
                <p className="mt-1.5 text-sm text-slate-400">
                  Join BUIE and partner college students building projects and learning together.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-6 py-3 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0"
              >
                <span>{isAuthenticated ? 'Go to Workspace' : 'Discover Students'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 bg-[#060911]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-display font-semibold text-slate-300">SkillBridge</span>
            <span aria-hidden="true">·</span>
            <span>BUIE & Inter-College Skill Exchange</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#how-it-works" className="hover:text-slate-300">How It Works</a>
            <a href="#skills" className="hover:text-slate-300">Skills</a>
            <a href="#benefits" className="hover:text-slate-300">Safety</a>
            <button type="button" onClick={handlePrimaryAction} className="hover:text-slate-300">
              {isAuthenticated ? 'Workspace' : 'Sign In'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
