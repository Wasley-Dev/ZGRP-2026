import React, { useEffect, useMemo, useState } from 'react';
import { type Invoice, type Lead, type SalesTarget, type SystemUser, UserRole } from '../types';
import { fetchInvoices, fetchLeads, fetchSalesTargets } from '../services/salesService';

interface SalesDashboardProps {
  user: SystemUser;
  onNavigate: (module: string) => void;
}

const SalesDashboard: React.FC<SalesDashboardProps> = ({ user, onNavigate }) => {
  const isSalesDept = /sales/i.test(String(user.department || '')) || /sales/i.test(String(user.jobTitle || ''));
  const isSalesManager = isSalesDept && /manager|head|lead/i.test(String(user.jobTitle || ''));
  const canViewAllSales = user.role === UserRole.SUPER_ADMIN || isSalesManager;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [l, i, t] = await Promise.all([
        fetchLeads(user, canViewAllSales),
        fetchInvoices(user, canViewAllSales),
        fetchSalesTargets(user, canViewAllSales),
      ]);
      if (cancelled) return;
      setLeads(l);
      setInvoices(i);
      setTargets(t);
    };
    void load();
    return () => { cancelled = true; };
  }, [user.id, canViewAllSales]);

  const monthKey = useMemo(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }, []);

  const myMonthTarget = useMemo(() => {
    return targets.find((t) => t.userId === user.id && t.month === monthKey.month && t.year === monthKey.year);
  }, [targets, user.id, monthKey.month, monthKey.year]);

  const myLeads = useMemo(() => leads.filter((l) => l.userId === user.id), [leads, user.id]);
  const myInvoices = useMemo(() => invoices.filter((i) => i.userId === user.id), [invoices, user.id]);
  const scopeLeads = canViewAllSales ? leads : myLeads;
  const scopeInvoices = canViewAllSales ? invoices : myInvoices;

  const totals = useMemo(() => {
    const openLeads = scopeLeads.filter((l) => !['won', 'lost'].includes(String(l.status))).length;
    const won = scopeLeads.filter((l) => String(l.status) === 'won').length;
    const pipelineValue = scopeLeads
      .filter((l) => !['lost'].includes(String(l.status)))
      .reduce((acc, l) => acc + Number(l.estimatedValue || 0), 0);
    const unpaidInvoices = scopeInvoices.filter((i) => i.status !== 'paid' && i.status !== 'void').length;
    const revenuePaid = scopeInvoices.filter((i) => i.status === 'paid').reduce((acc, i) => acc + Number(i.amount || 0), 0);
    return { openLeads, won, pipelineValue, unpaidInvoices, revenuePaid };
  }, [scopeLeads, scopeInvoices]);

  const kpiTile =
    'group p-6 rounded-2xl border border-slate-200/80 dark:border-blue-400/20 bg-white/90 dark:bg-[linear-gradient(180deg,#141f4e_0%,#0d1739_100%)] shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] flex items-center justify-between text-left hover:border-gold/40 transition-all active:scale-[0.98]';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10 text-slate-900 dark:text-slate-100">
      <div className="liquid-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Sales Dashboard</h2>
            <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60 font-semibold">
              Leads, targets, and invoices for the Sales department.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={() => onNavigate('leads')} className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow">
              Open Leads
            </button>
            <button onClick={() => onNavigate('invoices')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
              Open Invoices
            </button>
            <button onClick={() => onNavigate('salesTargets')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
              Targets / KPIs
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: `${canViewAllSales ? 'Team' : 'My'} Open Leads`, value: totals.openLeads.toString(), icon: 'fa-user-tag', action: 'leads' },
          { label: `${canViewAllSales ? 'Team' : 'My'} Deals Won`, value: totals.won.toString(), icon: 'fa-trophy', action: 'leads' },
          { label: `${canViewAllSales ? 'Team' : 'My'} Pipeline Value`, value: `TZS ${Math.round(totals.pipelineValue).toLocaleString()}`, icon: 'fa-coins', action: 'leads' },
          { label: `${canViewAllSales ? 'Team' : 'My'} Unpaid Invoices`, value: totals.unpaidInvoices.toString(), icon: 'fa-file-invoice-dollar', action: 'invoices' },
        ].map((kpi) => (
          <button key={kpi.label} onClick={() => onNavigate(kpi.action)} className={kpiTile}>
            <div>
              <p className="text-sm text-slate-500 dark:text-blue-100/70 font-medium mb-1">{kpi.label}</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</h3>
              <p className="text-[10px] text-gold mt-2 flex items-center gap-1 font-bold uppercase tracking-widest">
                <i className="fas fa-arrow-up"></i> This month
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-[#0b1536] flex items-center justify-center text-gold shadow-inner border border-slate-200 dark:border-blue-300/15">
              <i className={`fas ${kpi.icon} text-xl`}></i>
            </div>
          </button>
        ))}
      </div>

      <div className="liquid-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Targets / KPIs</h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60 font-semibold">
              Current month: {monthKey.month}/{monthKey.year}
            </p>
          </div>
          <button onClick={() => onNavigate('salesTargets')} className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow">
            Update Targets
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Leads Target</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{myMonthTarget?.leadsTarget ?? 0}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60 font-semibold">
              Progress: {myLeads.length} leads created
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Revenue Target</p>
            <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">TZS {(myMonthTarget?.revenueTarget ?? 0).toLocaleString()}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60 font-semibold">
              Paid: TZS {Math.round(totals.revenuePaid).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
