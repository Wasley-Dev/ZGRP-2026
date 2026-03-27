import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type Invoice, type InvoiceStatus, type SystemUser, UserRole } from '../types';
import { createInvoice, fetchInvoices, updateInvoice, updateInvoiceStatus } from '../services/salesService';

interface InvoicesModuleProps {
  user: SystemUser;
  users: SystemUser[];
}

const InvoicesModule: React.FC<InvoicesModuleProps> = ({ user, users }) => {
  const isSalesDept = /sales/i.test(String(user.department || '')) || /sales/i.test(String(user.jobTitle || ''));
  const isSalesManager = isSalesDept && /manager|head|lead/i.test(String(user.jobTitle || ''));
  const canViewAll = user.role === UserRole.SUPER_ADMIN || isSalesManager;
  const canAssign = user.role === UserRole.SUPER_ADMIN || isSalesManager;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);

  const [invoiceNo, setInvoiceNo] = useState('');
  const [client, setClient] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [assigneeId, setAssigneeId] = useState(user.id);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [editDraft, setEditDraft] = useState<{ invoiceNo: string; client: string; amount: string; status: InvoiceStatus; dueDate: string }>({
    invoiceNo: '',
    client: '',
    amount: '',
    status: 'draft',
    dueDate: new Date().toISOString().slice(0, 10),
  });

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

  const openEditor = (invoice: Invoice) => {
    setEditing(invoice);
    setEditDraft({
      invoiceNo: invoice.invoiceNo || '',
      client: invoice.client || '',
      amount: String(invoice.amount ?? ''),
      status: invoice.status,
      dueDate: invoice.dueDate || new Date().toISOString().slice(0, 10),
    });
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
    const headers = Array.from(
      rows.reduce((acc, row) => {
        Object.keys(row).forEach((k) => acc.add(k));
        return acc;
      }, new Set<string>())
    );
    const escape = (v: any) => `"${String(v ?? '').replace(/\"/g, '""')}"`;
    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(',')),
    ].join('\n');
    downloadBlob(filename, new Blob([lines], { type: 'text/csv;charset=utf-8' }));
  };

  const downloadInvoicePdf = (invoice: Invoice) => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const colorBlue: [number, number, number] = [0, 51, 102];
    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), 'F');

    pdf.setTextColor(...colorBlue);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('ZAYA GROUP — INVOICE RECORD', 14, 16);
    pdf.setDrawColor(212, 175, 55);
    pdf.setLineWidth(0.6);
    pdf.line(14, 19, 196, 19);

    const owner = users.find((u) => u.id === invoice.userId)?.name || invoice.userId;
    autoTable(pdf, {
      startY: 26,
      theme: 'grid',
      head: [['Field', 'Value']],
      body: [
        ['Invoice ID', invoice.id],
        ['Owner', owner],
        ['Invoice No', invoice.invoiceNo || '-'],
        ['Client', invoice.client || '-'],
        ['Amount', `TZS ${Math.round(Number(invoice.amount || 0)).toLocaleString()}`],
        ['Status', invoice.status || '-'],
        ['Due Date', invoice.dueDate || '-'],
        ['Created', invoice.createdAt ? new Date(invoice.createdAt).toLocaleString('en-GB') : '-'],
      ],
      styles: { fontSize: 10, textColor: [0, 51, 102], cellPadding: 3 },
      headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      margin: { left: 14, right: 14 },
    });

    const safeNo = String(invoice.invoiceNo || 'invoice').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
    pdf.save(`${safeNo}_Invoice.pdf`);
  };

  const printInvoice = (invoice: Invoice) => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    const html = `
      <html>
        <head>
          <title>Invoice - ${invoice.invoiceNo}</title>
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
          <h1>Zaya Group Portal — Invoice</h1>
          <div class="muted">Printed: ${new Date().toLocaleString('en-GB')}</div>
          <div class="box">
            <div class="row">
              <div class="col"><div class="k">Invoice No</div><div class="v">${invoice.invoiceNo || ''}</div></div>
              <div class="col"><div class="k">Client</div><div class="v">${invoice.client || ''}</div></div>
            </div>
            <div class="row" style="margin-top:12px;">
              <div class="col"><div class="k">Amount</div><div class="v">TZS ${Math.round(Number(invoice.amount || 0)).toLocaleString()}</div></div>
              <div class="col"><div class="k">Status</div><div class="v">${invoice.status}</div></div>
            </div>
            <div class="row" style="margin-top:12px;">
              <div class="col"><div class="k">Due Date</div><div class="v">${invoice.dueDate || ''}</div></div>
              <div class="col"><div class="k">Created</div><div class="v">${invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-GB') : ''}</div></div>
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

  const saveEditor = async () => {
    if (!editing) return;
    const patch = {
      invoiceNo: editDraft.invoiceNo.trim(),
      client: editDraft.client.trim(),
      amount: Number(editDraft.amount),
      status: editDraft.status,
      dueDate: editDraft.dueDate || undefined,
    };
    if (!patch.invoiceNo || !patch.client || !Number.isFinite(patch.amount) || patch.amount <= 0) {
      alert('Invoice no, client, and amount are required.');
      return;
    }
    setInvoices((prev) => prev.map((i) => (i.id === editing.id ? { ...i, ...patch } : i)));
    try {
      await updateInvoice(editing.id, patch as any);
      setEditing(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update invoice.');
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
      {editing && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-700 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <h3 className="text-lg font-black dark:text-white uppercase tracking-tight">View / Edit Invoice</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-red-500">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={editDraft.invoiceNo} onChange={(e) => setEditDraft((p) => ({ ...p, invoiceNo: e.target.value }))} className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" placeholder="Invoice No" />
              <input value={editDraft.client} onChange={(e) => setEditDraft((p) => ({ ...p, client: e.target.value }))} className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" placeholder="Client" />
              <input value={editDraft.amount} onChange={(e) => setEditDraft((p) => ({ ...p, amount: e.target.value }))} className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" placeholder="Amount (TZS)" />
              <select value={editDraft.status} onChange={(e) => setEditDraft((p) => ({ ...p, status: e.target.value as InvoiceStatus }))} className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none">
                {(['draft','sent','paid','overdue','void'] as InvoiceStatus[]).map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
              <input value={editDraft.dueDate} onChange={(e) => setEditDraft((p) => ({ ...p, dueDate: e.target.value }))} type="date" className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none" />
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-between gap-3 bg-slate-50 dark:bg-slate-900/40">
              <button onClick={() => downloadInvoicePdf(editing)} className="px-5 py-3 rounded-xl border dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Download PDF
              </button>
              <div className="flex gap-3">
                <button onClick={() => printInvoice({ ...editing, ...editDraft, amount: Number(editDraft.amount) } as any)} className="px-5 py-3 rounded-xl border dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500">
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
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Invoices</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Create and track invoices.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadCsv(`invoices_${new Date().toISOString().slice(0, 10)}.csv`, invoices.map((i) => ({
                invoiceNo: i.invoiceNo,
                client: i.client,
                amount: i.amount,
                status: i.status,
                dueDate: i.dueDate || '',
                createdAt: i.createdAt,
              })))}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
            >
              Download CSV
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-gold">{invoices.length} invoices</span>
          </div>
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
                      {user.role === UserRole.USER ? `Owner: ${nameById.get(i.userId) || i.userId}` : 'Sales Team'}{i.dueDate ? ` • Due: ${i.dueDate}` : ''}
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-blue-200 font-semibold">Amount: TZS {Math.round(i.amount).toLocaleString()}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${statusBadge(i.status)}`}>{i.status}</p>
                    <p className="mt-1 text-[10px] font-mono text-slate-400 dark:text-blue-300/50">{i.createdAt ? new Date(i.createdAt).toLocaleDateString('en-GB') : ''}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => openEditor(i)}
                      className="px-3 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow"
                    >
                      View / Edit
                    </button>
                    <button
                      onClick={() => printInvoice(i)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
                    >
                      Print
                    </button>
                    <button
                      onClick={() => downloadInvoicePdf(i)}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
                    >
                      Download PDF
                    </button>
                  </div>
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
