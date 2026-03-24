import React, { useEffect, useState } from 'react';
import type { Notice, SystemUser, UserRole } from '../types';
import { createNotice, fetchNotices, hasEmployeeSupabase, subscribeToTableInserts } from '../services/employeeSystemService';

interface NoticesModuleProps {
  user: SystemUser;
}

const NoticesModule: React.FC<NoticesModuleProps> = ({ user }) => {
  const isAdmin = user.role !== UserRole.USER;
  const [notices, setNotices] = useState<Notice[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchNotices();
      if (!cancelled) setNotices(data);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hasEmployeeSupabase()) return;
    const sub = subscribeToTableInserts('notices', (row) => {
      const next: Notice = {
        id: String(row.id),
        title: String(row.title || ''),
        content: String(row.content || ''),
        createdAt: String(row.created_at || ''),
      };
      setNotices((prev) => (prev.some((n) => n.id === next.id) ? prev : [next, ...prev]));
    });
    return () => sub.unsubscribe();
  }, []);

  const handleCreate = async () => {
    const t = title.trim();
    const c = content.trim();
    if (!t || !c) { alert('Title and content are required.'); return; }
    setIsSaving(true);
    try {
      const created = await createNotice({ title: t, content: c });
      setNotices((prev) => [created, ...prev]);
      setTitle('');
      setContent('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create notice.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Notices</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Company announcements and updates.</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gold">{notices.length} notices</span>
        </div>

        {isAdmin && (
          <div className="mt-6 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Create Notice</h3>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                placeholder="Title"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-28 p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                placeholder="Content"
              />
              <div className="flex justify-end">
                <button
                  disabled={isSaving}
                  onClick={handleCreate}
                  className="px-6 py-3 rounded-2xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow disabled:opacity-60"
                >
                  {isSaving ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="liquid-panel p-6">
        {notices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-blue-400/20 p-10 text-center text-slate-500 dark:text-blue-300/60">
            No notices yet.
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map((n) => (
              <div key={n.id} className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white">{n.title}</p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-blue-200 whitespace-pre-wrap">{n.content}</p>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gold shrink-0">{n.createdAt ? new Date(n.createdAt).toLocaleString('en-GB') : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NoticesModule;

