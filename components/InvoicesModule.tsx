import React, { useEffect, useMemo, useState } from 'react';
import { type Invoice, type InvoiceStatus, type SystemUser, UserRole } from '../types';
import { createInvoice, fetchInvoices, updateInvoiceStatus } from '../services/salesService';

interface InvoicesModuleProps {
  user: SystemUser;
  users: SystemUser[];
}

const InvoicesModule: React.FC<InvoicesModuleProps> = ({ user, users }) => {
  const isSalesDept = /sales/i.test(String(user.department || '')) || /sales/i.test(String(user.jobTitle || ''));
  const isSalesManager = isSalesDept && /manager|head|lead/i.test(String(user.jobTitle || ''));
  const canViewAll = user.role !== UserRole.USER || isSalesManager;
  const canAssign = user.role !== UserRole.USER || isSalesManager;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);

  const [invoiceNo, setInvoiceNo] = useState('');
  const [client, setClient] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [assigneeId, setAssigneeId] = useState(user.id);

  const displayUsers = useMemo(() => users.filter((u) => u.status !== 'BANNED'), [users]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchInvoices(user, canViewAll);
      if (!cancelled) setInvoices(data);
    };
    void load();
    return () => { cancelled = true; };
  }, [user.id, canViewAll]);

  const handleCreate = async () => {
    const no = invoiceNo.trim();
    const c = client.trim();
    const a = Number(amount);
    if (!no || !c || !Number.isFinite(a) || a <= 0) { alert('Invoice no, client, and amount are required.'); return; }
    setBusy(true);
    try {
      const created = await createInvoice(user, assigneeId, {
        invoiceNo: no,
        client: c,
        amount: a,
        status: 'draft',
        dueDate: dueDate || undefined,
      });
      setInvoices((prev) => [created, ...prev]);
      setInvoiceNo(''); setClient(''); setAmount('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create invoice.');
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (invoice: Invoice, status: InvoiceStatus) => {
    setInvoices((prev) => prev.map((i) => (i.id === invoice.id ? { ...i, status } : i)));
    try {
      await updateInvoiceStatus(invoice.id, status);
    } catch {
      // keep optimistic
    }
  };

  const nameById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const statusBadge = (s: InvoiceStatus) => {
    if (s === 'paid') return 'text-green-600 dark:text-green-400';
    if (s === 'overdue') return 'text-red-600 dark:text-red-300';
    if (s === 'void') return 'text-slate-500 dark:text-blue-300/60';
    if (s === 'sent') return 'text-blue-600 dark:text-blue-300';
    return 'text-amber-600 dark:text-amber-300';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Invoices</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Create and track invoices.</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gold">{invoices.length} invoices</span>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">New Invoice</h3>
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
            <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Invoice No" />
            <input value={client} onChange={(e) => setClient(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Client" />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Amount (TZS)" />
            <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" />
            <div className="md:col-span-2 flex justify-end">
              <button disabled={busy} onClick={() => void handleCreate()} className="px-6 py-3 rounded-2xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow disabled:opacity-60">
                {busy ? 'Saving...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="liquid-panel p-6">
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-blue-400/20 p-10 text-center text-slate-500 dark:text-blue-300/60">
            No invoices yet.
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((i) => (
              <div key={i.id} className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5 hover:border-gold transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{i.invoiceNo} — {i.client}</p>
                    <p className="mt-2 text-xs text-slate-600 dark:text-blue-200 font-semibold">
                      Owner: {nameById.get(i.userId) || i.userId}{i.dueDate ? ` • Due: ${i.dueDate}` : ''}
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-blue-200 font-semibold">Amount: TZS {Math.round(i.amount).toLocaleString()}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${statusBadge(i.status)}`}>{i.status}</p>
                    <p className="mt-1 text-[10px] font-mono text-slate-400 dark:text-blue-300/50">{i.createdAt ? new Date(i.createdAt).toLocaleDateString('en-GB') : ''}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  {(['draft','sent','paid','overdue','void'] as InvoiceStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => void handleStatus(i, s)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                        i.status === s ? 'bg-gold text-enterprise-blue border-gold' : 'border-slate-200 dark:border-blue-400/20 text-slate-600 dark:text-blue-200'
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

export default InvoicesModule;
