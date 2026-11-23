import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './components/LandingPage';
import { AuthModal } from './components/AuthModal';
import { AppShell } from './components/AppShell';

const SkillBridgeRouter: React.FC = () => {
  const { firebaseUser, profile, loading, syncError, refreshProfile, logout } = useAuth();
  const [showWorkspace, setShowWorkspace] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'register'>('signin');

  const openAuth = (mode: 'signin' | 'register' = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-3 text-center">
          <p className="text-xl font-display font-bold text-white">SkillBridge</p>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full w-1/2 bg-violet-600 rounded-full animate-pulse" />
          </div>
          <p className="text-xs text-slate-400">Loading your student workspace...</p>
        </div>
      </div>
    );
  }

  if (firebaseUser && syncError) {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-rose-500/30 bg-[#0D1424] p-6 text-center space-y-4">
          <h2 className="text-lg font-display font-bold text-white">Account Sync Issue</h2>
          <p className="text-sm text-rose-200">{syncError}</p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={refreshProfile}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white"
            >
              Retry Connection
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (firebaseUser && profile && showWorkspace) {
    return <AppShell onBackToLanding={() => setShowWorkspace(false)} />;
  }

  return (
    <>
      <LandingPage
        isAuthenticated={Boolean(firebaseUser && profile)}
        onOpenAuth={openAuth}
        onEnterWorkspace={() => setShowWorkspace(true)}
      />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setShowWorkspace(true);
        }}
        initialMode={authModalMode}
      />
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <SkillBridgeRouter />
    </AuthProvider>
  );
}
