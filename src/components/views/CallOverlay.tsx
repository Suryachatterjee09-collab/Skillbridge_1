import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../ui/Avatar';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const CallOverlay: React.FC = () => {
  const {
    profile,
    incomingCall,
    activeCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endActiveCall,
    sendWsMessage,
    subscribeWs,
  } = useAuth();

  const [status, setStatus] = useState<'connecting' | 'ringing' | 'connected' | 'ended'>('connecting');
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (status !== 'connected') {
      setElapsedSec(0);
      return;
    }
    const interval = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (!activeCall || !profile) return;

    let mounted = true;
    setMediaError(null);
    setStatus(activeCall.direction === 'outgoing' ? 'ringing' : 'connecting');
    setMicMuted(false);
    setCamOff(activeCall.mode === 'audio');
    setScreenSharing(false);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendWsMessage({
          type: 'call:ice',
          targetProfileId: activeCall.partnerId,
          matchId: activeCall.matchId,
          candidate: e.candidate,
        });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
      if (mounted) setStatus('connected');
    };

    pc.onconnectionstatechange = () => {
      if (!mounted) return;
      if (pc.connectionState === 'connected') setStatus('connected');
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setStatus('ended');
      }
    };

    const initMediaAndSignal = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: activeCall.mode === 'video',
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        if (activeCall.direction === 'outgoing') {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendWsMessage({
            type: 'call:offer',
            targetProfileId: activeCall.partnerId,
            matchId: activeCall.matchId,
            mode: activeCall.mode,
            fromName: profile.fullName,
            fromAvatar: profile.avatarUrl,
            offer,
          });
        } else if (activeCall.incomingOffer) {
          await pc.setRemoteDescription(new RTCSessionDescription(activeCall.incomingOffer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendWsMessage({
            type: 'call:answer',
            targetProfileId: activeCall.partnerId,
            matchId: activeCall.matchId,
            answer,
          });
          setStatus('connected');
        }
      } catch (err: any) {
        setMediaError(
          err?.message || 'Camera/microphone permission was denied or unavailable on this device.'
        );
      }
    };

    initMediaAndSignal();

    const unsub = subscribeWs(async (msg: any) => {
      if (msg.fromProfileId !== activeCall.partnerId) return;
      if (msg.type === 'call:answer' && msg.answer) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
          setStatus('connected');
        } catch {
          // ignore
        }
      } else if (msg.type === 'call:ice' && msg.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch {
          // ignore
        }
      } else if (msg.type === 'call:reject' || msg.type === 'call:end') {
        endActiveCall();
      }
    });

    return () => {
      mounted = false;
      unsub();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      pc.close();
      pcRef.current = null;
    };
  }, [activeCall, profile]);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micMuted;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setMicMuted(next);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camOff;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
    setCamOff(next);
  };

  const toggleScreenShare = async () => {
    if (!pcRef.current) return;
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && camTrack) await sender.replaceTrack(camTrack);
      setScreenSharing(false);
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenTrack);
      } else {
        pcRef.current.addTrack(screenTrack, screenStream);
      }
      screenTrack.onended = () => setScreenSharing(false);
      setScreenSharing(true);
    } catch {
      // User cancelled screen picker
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Incoming Call Toast Banner
  if (incomingCall && !activeCall) {
    return (
      <div className="fixed bottom-5 right-5 z-50 w-80 rounded-xl border border-violet-500/40 bg-[#0E1629] p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <Avatar src={incomingCall.fromAvatar} name={incomingCall.fromName} size="md" isOnline />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-violet-400 font-medium">
              Incoming {incomingCall.mode === 'video' ? 'Video' : 'Audio'} Call
            </p>
            <p className="font-display font-semibold text-white truncate">{incomingCall.fromName}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={rejectIncomingCall}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 py-2 text-xs font-semibold text-rose-200 transition-colors"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            Decline
          </button>
          <button
            type="button"
            onClick={acceptIncomingCall}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-semibold text-white transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            Accept
          </button>
        </div>
      </div>
    );
  }

  if (!activeCall) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-[#0A101D] overflow-hidden shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar src={activeCall.partnerAvatar} name={activeCall.partnerName} size="sm" isOnline />
            <div>
              <h3 className="font-display font-semibold text-white">{activeCall.partnerName}</h3>
              <p className="text-xs text-slate-400 font-mono tabular-nums">
                {activeCall.mode === 'video' ? 'Video Session' : 'Audio Session'} ·{' '}
                {status === 'connected' ? formatDuration(elapsedSec) : status === 'ringing' ? 'Ringing peer...' : 'Connecting...'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={endActiveCall}
            aria-label="Close call window"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative bg-[#060911] h-[360px] sm:h-[440px] flex items-center justify-center">
          {mediaError ? (
            <div className="max-w-md text-center p-6">
              <p className="text-sm text-rose-300 font-medium">{mediaError}</p>
              <p className="text-xs text-slate-400 mt-2">
                Ensure browser microphone/camera permissions are allowed for SkillBridge.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${activeCall.mode === 'audio' ? 'hidden' : ''}`}
              />
              {activeCall.mode === 'audio' && (
                <div className="text-center">
                  <Avatar src={activeCall.partnerAvatar} name={activeCall.partnerName} size="xl" />
                  <p className="mt-4 font-display font-semibold text-white text-lg">
                    {activeCall.partnerName}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                    {status === 'connected' ? `Live audio · ${formatDuration(elapsedSec)}` : 'Waiting for peer to connect...'}
                  </p>
                </div>
              )}

              {activeCall.mode === 'video' && (
                <div className="absolute bottom-4 right-4 w-36 sm:w-44 aspect-video rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-xl">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={toggleMic}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${
              micMuted
                ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{micMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {activeCall.mode === 'video' && (
            <>
              <button
                type="button"
                onClick={toggleCam}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${
                  camOff
                    ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                {camOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                <span>{camOff ? 'Camera Off' : 'Camera On'}</span>
              </button>

              <button
                type="button"
                onClick={toggleScreenShare}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${
                  screenSharing
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                <MonitorUp className="w-4 h-4" />
                <span>{screenSharing ? 'Stop Share' : 'Share Screen'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={endActiveCall}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-500 px-5 py-2.5 text-xs font-semibold text-white transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
