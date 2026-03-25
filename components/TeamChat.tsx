import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SystemUser, TeamMessage } from '../types';
import { fetchChatMessages, hasEmployeeSupabase, sendChatMessage, subscribeToTableInserts } from '../services/employeeSystemService';

interface TeamChatProps {
  user: SystemUser;
  users: SystemUser[];
}

const TeamChat: React.FC<TeamChatProps> = ({ user, users }) => {
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const userById = useMemo(() => new Map<string, SystemUser>(users.map((u) => [u.id, u])), [users]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchChatMessages();
      if (!cancelled) setMessages(data);
      window.setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 50);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hasEmployeeSupabase()) return;
    const sub = subscribeToTableInserts('messages', (row) => {
      const next: TeamMessage = {
        id: String(row.id),
        senderId: String(row.sender_id),
        message: String(row.message || ''),
        createdAt: String(row.created_at || ''),
      };
      setMessages((prev) => (prev.some((m) => m.id === next.id) ? prev : [...prev, next]));
      window.setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 30);
    });
    return () => sub.unsubscribe();
  }, []);

  const handleSend = async () => {
    const value = text.trim();
    if (!value) return;
    setIsSending(true);
    try {
      const sent = await sendChatMessage(user, value);
      setMessages((prev) => [...prev, sent]);
      setText('');
      window.setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 30);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Team Chat</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Real-time messaging via Supabase (falls back to local send when offline).</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gold">{messages.length} messages</span>
        </div>

        <div ref={listRef} className="mt-6 h-[55vh] overflow-auto rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-10 text-slate-500 dark:text-blue-300/60">
              No messages yet. Start the conversation.
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.senderId === user.id;
              const sender = userById.get(m.senderId);
              const senderName = sender?.name || m.senderId;
              const senderTitle = sender?.jobTitle || '';
              const senderAvatar = sender?.avatar || '';
              return (
                <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 border ${isMine ? 'bg-enterprise-blue text-white border-blue-900/10' : 'bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white border-slate-200 dark:border-blue-400/20'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {!isMine && (
                          <div className="h-7 w-7 rounded-full border border-gold/30 bg-white/70 dark:bg-slate-900/50 overflow-hidden shrink-0">
                            {senderAvatar ? (
                              <img src={senderAvatar} alt={senderName} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-gold text-[10px] font-black">
                                {String(senderName || '?').slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className={`text-[10px] font-black uppercase tracking-widest truncate ${isMine ? 'text-gold' : 'text-slate-500 dark:text-blue-300/60'}`}>
                            {isMine ? 'You' : senderName}
                          </p>
                          {!isMine && senderTitle && (
                            <p className={`text-[9px] font-bold uppercase tracking-widest truncate ${isMine ? 'text-white/70' : 'text-slate-400 dark:text-blue-300/50'}`}>
                              {senderTitle}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className={`text-[10px] font-mono ${isMine ? 'text-white/70' : 'text-slate-400 dark:text-blue-300/50'}`}>
                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString('en-GB') : ''}
                      </p>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap">{m.message}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
            className="flex-1 p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
            placeholder="Type a message..."
          />
          <button
            disabled={isSending}
            onClick={handleSend}
            className="px-6 py-3 rounded-2xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamChat;
