import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCheck,
  FileText,
  Paperclip,
  Phone,
  Send,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import { ChatMessage, ConversationSummary } from '../../types';
import { Avatar } from '../ui/Avatar';

interface ChatViewProps {
  initialConversationId?: number | null;
}

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
]);

export const ChatView: React.FC<ChatViewProps> = ({ initialConversationId }) => {
  const { profile, onlineProfileIds, sendWsMessage, subscribeWs, startCall } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(initialConversationId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<{
    dataUrl: string;
    name: string;
    type: string;
    size: number;
  } | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingPartnerId, setTypingPartnerId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await apiFetch<{ conversations: ConversationSummary[] }>('/api/conversations');
      const list = res.conversations || [];
      setConversations(list);
      setSelectedConvId((prev) => {
        if (initialConversationId && list.some((c) => c.id === initialConversationId)) {
          return initialConversationId;
        }
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id || null;
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to load conversations.');
    } finally {
      setLoadingConvs(false);
    }
  }, [initialConversationId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const activeConv = conversations.find((c) => c.id === selectedConvId) || null;

  const loadMessages = useCallback(async (convId: number) => {
    setLoadingMsgs(true);
    setError(null);
    try {
      const res = await apiFetch<{ messages: ChatMessage[] }>(`/api/conversations/${convId}/messages`);
      setMessages(res.messages || []);
      await apiFetch(`/api/conversations/${convId}/read`, { method: 'POST' });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to load messages.');
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConvId) {
      loadMessages(selectedConvId);
    } else {
      setMessages([]);
    }
  }, [selectedConvId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, typingPartnerId]);

  useEffect(() => {
    const unsub = subscribeWs((evt) => {
      if (evt.type === 'message:new' && evt.message) {
        const incoming: ChatMessage = evt.message;
        if (incoming.conversationId === selectedConvId) {
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          if (incoming.senderId !== profile?.id) {
            apiFetch(`/api/conversations/${selectedConvId}/read`, { method: 'POST' }).catch(() => {});
          }
        }
        loadConversations();
      } else if (evt.type === 'message:read' && evt.conversationId === selectedConvId) {
        setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
      } else if (evt.type === 'typing:start' && evt.conversationId === selectedConvId) {
        setTypingPartnerId(evt.profileId);
      } else if (evt.type === 'typing:stop' && evt.conversationId === selectedConvId) {
        setTypingPartnerId((curr) => (curr === evt.profileId ? null : curr));
      }
    });
    return unsub;
  }, [selectedConvId, profile?.id, subscribeWs, loadConversations]);

  const handleDraftChange = (val: string) => {
    setDraft(val);
    if (!selectedConvId) return;
    sendWsMessage({ type: 'typing:start', conversationId: selectedConvId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendWsMessage({ type: 'typing:stop', conversationId: selectedConvId });
    }, 1500);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!ALLOWED_MIME.has(file.type)) {
      setError('Unsupported file format. Upload PNG, JPG, WEBP, GIF, PDF, or TXT.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Attachment exceeds the 2MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        dataUrl: String(reader.result),
        name: file.name,
        type: file.type,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || (!draft.trim() && !attachment) || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch<{ message: ChatMessage }>(
        `/api/conversations/${selectedConvId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: draft.trim(),
            attachmentDataUrl: attachment?.dataUrl,
            attachmentName: attachment?.name,
            attachmentType: attachment?.type,
            attachmentSize: attachment?.size,
          }),
        }
      );
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      setDraft('');
      setAttachment(null);
      sendWsMessage({ type: 'typing:stop', conversationId: selectedConvId });
      loadConversations();
    } catch (err: any) {
      setError(err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-11rem)] min-h-[520px] rounded-2xl border border-slate-800 bg-[#0B1120] overflow-hidden grid grid-cols-1 md:grid-cols-12">
      {/* Conversations List */}
      <aside className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-display font-semibold text-white">Conversations</h2>
          <span className="text-xs font-mono text-slate-400 tabular-nums">{conversations.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {loadingConvs ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-slate-900 animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No active conversations yet. Match with a student in Discover to unlock private messaging.
            </div>
          ) : (
            conversations.map((conv) => {
              const active = conv.id === selectedConvId;
              const online = onlineProfileIds.has(conv.partner.id) || conv.partner.isOnline;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${
                    active ? 'bg-violet-600/15' : 'hover:bg-slate-900/70'
                  }`}
                >
                  <Avatar src={conv.partner.avatarUrl} name={conv.partner.fullName} size="md" isOnline={online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display font-semibold text-sm text-white truncate">
                        {conv.partner.fullName}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="font-mono text-xs font-semibold text-violet-300 tabular-nums">
                          {conv.unreadCount} new
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {conv.lastMessage?.content || 'Matched — say hello'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Active Message Thread */}
      <section className="md:col-span-8 flex flex-col overflow-hidden bg-[#080D18]">
        {!activeConv ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div>
              <p className="font-display font-semibold text-white">Select a conversation</p>
              <p className="text-xs text-slate-400 mt-1">
                Only matched students can message and call one another.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 bg-[#0B1120] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  src={activeConv.partner.avatarUrl}
                  name={activeConv.partner.fullName}
                  size="sm"
                  isOnline={onlineProfileIds.has(activeConv.partner.id) || activeConv.partner.isOnline}
                />
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm text-white truncate">
                    {activeConv.partner.fullName}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {activeConv.partner.collegeShortName} · {activeConv.partner.departmentCode}
                    {onlineProfileIds.has(activeConv.partner.id) ? ' · Online' : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    startCall({
                      partnerId: activeConv.partner.id,
                      partnerName: activeConv.partner.fullName,
                      partnerAvatar: activeConv.partner.avatarUrl,
                      matchId: activeConv.matchId,
                      mode: 'audio',
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Audio Call</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    startCall({
                      partnerId: activeConv.partner.id,
                      partnerName: activeConv.partner.fullName,
                      partnerAvatar: activeConv.partner.avatarUrl,
                      matchId: activeConv.matchId,
                      mode: 'video',
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Video Call</span>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {loadingMsgs ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 w-2/3 rounded-xl bg-slate-900 animate-pulse" />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  No messages yet. Propose your first skill-exchange topic!
                </div>
              ) : (
                messages.map((msg) => {
                  const mine = msg.senderId === profile?.id;
                  const isImage = msg.attachmentType?.startsWith('image/');
                  return (
                    <div key={msg.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[80%] sm:max-w-[70%] rounded-xl px-4 py-2.5 text-sm ${
                          mine
                            ? 'bg-violet-600 text-white'
                            : 'bg-[#11192C] border border-slate-800 text-slate-100'
                        }`}
                      >
                        {msg.attachmentUrl && (
                          <div className="mb-2">
                            {isImage ? (
                              <img
                                src={msg.attachmentUrl}
                                alt={msg.attachmentName || 'Image attachment'}
                                referrerPolicy="no-referrer"
                                className="max-h-56 rounded-lg object-contain border border-black/20"
                              />
                            ) : (
                              <a
                                href={msg.attachmentUrl}
                                download={msg.attachmentName || 'document'}
                                className="inline-flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2 text-xs underline"
                              >
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="truncate max-w-[200px]">{msg.attachmentName}</span>
                              </a>
                            )}
                          </div>
                        )}
                        {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono text-slate-500 tabular-nums">
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {mine && (
                          <span className="inline-flex items-center gap-0.5 text-slate-400">
                            <CheckCheck className={`w-3 h-3 ${msg.isRead ? 'text-blue-400' : 'text-slate-500'}`} />
                            {msg.isRead ? 'Read' : 'Sent'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {typingPartnerId === activeConv.partner.id && (
                <p className="text-xs text-slate-400 italic">
                  {activeConv.partner.fullName.split(' ')[0]} is typing...
                </p>
              )}
              <div ref={bottomRef} />
            </div>

            {error && (
              <div className="px-5 py-2 bg-rose-500/10 border-t border-rose-500/30 text-xs text-rose-200">
                {error}
              </div>
            )}

            {attachment && (
              <div className="px-5 py-2 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-200">
                <span className="truncate">Attached: {attachment.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Composer */}
            <form
              onSubmit={handleSend}
              className="p-3.5 border-t border-slate-800 bg-[#0B1120] flex items-center gap-2.5"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach image or PDF/TXT document (max 2MB)"
                className="rounded-lg border border-slate-800 bg-slate-950 hover:border-slate-700 p-2.5 text-slate-300 hover:text-white transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                placeholder={`Message ${activeConv.partner.fullName.split(' ')[0]}...`}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || (!draft.trim() && !attachment)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
};
