import React, { useEffect, useMemo, useState } from 'react';
import { type Lead, type LeadStatus, type SystemUser, UserRole } from '../types';
import { createLead, fetchLeads, updateLeadStatus } from '../services/salesService';

interface LeadsModuleProps {
  user: SystemUser;
  users: SystemUser[];
}

const LeadsModule: React.FC<LeadsModuleProps> = ({ user, users }) => {
  const isSalesDept = /sales/i.test(String(user.department || '')) || /sales/i.test(String(user.jobTitle || ''));
  const isSalesManager = isSalesDept && /manager|head|lead/i.test(String(user.jobTitle || ''));
  const canViewAll = user.role !== UserRole.USER || isSalesManager;
  const canAssign = user.role !== UserRole.USER || isSalesManager;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [assigneeId, setAssigneeId] = useState(user.id);

  const displayUsers = useMemo(() => users.filter((u) => u.status !== 'BANNED'), [users]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchLeads(user, canViewAll);
      if (!cancelled) setLeads(data);
    };
    void load();
    return () => { cancelled = true; };
  }, [user.id, canViewAll]);

  const handleCreate = async () => {
    const n = name.trim();
    if (!n) { alert('Lead name is required.'); return; }
    setIsSaving(true);
    try {
      const created = await createLead(user, assigneeId, {
        name: n,
        company: company.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        status: 'new',
        estimatedValue: estimatedValue.trim() ? Number(estimatedValue) : undefined,
        notes: notes.trim() || undefined,
      });
      setLeads((prev) => [created, ...prev]);
      setName(''); setCompany(''); setPhone(''); setEmail(''); setEstimatedValue(''); setNotes('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create lead.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatus = async (lead: Lead, status: LeadStatus) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    try {
      await updateLeadStatus(lead.id, status);
    } catch {
      // keep optimistic
    }
  };

  const nameById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const statusStyle = (s: LeadStatus) => {
    if (s === 'won') return 'text-green-600 dark:text-green-400';
    if (s === 'lost') return 'text-red-600 dark:text-red-300';
    if (s === 'qualified') return 'text-gold';
    if (s === 'contacted') return 'text-blue-600 dark:text-blue-300';
    return 'text-amber-600 dark:text-amber-300';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Leads</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Capture, qualify, and track sales leads.</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gold">{leads.length} leads</span>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">New Lead</h3>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {canAssign && (
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              >
                {displayUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}{u.jobTitle ? ` — ${u.jobTitle}` : ''}</option>
                ))}
              </select>
            )}
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Lead name" />
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Company (optional)" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Phone (optional)" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Email (optional)" />
            <input value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Estimated value (TZS)" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="md:col-span-2 w-full min-h-24 p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Notes (optional)" />
            <div className="md:col-span-2 flex justify-end">
              <button disabled={isSaving} onClick={() => void handleCreate()} className="px-6 py-3 rounded-2xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow disabled:opacity-60">
                {isSaving ? 'Saving...' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="liquid-panel p-6">
        {leads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-blue-400/20 p-10 text-center text-slate-500 dark:text-blue-300/60">
            No leads yet.
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((l) => (
              <div key={l.id} className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5 hover:border-gold transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {l.name}{l.company ? <span className="text-slate-500 dark:text-blue-200 font-semibold"> — {l.company}</span> : null}
                    </p>
                    <p className="mt-2 text-xs text-slate-600 dark:text-blue-200 font-semibold">
                      {(l.phone || l.email) ? `${l.phone || ''}${l.phone && l.email ? ' • ' : ''}${l.email || ''}` : 'No contact details'}
                    </p>
                    {l.notes && <p className="mt-2 text-sm text-slate-700 dark:text-blue-200 whitespace-pre-wrap">{l.notes}</p>}
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-300/60">
                      Owner: {nameById.get(l.userId) || l.userId}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${statusStyle(l.status)}`}>{l.status}</p>
                    <p className="mt-1 text-[10px] font-mono text-slate-400 dark:text-blue-300/50">{l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-GB') : ''}</p>
                    {l.estimatedValue != null && (
                      <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-gold">TZS {Math.round(Number(l.estimatedValue)).toLocaleString()}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  {(['new','contacted','qualified','won','lost'] as LeadStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => void handleStatus(l, s)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                        l.status === s ? 'bg-gold text-enterprise-blue border-gold' : 'border-slate-200 dark:border-blue-400/20 text-slate-600 dark:text-blue-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadsModule;
