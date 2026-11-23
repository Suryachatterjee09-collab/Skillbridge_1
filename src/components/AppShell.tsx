import React, { useState } from 'react';
import {
  Bell,
  BookOpen,
  Compass,
  FolderGit2,
  Globe,
  HeartHandshake,
  LogOut,
  Menu,
  MessageSquare,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './ui/Avatar';
import { OnboardingModal } from './OnboardingModal';
import { CallOverlay } from './views/CallOverlay';
import { DiscoverView } from './views/DiscoverView';
import { MatchesView } from './views/MatchesView';
import { ChatView } from './views/ChatView';
import { LearningDashboardView } from './views/LearningDashboardView';
import { CommunitiesView } from './views/CommunitiesView';
import { ProjectsView } from './views/ProjectsView';
import { ProfileView } from './views/ProfileView';
import { AdminView } from './views/AdminView';

export type WorkspaceTab =
  | 'discover'
  | 'matches'
  | 'chat'
  | 'learning'
  | 'communities'
  | 'projects'
  | 'profile'
  | 'admin';

interface AppShellProps {
  onBackToLanding: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ onBackToLanding }) => {
  const { profile, notifications, markNotificationsRead, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('discover');
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  if (!profile) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navItems: { id: WorkspaceTab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'matches', label: 'Matches', icon: HeartHandshake },
    { id: 'chat', label: 'Messages', icon: MessageSquare },
    { id: 'learning', label: 'Learning', icon: BookOpen },
    { id: 'communities', label: 'Communities', icon: Globe },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'profile', label: 'Profile & Skills', icon: User },
  ];

  if (profile.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin', icon: ShieldCheck });
  }

  const handleOpenChat = (convId: number) => {
    setActiveConvId(convId);
    setActiveTab('chat');
  };

  const activeLabel = navItems.find((n) => n.id === activeTab)?.label || 'Workspace';

  const handleNotificationClick = (link: string) => {
    setNotifOpen(false);
    if (link.startsWith('/chat')) {
      const m = link.match(/conv=(\d+)/);
      if (m) setActiveConvId(Number(m[1]));
      setActiveTab('chat');
    } else if (link.startsWith('/matches')) {
      setActiveTab('matches');
    } else if (link.startsWith('/learning')) {
      setActiveTab('learning');
    } else if (link.startsWith('/projects')) {
      setActiveTab('projects');
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-800/80 bg-[#080D18] sticky top-0 h-screen">
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToLanding}
            className="text-lg font-display font-bold tracking-tight text-white hover:text-violet-300 transition-colors"
          >
            SkillBridge
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar src={profile.avatarUrl} name={profile.fullName} size="sm" isOnline />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{profile.fullName}</p>
              <p className="text-xs text-slate-400 truncate">
                {profile.collegeShortName} · {profile.departmentCode}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 hover:border-slate-700 py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#070B14]/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg border border-slate-800 p-2 text-slate-300 hover:text-white"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 hidden sm:inline">SkillBridge</span>
              <span className="text-slate-600 hidden sm:inline">/</span>
              <span className="font-display font-semibold text-white truncate">{activeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
              className="relative rounded-lg border border-slate-800 bg-slate-950 hover:border-slate-700 p-2 text-slate-300 hover:text-white transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-violet-600 text-[10px] font-mono font-bold text-white flex items-center justify-center px-1 tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 hover:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0"
            >
              <span>{profile.fullName.split(' ')[0]}</span>
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 rounded-xl border border-slate-800 bg-[#0D1424] shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markNotificationsRead()}
                      className="text-xs text-violet-400 hover:text-violet-300"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/70">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n.link)}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-900/80 transition-colors ${
                          !n.isRead ? 'bg-violet-600/5' : ''
                        }`}
                      >
                        <p className="text-xs font-semibold text-white">{n.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Active View Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'discover' && (
            <DiscoverView
              onOpenChat={handleOpenChat}
              onNavigateMatches={() => setActiveTab('matches')}
            />
          )}
          {activeTab === 'matches' && (
            <MatchesView
              onOpenChat={handleOpenChat}
              onNavigateDiscover={() => setActiveTab('discover')}
            />
          )}
          {activeTab === 'chat' && <ChatView initialConversationId={activeConvId} />}
          {activeTab === 'learning' && <LearningDashboardView />}
          {activeTab === 'communities' && <CommunitiesView />}
          {activeTab === 'projects' && <ProjectsView />}
          {activeTab === 'profile' && <ProfileView />}
          {activeTab === 'admin' && profile.role === 'admin' && <AdminView />}
        </main>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/75" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-[#080D18] border-r border-slate-800 flex flex-col h-full z-10">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <span className="text-lg font-display font-bold text-white">SkillBridge</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                      active ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800">
              <button
                type="button"
                onClick={logout}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 py-2 text-xs text-slate-300"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <OnboardingModal />
      <CallOverlay />
    </div>
  );
};
