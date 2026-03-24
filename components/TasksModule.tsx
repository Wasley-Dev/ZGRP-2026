import React, { useEffect, useMemo, useState } from 'react';
import { UserRole, type SystemUser, type TaskItem } from '../types';
import { createTask, fetchTasks, hasEmployeeSupabase, setTaskStatus, subscribeToTableChanges } from '../services/employeeSystemService';

interface TasksModuleProps {
  user: SystemUser;
  users: SystemUser[];
}

const TasksModule: React.FC<TasksModuleProps> = ({ user, users }) => {
  const isAdmin = user.role !== UserRole.USER;
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState(users.find((u) => u.role === UserRole.USER)?.id || users[0]?.id || user.id);
  const [isSaving, setIsSaving] = useState(false);

  const displayUsers = useMemo(() => users.filter((u) => u.status !== 'BANNED'), [users]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchTasks(user, isAdmin);
      if (!cancelled) setTasks(data);
    };
    void load();
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  useEffect(() => {
    if (!hasEmployeeSupabase()) return;
    const filter = isAdmin ? undefined : `user_id=eq.${user.id}`;
    const sub = subscribeToTableChanges('tasks', {
      filter,
      onInsert: (row) => {
        const next: TaskItem = {
          id: String(row.id),
          userId: String(row.user_id),
          title: String(row.title || ''),
          description: String(row.description || ''),
          status: (String(row.status || 'pending').toLowerCase() === 'completed' ? 'completed' : 'pending'),
          createdAt: String(row.created_at || ''),
        };
        setTasks((prev) => (prev.some((t) => t.id === next.id) ? prev : [next, ...prev]));
      },
      onUpdate: (row) => {
        const next: TaskItem = {
          id: String(row.id),
          userId: String(row.user_id),
          title: String(row.title || ''),
          description: String(row.description || ''),
          status: (String(row.status || 'pending').toLowerCase() === 'completed' ? 'completed' : 'pending'),
          createdAt: String(row.created_at || ''),
        };
        setTasks((prev) => prev.map((t) => (t.id === next.id ? next : t)));
      },
    });
    return () => sub.unsubscribe();
  }, [user.id, isAdmin]);

  const handleAssign = async () => {
    const t = title.trim();
    const d = description.trim();
    if (!t || !d) { alert('Title and description are required.'); return; }
    setIsSaving(true);
    try {
      const created = await createTask({ userId: assigneeId, title: t, description: d });
      setTasks((prev) => [created, ...prev]);
      setTitle('');
      setDescription('');
      alert('Task assigned.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (task: TaskItem) => {
    const next = task.status === 'completed' ? 'pending' : 'completed';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await setTaskStatus(task.id, next);
    } catch {
      // Keep optimistic state even if offline
    }
  };

  const nameById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Tasks</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Admin assigns tasks. Users mark completed.</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gold">{tasks.length} tasks</span>
        </div>

        {isAdmin && (
          <div className="mt-6 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Assign Task</h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              >
                {displayUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                placeholder="Title"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="md:col-span-2 w-full min-h-24 p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                placeholder="Description"
              />
              <div className="md:col-span-2 flex justify-end">
                <button
                  disabled={isSaving}
                  onClick={handleAssign}
                  className="px-6 py-3 rounded-2xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow disabled:opacity-60"
                >
                  {isSaving ? 'Assigning...' : 'Assign Task'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="liquid-panel p-6">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-blue-400/20 p-10 text-center text-slate-500 dark:text-blue-300/60">
            No tasks yet.
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => handleToggle(t)}
                className="w-full text-left rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5 hover:border-gold transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {t.title}{' '}
                      <span className={`ml-2 text-[10px] font-black uppercase tracking-widest ${t.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {t.status}
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-blue-200 whitespace-pre-wrap">{t.description}</p>
                    {isAdmin && (
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-300/60">
                        Assigned to: {nameById.get(t.userId) || t.userId}
                      </p>
                    )}
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gold shrink-0">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB') : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksModule;
