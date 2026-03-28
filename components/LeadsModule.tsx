import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type Lead, type LeadStatus, type SystemUser, UserRole } from '../types';
import { createLead, fetchLeads, updateLead, updateLeadStatus } from '../services/salesService';

interface LeadsModuleProps {
  user: SystemUser;
  users: SystemUser[];
}

const LeadsModule: React.FC<LeadsModuleProps> = ({ user, users }) => {
  const isSalesDept = /sales/i.test(String(user.department || '')) || /sales/i.test(String(user.jobTitle || ''));
  const isSalesManager = isSalesDept && /manager|head|lead/i.test(String(user.jobTitle || ''));
  const canViewAll = user.role === UserRole.SUPER_ADMIN || isSalesManager;
  const canAssign = user.role === UserRole.SUPER_ADMIN || isSalesManager;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [assigneeId, setAssigneeId] = useState(user.id);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; company: string; phone: string; email: string; status: LeadStatus; estimatedValue: string; notes: string; followUpAt: string; followUpNotes: string }>({
    name: '',
    company: '',
    phone: '',
    email: '',
    status: 'new',
    estimatedValue: '',
    notes: '',
    followUpAt: '',
    followUpNotes: '',
  });

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
    const followUpDate = followUpAt.trim()
      ? followUpAt.trim()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
        followUpAt: followUpDate || undefined,
        followUpNotes: followUpNotes.trim() || undefined,
      });
      setLeads((prev) => [created, ...prev]);
      setName(''); setCompany(''); setPhone(''); setEmail(''); setEstimatedValue(''); setNotes(''); setFollowUpAt(''); setFollowUpNotes('');
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

  const openEditor = (lead: Lead) => {
    setEditing(lead);
    setEditDraft({
      name: lead.name || '',
      company: lead.company || '',
      phone: lead.phone || '',
      email: lead.email || '',
      status: lead.status,
      estimatedValue: lead.estimatedValue != null ? String(lead.estimatedValue) : '',
      notes: lead.notes || '',
      followUpAt: lead.followUpAt || '',
      followUpNotes: lead.followUpNotes || '',
    });
  };

  const saveEditor = async () => {
    if (!editing) return;
    const patch = {
      name: editDraft.name.trim(),
      company: editDraft.company.trim() || undefined,
      phone: editDraft.phone.trim() || undefined,
      email: editDraft.email.trim() || undefined,
      status: editDraft.status,
      estimatedValue: editDraft.estimatedValue.trim() ? Number(editDraft.estimatedValue) : undefined,
      notes: editDraft.notes.trim() || undefined,
      followUpAt: editDraft.followUpAt.trim() || undefined,
      followUpNotes: editDraft.followUpNotes.trim() || undefined,
    };
    setLeads((prev) => prev.map((l) => (l.id === editing.id ? { ...l, ...patch } : l)));
    try {
      await updateLead(editing.id, patch as any);
      setEditing(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update lead.');
    }
  };

  const downloadBlob = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const downloadCsv = (filename: string, rows: Array<Record<string, any>>) => {
    const headerSet = new Set<string>();
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => headerSet.add(key));
    });
    const headers = Array.from(headerSet);
    const escape = (v: any) => `"${String(v ?? '').replace(/\"/g, '""')}"`;
    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(',')),
    ].join('\n');
    downloadBlob(filename, new Blob([lines], { type: 'text/csv;charset=utf-8' }));
  };

  const downloadLeadPdf = (lead: Lead) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const colorBlue: [number, number, number] = [0, 51, 102];
    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

    pdf.setTextColor(...colorBlue);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('ZAYA GROUP — SALES LEAD', 14, 16);
    pdf.setDrawColor(212, 175, 55);
    pdf.setLineWidth(0.6);
    pdf.line(14, 19, 196, 19);

    const owner = users.find((u) => u.id === lead.userId)?.name || lead.userId;
    autoTable(pdf, {
      startY: 26,
      theme: 'grid',
      head: [['Field', 'Value']],
      body: [
        ['Lead ID', lead.id],
        ['Owner', owner],
        ['Name', lead.name || '-'],
        ['Company', lead.company || '-'],
        ['Phone', lead.phone || '-'],
        ['Email', lead.email || '-'],
        ['Status', lead.status || '-'],
        ['Estimated Value', lead.estimatedValue != null ? `TZS ${Math.round(Number(lead.estimatedValue)).toLocaleString()}` : '-'],
        ['Follow-up Date', lead.followUpAt || '-'],
        ['Follow-up Notes', lead.followUpNotes || '-'],
        ['Notes', lead.notes || '-'],
        ['Created', lead.createdAt ? new Date(lead.createdAt).toLocaleString('en-GB') : '-'],
      ],
      styles: { fontSize: 10, textColor: [0, 51, 102], cellPadding: 3 },
      headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      margin: { left: 14, right: 14 },
    });

    const safeName = String(lead.name || 'lead').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    pdf.save(`${safeName}_Lead.pdf`);
  };

  const printLead = (lead: Lead) => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    const html = `
      <html>
        <head>
          <title>Lead - ${lead.name}</title>
          <style>
            body{font-family:Arial, sans-serif;padding:24px;}
            h1{margin:0 0 8px;font-size:20px;}
            .muted{color:#555;font-size:12px;}
            .box{border:1px solid #ddd;border-radius:12px;padding:16px;margin-top:16px;}
            .row{display:flex;gap:16px;flex-wrap:wrap;}
            .col{min-width:240px;flex:1;}
            .k{font-weight:700;font-size:12px;color:#333;text-transform:uppercase;letter-spacing:.08em;}
            .v{margin-top:6px;font-size:14px;}
          </style>
        </head>
        <body>
          <h1>Zaya Group Portal — Lead</h1>
          <div class="muted">Printed: ${new Date().toLocaleString('en-GB')}</div>
          <div class="box">
            <div class="row">
              <div class="col"><div class="k">Name</div><div class="v">${lead.name || ''}</div></div>
              <div class="col"><div class="k">Company</div><div class="v">${lead.company || ''}</div></div>
            </div>
            <div class="row" style="margin-top:12px;">
              <div class="col"><div class="k">Phone</div><div class="v">${lead.phone || ''}</div></div>
              <div class="col"><div class="k">Email</div><div class="v">${lead.email || ''}</div></div>
            </div>
            <div class="row" style="margin-top:12px;">
              <div class="col"><div class="k">Status</div><div class="v">${lead.status}</div></div>
              <div class="col"><div class="k">Estimated Value</div><div class="v">${lead.estimatedValue != null ? `TZS ${Math.round(Number(lead.estimatedValue)).toLocaleString()}` : ''}</div></div>
            </div>
            <div class="row" style="margin-top:12px;">
              <div class="col"><div class="k">Follow-up Date</div><div class="v">${lead.followUpAt || ''}</div></div>
              <div class="col"><div class="k">Follow-up Notes</div><div class="v">${(lead.followUpNotes || '').replace(/\n/g, '<br/>')}</div></div>
            </div>
            <div style="margin-top:12px;">
              <div class="k">Notes</div><div class="v">${(lead.notes || '').replace(/\n/g, '<br/>')}</div>
            </div>
          </div>
          <script>window.onload=()=>{window.print();};</script>
        </body>
      </html>
    `;
    w.document.open();
    w.document.write(html);
    w.document.close();
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
      {editing && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-700 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <h3 className="text-lg font-black dark:text-white uppercase tracking-tight">View / Edit Lead</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-red-500">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={editDraft.name} onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))} className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" placeholder="Lead name" />
              <input value={editDraft.company} onChange={(e) => setEditDraft((p) => ({ ...p, company: e.target.value }))} className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" placeholder="Company" />
              <input value={editDraft.phone} onChange={(e) => setEditDraft((p) => ({ ...p, phone: e.target.value }))} className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" placeholder="Phone" />
              <input value={editDraft.email} onChange={(e) => setEditDraft((p) => ({ ...p, email: e.target.value }))} className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" placeholder="Email" />
              <select value={editDraft.status} onChange={(e) => setEditDraft((p) => ({ ...p, status: e.target.value as LeadStatus }))} className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none">
                {(['new','contacted','qualified','won','lost'] as LeadStatus[]).map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
              <input value={editDraft.estimatedValue} onChange={(e) => setEditDraft((p) => ({ ...p, estimatedValue: e.target.value }))} className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" placeholder="Estimated value (TZS)" />
              <textarea value={editDraft.notes} onChange={(e) => setEditDraft((p) => ({ ...p, notes: e.target.value }))} className="md:col-span-2 w-full min-h-28 p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" placeholder="Notes" />
              <input value={editDraft.followUpAt} onChange={(e) => setEditDraft((p) => ({ ...p, followUpAt: e.target.value }))} type="date" className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" />
              <textarea value={editDraft.followUpNotes} onChange={(e) => setEditDraft((p) => ({ ...p, followUpNotes: e.target.value }))} className="w-full min-h-28 p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" placeholder="Follow-up notes" />
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-between gap-3 bg-slate-50 dark:bg-slate-900/40">
              <button onClick={() => downloadLeadPdf({ ...editing, ...editDraft, estimatedValue: editDraft.estimatedValue ? Number(editDraft.estimatedValue) : undefined } as any)} className="px-5 py-3 rounded-xl border dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Download PDF
              </button>
              <div className="flex gap-3">
                <button onClick={() => printLead({ ...editing, ...editDraft, estimatedValue: editDraft.estimatedValue ? Number(editDraft.estimatedValue) : undefined } as any)} className="px-5 py-3 rounded-xl border dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Print
                </button>
                <button onClick={() => void saveEditor()} className="px-5 py-3 bg-gold text-enterprise-blue rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="liquid-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Leads</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Capture, qualify, and track sales leads.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadCsv(`leads_${new Date().toISOString().slice(0, 10)}.csv`, leads.map((l) => ({
                name: l.name,
                company: l.company || '',
                phone: l.phone || '',
                email: l.email || '',
                status: l.status,
                estimatedValue: l.estimatedValue ?? '',
                createdAt: l.createdAt,
              })))}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
            >
              Download CSV
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-gold">{leads.length} leads</span>
          </div>
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
            <input value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} type="date" className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" />
            <textarea value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} className="w-full min-h-24 p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Follow-up notes (optional)" />
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
                    {l.followUpAt && (
                      <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300">
                        Follow-up: {l.followUpAt}{l.followUpNotes ? ` • ${l.followUpNotes}` : ''}
                      </p>
                    )}
                    {l.notes && <p className="mt-2 text-sm text-slate-700 dark:text-blue-200 whitespace-pre-wrap">{l.notes}</p>}
                    {user.role === UserRole.USER && (
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-300/60">
                        Owner: {nameById.get(l.userId) || l.userId}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${statusStyle(l.status)}`}>{l.status}</p>
                    <p className="mt-1 text-[10px] font-mono text-slate-400 dark:text-blue-300/50">{l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-GB') : ''}</p>
                    {l.estimatedValue != null && (
                      <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-gold">TZS {Math.round(Number(l.estimatedValue)).toLocaleString()}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => openEditor(l)}
                      className="px-3 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow"
                    >
                      View / Edit
                    </button>
                    <button
                      onClick={() => printLead(l)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
                    >
                      Print
                    </button>
                    <button
                      onClick={() => downloadLeadPdf(l)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
                    >
                      Download PDF
                    </button>
                  </div>
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
