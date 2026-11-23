import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { apiFetch } from '../lib/api';
import {
  ActiveCallState,
  College,
  Department,
  IncomingCallState,
  MyProfile,
  NotificationItem,
  SkillCatalogItem,
} from '../types';

type WsEventListener = (event: any) => void;

interface AuthContextValue {
  firebaseUser: User | null;
  profile: MyProfile | null;
  colleges: College[];
  departments: Department[];
  skillsCatalog: SkillCatalogItem[];
  notifications: NotificationItem[];
  onlineProfileIds: Set<number>;
  loading: boolean;
  syncError: string | null;
  incomingCall: IncomingCallState | null;
  activeCall: ActiveCallState | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (fullName: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: React.Dispatch<React.SetStateAction<MyProfile | null>>;
  setSkillsCatalog: React.Dispatch<React.SetStateAction<SkillCatalogItem[]>>;
  refreshNotifications: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  sendWsMessage: (payload: Record<string, any>) => void;
  subscribeWs: (listener: WsEventListener) => () => void;
  startCall: (call: Omit<ActiveCallState, 'direction'>) => void;
  acceptIncomingCall: () => void;
  rejectIncomingCall: () => void;
  endActiveCall: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [skillsCatalog, setSkillsCatalog] = useState<SkillCatalogItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [onlineProfileIds, setOnlineProfileIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<WsEventListener>>(new Set());

  const refreshNotifications = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const data = await apiFetch<{ notifications: NotificationItem[] }>('/api/notifications');
      setNotifications(data.notifications || []);
    } catch {
      // Non-blocking notification fetch
    }
  }, []);

  const syncWithServer = useCallback(async (user: User) => {
    setSyncError(null);
    try {
      const data = await apiFetch<{
        profile: MyProfile;
        colleges: College[];
        departments: Department[];
        skillsCatalog: SkillCatalogItem[];
      }>('/api/auth/sync', { method: 'POST' });

      setProfile(data.profile);
      setColleges(data.colleges || []);
      setDepartments(data.departments || []);
      setSkillsCatalog(data.skillsCatalog || []);
      refreshNotifications();
    } catch (err: any) {
      setSyncError(err?.message || 'Unable to sync account with SkillBridge database.');
    }
  }, [refreshNotifications]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await syncWithServer(user);
      } else {
        setProfile(null);
        setNotifications([]);
        setOnlineProfileIds(new Set());
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      }
      setLoading(false);
    });
    return unsub;
  }, [syncWithServer]);

  // Real-time WebSocket connection
  useEffect(() => {
    if (!firebaseUser || !profile) return;

    let closedByCleanup = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;

        ws.onmessage = (evt) => {
          try {
            const payload = JSON.parse(evt.data);
            if (payload.type === 'connected' && Array.isArray(payload.onlineProfileIds)) {
              setOnlineProfileIds(new Set(payload.onlineProfileIds));
            } else if (payload.type === 'presence:update') {
              setOnlineProfileIds((prev) => {
                const next = new Set(prev);
                if (payload.online) next.add(payload.profileId);
                else next.delete(payload.profileId);
                return next;
              });
            } else if (
              payload.type === 'match:created' ||
              payload.type === 'message:new' ||
              payload.type === 'notification:new'
            ) {
              refreshNotifications();
            } else if (payload.type === 'call:offer') {
              setIncomingCall({
                fromProfileId: payload.fromProfileId,
                fromName: payload.fromName || 'Matched Peer',
                fromAvatar: payload.fromAvatar || '',
                matchId: payload.matchId,
                mode: payload.mode === 'audio' ? 'audio' : 'video',
                offer: payload.offer,
              });
            } else if (payload.type === 'call:reject' || payload.type === 'call:end') {
              setIncomingCall((curr) => (curr?.fromProfileId === payload.fromProfileId ? null : curr));
            }

            listenersRef.current.forEach((fn) => fn(payload));
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (!closedByCleanup) {
            reconnectTimer = setTimeout(connect, 3000);
          }
        };
      } catch {
        // retry silently
      }
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [firebaseUser, profile?.id, refreshNotifications]);

  const sendWsMessage = useCallback((payload: Record<string, any>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const subscribeWs = useCallback((listener: WsEventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleAuthProvider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (fullName: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (fullName.trim()) {
      await updateProfile(cred.user, { displayName: fullName.trim() });
    }
    await sendEmailVerification(cred.user);
    await syncWithServer(cred.user);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const refreshProfile = async () => {
    if (auth.currentUser) {
      await syncWithServer(auth.currentUser);
    }
  };

  const markNotificationsRead = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const startCall = (call: Omit<ActiveCallState, 'direction'>) => {
    setActiveCall({ ...call, direction: 'outgoing' });
  };

  const acceptIncomingCall = () => {
    if (!incomingCall) return;
    setActiveCall({
      partnerId: incomingCall.fromProfileId,
      partnerName: incomingCall.fromName,
      partnerAvatar: incomingCall.fromAvatar,
      matchId: incomingCall.matchId,
      mode: incomingCall.mode,
      direction: 'incoming',
      incomingOffer: incomingCall.offer,
    });
    setIncomingCall(null);
  };

  const rejectIncomingCall = () => {
    if (!incomingCall) return;
    sendWsMessage({
      type: 'call:reject',
      targetProfileId: incomingCall.fromProfileId,
      matchId: incomingCall.matchId,
    });
    setIncomingCall(null);
  };

  const endActiveCall = () => {
    if (activeCall) {
      sendWsMessage({
        type: 'call:end',
        targetProfileId: activeCall.partnerId,
        matchId: activeCall.matchId,
      });
    }
    setActiveCall(null);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        colleges,
        departments,
        skillsCatalog,
        notifications,
        onlineProfileIds,
        loading,
        syncError,
        incomingCall,
        activeCall,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resetPassword,
        resendVerification,
        logout,
        refreshProfile,
        setProfile,
        setSkillsCatalog,
        refreshNotifications,
        markNotificationsRead,
        sendWsMessage,
        subscribeWs,
        startCall,
        acceptIncomingCall,
        rejectIncomingCall,
        endActiveCall,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
