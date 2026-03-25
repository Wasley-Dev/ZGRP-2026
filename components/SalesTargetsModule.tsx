import React, { useEffect, useMemo, useState } from 'react';
import { type Invoice, type Lead, type SalesTarget, type SystemConfig, type SystemUser, UserRole } from '../types';
import { fetchInvoices, fetchLeads, fetchSalesTargets, upsertSalesTarget } from '../services/salesService';

interface SalesTargetsModuleProps {
  user: SystemUser;
  users: SystemUser[];
  systemConfig: SystemConfig;
}

const SalesTargetsModule: React.FC<SalesTargetsModuleProps> = ({ user, users, systemConfig }) => {
  const isSalesDept = /sales/i.test(String(user.department || '')) || /sales/i.test(String(user.jobTitle || ''));
  const isSalesManager = isSalesDept && /manager|head|lead/i.test(String(user.jobTitle || ''));
  const canViewAllSales = user.role !== UserRole.USER || isSalesManager;
  const canEditTargets = user.role === UserRole.SUPER_ADMIN || isSalesManager || (user.role === UserRole.ADMIN && Boolean(systemConfig.salesAdminWriteEnabled));
  const canChooseAssignee = user.role !== UserRole.USER || isSalesManager;
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [leadsTarget, setLeadsTarget] = useState('30');
  const [revenueTarget, setRevenueTarget] = useState('5000000');
  const [targetUserId, setTargetUserId] = useState(user.id);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);

  const salesUsers = useMemo(() => {
    return users
      .filter((u) => u.status !== 'BANNED')
      .filter((u) => /sales/i.test(String(u.department || '')) || /sales/i.test(String(u.jobTitle || '')));
  }, [users]);

  useEffect(() => {
    if (!canChooseAssignee) setTargetUserId(user.id);
  }, [canChooseAssignee, user.id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [t, l, i] = await Promise.all([
        fetchSalesTargets(user, canViewAllSales),
        fetchLeads(user, canViewAllSales),
        fetchInvoices(user, canViewAllSales),
      ]);
      if (cancelled) return;
      setTargets(t);
      setLeads(l);
      setInvoices(i);
    };
    void load();
    return () => { cancelled = true; };
  }, [user.id, canViewAllSales]);

  const myTarget = useMemo(
    () => targets.find((t) => t.userId === targetUserId && t.month === month && t.year === year) || null,
    [targets, targetUserId, month, year]
  );

  useEffect(() => {
    if (!myTarget) return;
    setLeadsTarget(String(myTarget.leadsTarget));
    setRevenueTarget(String(myTarget.revenueTarget));
  }, [myTarget?.id]);

  const myLeadsCount = useMemo(() => leads.filter((l) => l.userId === targetUserId).length, [leads, targetUserId]);
  const myRevenuePaid = useMemo(
    () => invoices.filter((i) => i.userId === targetUserId && i.status === 'paid').reduce((acc, i) => acc + Number(i.amount || 0), 0),
    [invoices, targetUserId]
  );

  const handleSave = async () => {
    const lt = Math.max(0, Number(leadsTarget || 0));
    const rt = Math.max(0, Number(revenueTarget || 0));
    if (!canEditTargets) { alert('You do not have permission to edit targets.'); return; }
    setBusy(true);
    try {
      const saved = await upsertSalesTarget(user, targetUserId, { month, year, leadsTarget: lt, revenueTarget: rt });
      setTargets((prev) => [saved, ...prev.filter((t) => !(t.userId === targetUserId && t.month === month && t.year === year))]);
      alert('Targets saved.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save targets.');
    } finally {
      setBusy(false);
    }
  };

  const progress = useMemo(() => {
    const lt = Math.max(1, Number(leadsTarget || 1));
    const rt = Math.max(1, Number(revenueTarget || 1));
    return {
      leadsPct: Math.min(100, Math.round((myLeadsCount / lt) * 100)),
      revenuePct: Math.min(100, Math.round((myRevenuePaid / rt) * 100)),
    };
  }, [myLeadsCount, myRevenuePaid, leadsTarget, revenueTarget]);

  const downloadBlob = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const printTargets = () => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    const targetName = users.find((u) => u.id === targetUserId)?.name || targetUserId;
    const html = `
      <html>
        <head>
          <title>Targets - ${targetName}</title>
          <style>
            body{font-family:Arial, sans-serif;padding:24px;}
            h1{margin:0 0 8px;font-size:20px;}
            .muted{color:#555;font-size:12px;}
            .box{border:1px solid #ddd;border-radius:12px;padding:16px;margin-top:16px;}
            .k{font-weight:700;font-size:12px;color:#333;text-transform:uppercase;letter-spacing:.08em;}
            .v{margin-top:6px;font-size:14px;}
          </style>
        </head>
        <body>
          <h1>Zaya Group Portal — Sales Targets / KPIs</h1>
          <div class="muted">Printed: ${new Date().toLocaleString('en-GB')}</div>
          <div class="box">
            <div class="k">Assignee</div><div class="v">${targetName}</div>
            <div style="margin-top:12px;"><span class="k">Month/Year</span><div class="v">${month}/${year}</div></div>
            <div style="margin-top:12px;"><span class="k">Leads Target</span><div class="v">${Number(leadsTarget || 0)} (Progress: ${myLeadsCount})</div></div>
            <div style="margin-top:12px;"><span class="k">Revenue Target</span><div class="v">TZS ${Math.round(Number(revenueTarget || 0)).toLocaleString()} (Paid: TZS ${Math.round(myRevenuePaid).toLocaleString()})</div></div>
          </div>
          <script>window.onload=()=>{window.print();};</script>
        </body>
      </html>
    `;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Targets / KPIs</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Set monthly sales targets and track progress.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={printTargets}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
            >
              Print
            </button>
            <button
              onClick={() => downloadBlob(`sales_targets_${targetUserId}_${year}_${month}.json`, new Blob([JSON.stringify(myTarget || { userId: targetUserId, month, year, leadsTarget: Number(leadsTarget || 0), revenueTarget: Number(revenueTarget || 0) }, null, 2)], { type: 'application/json' }))}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
            >
              Download
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-gold">{myTarget ? 'Configured' : 'Not set'}</span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Configure</h3>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {canChooseAssignee && (
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              >
                {salesUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}{u.jobTitle ? ` — ${u.jobTitle}` : ''}</option>
                ))}
              </select>
            )}
            <input
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              type="number"
              min={1}
              max={12}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              placeholder="Month (1-12)"
            />
            <input
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              type="number"
              min={2000}
              max={2100}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              placeholder="Year"
            />
            <input
              value={leadsTarget}
              onChange={(e) => setLeadsTarget(e.target.value)}
              disabled={!canEditTargets}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              placeholder="Leads target"
            />
            <input
              value={revenueTarget}
              onChange={(e) => setRevenueTarget(e.target.value)}
              disabled={!canEditTargets}
              className="w-full p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              placeholder="Revenue target (TZS)"
            />
            <div className="md:col-span-2 flex justify-end">
              <button
                disabled={busy || !canEditTargets}
                onClick={() => void handleSave()}
                className="px-6 py-3 rounded-2xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow disabled:opacity-60"
              >
                {busy ? 'Saving...' : 'Save Targets'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="liquid-panel p-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Progress</h3>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Leads</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{myLeadsCount} / {Number(leadsTarget || 0)}</p>
            <div className="mt-3 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-gold" style={{ width: `${progress.leadsPct}%` }} />
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-300/60">{progress.leadsPct}%</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Revenue Paid</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">TZS {Math.round(myRevenuePaid).toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-blue-300/60 font-semibold">Target: TZS {Math.round(Number(revenueTarget || 0)).toLocaleString()}</p>
            <div className="mt-3 h-2 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-gold" style={{ width: `${progress.revenuePct}%` }} />
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-300/60">{progress.revenuePct}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesTargetsModule;
