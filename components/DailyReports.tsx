import React, { useEffect, useMemo, useState } from 'react';
import { type DailyReport, type SystemUser } from '../types';
import { createDailyReport, fetchDailyReports, hasEmployeeSupabase, subscribeToTableChanges } from '../services/employeeSystemService';

interface DailyReportsProps {
  user: SystemUser;
  isAdmin: boolean;
  users: SystemUser[];
}

const DailyReports: React.FC<DailyReportsProps> = ({ user, isAdmin, users }) => {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isSaving, setIsSaving] = useState(false);
  const [filterUserId, setFilterUserId] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const canSubmit = true;

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchDailyReports(user, isAdmin);
      if (!cancelled) setReports(data);
    };
    void load();
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  useEffect(() => {
    if (!hasEmployeeSupabase()) return;
    const filter = isAdmin ? undefined : `user_id=eq.${user.id}`;
    const sub = subscribeToTableChanges('reports', {
      filter,
      onInsert: (row) => {
        const next: DailyReport = {
          id: String(row.id),
          userId: String(row.user_id),
          title: String(row.title || ''),
          description: String(row.description || ''),
          createdAt: String(row.created_at || ''),
        };
        setReports((prev) => (prev.some((r) => r.id === next.id) ? prev : [next, ...prev]));
      },
    });
    return () => sub.unsubscribe();
  }, [user.id, isAdmin]);

  const handleCreate = async () => {
    const t = title.trim();
    const d = description.trim();
    if (!t || !d) { alert('Title and description are required.'); return; }
    setIsSaving(true);
    try {
      const created = await createDailyReport(user, { title: t, description: d, date });
      setReports((prev) => [created, ...prev]);
      setTitle('');
      setDescription('');
      alert('Report submitted. Reports are write-once (no editing).');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredReports = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;
    return reports.filter((r) => {
      if (isAdmin && filterUserId !== 'ALL' && r.userId !== filterUserId) return false;
      const createdAt = new Date(r.createdAt).getTime();
      if (from !== null && createdAt < from) return false;
      if (to !== null && createdAt > to) return false;
      return true;
    });
  }, [reports, isAdmin, filterUserId, fromDate, toDate]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Daily Reports</h2>
            <p className="text-xs text-slate-500 dark:text-slate-300/70 mt-1">Write-once reporting. No edits after submit.</p>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gold">Reports</div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300/70 mb-2">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                placeholder="What did you work on?"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300/70 mb-2">
                <i className="fas fa-calendar-alt text-gold"></i>
                <span>Date</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300/70 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-40 p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                placeholder="Describe outcomes, blockers, and next steps."
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                disabled={isSaving}
                onClick={handleCreate}
                className="px-6 py-3 rounded-2xl bg-gold text-enterprise-blue font-black uppercase tracking-widest text-[10px] shadow-xl disabled:opacity-60 border-b-4 border-black/10 hover:brightness-110 active:scale-[0.98]"
              >
                {isSaving ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
      </div>

      <div className="liquid-panel p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Report List</h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{filteredReports.length} total</span>
        </div>

        {isAdmin && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
            >
              <option value="ALL">All employees</option>
              {users
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((u) => (
                  <option key={`filter-${u.id}`} value={u.id}>{u.name}</option>
                ))}
            </select>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              placeholder="From"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              placeholder="To"
            />
          </div>
        )}

        {filteredReports.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300/70 dark:border-blue-400/20 p-8 text-center">
            <p className="text-sm font-semibold text-slate-600 dark:text-blue-200">No reports yet.</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60">Submit your first daily report above.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {filteredReports.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/50 dark:bg-slate-950/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-slate-900 dark:text-white truncate">{r.title}</p>
                    <p className="mt-2 text-xs text-slate-600 dark:text-blue-200 whitespace-pre-wrap">{r.description}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gold">{new Date(r.createdAt).toLocaleDateString('en-GB')}</p>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-blue-300/60 font-bold uppercase tracking-widest">
                      {userNameById.get(r.userId) || r.userId}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-400">Write-once</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyReports;
