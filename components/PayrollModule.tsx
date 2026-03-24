import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PayrollRecord, PayslipRecord, SystemUser, UserRole } from '../types';
import { fetchPayrollDashboard, fetchPayslipByPayrollId, hasEmployeeSupabase, processPayroll, subscribeToTableChanges } from '../services/employeeSystemService';

interface PayrollModuleProps {
  user: SystemUser;
  users: SystemUser[];
}

const toMoney = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const PayrollModule: React.FC<PayrollModuleProps> = ({ user, users }) => {
  const isAdmin = user.role !== UserRole.USER;
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [workingDays, setWorkingDays] = useState(26);
  const [defaults, setDefaults] = useState({ basic: 600000, allowances: 0, deductions: 0, score: 80 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePayslip, setActivePayslip] = useState<PayslipRecord | null>(null);

  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const dashboard = useMemo(() => {
    const totalPayroll = records.reduce((sum, r) => sum + (r.netSalary || 0), 0);
    const employeesPaid = new Set(records.map((r) => r.userId)).size;
    const lastRunDate = records[0]?.createdAt ? new Date(records[0].createdAt).toLocaleString('en-GB') : '-';
    return { totalPayroll, employeesPaid, lastRunDate };
  }, [records]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await fetchPayrollDashboard();
      if (!cancelled) setRecords(data);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hasEmployeeSupabase()) return;
    const filter = isAdmin ? undefined : `user_id=eq.${user.id}`;
    const sub = subscribeToTableChanges('payroll', {
      filter,
      onInsert: () => { void fetchPayrollDashboard().then(setRecords); },
      onUpdate: () => { void fetchPayrollDashboard().then(setRecords); },
    });
    return () => sub.unsubscribe();
  }, [user.id, isAdmin]);

  const handleProcess = async () => {
    if (!isAdmin) return;
    setIsProcessing(true);
    try {
      const { processed, skippedUserIds } = await processPayroll(users.filter((u) => u.status === 'ACTIVE'), {
        month,
        year,
        workingDays,
        defaultBasicSalary: defaults.basic,
        defaultAllowancesTotal: defaults.allowances,
        defaultDeductionsTotal: defaults.deductions,
        defaultPerformanceScore: defaults.score,
      });
      if (processed.length) {
        alert(`Processed payroll for ${processed.length} employee(s).`);
      }
      if (skippedUserIds.length) {
        alert(`Skipped ${skippedUserIds.length} employee(s) due to write-once rule (already processed).`);
      }
      const data = await fetchPayrollDashboard();
      setRecords(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Payroll processing failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openPayslip = async (payrollId: string) => {
    const payslip = await fetchPayslipByPayrollId(payrollId);
    if (!payslip) { alert('Payslip not found.'); return; }
    setActivePayslip(payslip);
  };

  const downloadPdf = () => {
    if (!activePayslip) return;
    const b = activePayslip.breakdown || {};
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Zaya Group Ltd', 14, 18);
    doc.setFontSize(12);
    doc.text('Payslip', 14, 28);
    doc.setFontSize(10);
    doc.text(`Employee: ${b.employeeName || ''}`, 14, 38);
    doc.text(`Month/Year: ${b.month || ''}/${b.year || ''}`, 14, 44);

    autoTable(doc, {
      startY: 52,
      head: [['Item', 'Amount']],
      body: [
        ['Basic Salary', toMoney(Number(b.basicSalary || 0))],
        ['Allowances', toMoney(Number(b.allowancesTotal || 0))],
        ['Deductions', toMoney(Number(b.deductionsTotal || 0))],
        ['Performance Bonus', toMoney(Number(b.performanceBonus || 0))],
        ['Net Salary', toMoney(Number(b.netSalary || 0))],
      ],
      styles: { fontSize: 10 },
    });

    doc.save(`Payslip-${b.employeeName || 'employee'}-${b.month}-${b.year}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Payroll</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">
              Payroll processing with write-once rule (per employee + month/year).
            </p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gold">{records.length} runs</span>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'Total Payroll Processed', value: `TZS ${toMoney(dashboard.totalPayroll)}` },
            { label: 'Employees Paid', value: dashboard.employeesPaid.toString() },
            { label: 'Last Run Date', value: dashboard.lastRunDate },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">{s.label}</p>
              <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Run Payroll</h3>
          {!isAdmin && (
            <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60">Only admin can process payroll.</p>
          )}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Month" />
            <input type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Year" />
            <input type="number" min={1} max={31} value={workingDays} onChange={(e) => setWorkingDays(Number(e.target.value))}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Working days" />
            <button
              disabled={!isAdmin || isProcessing}
              onClick={handleProcess}
              className="w-full py-3 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow disabled:opacity-60"
            >
              {isProcessing ? 'Processing...' : 'Process Payroll'}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input type="number" value={defaults.basic} onChange={(e) => setDefaults((p) => ({ ...p, basic: Number(e.target.value) }))}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Default basic salary" />
            <input type="number" value={defaults.allowances} onChange={(e) => setDefaults((p) => ({ ...p, allowances: Number(e.target.value) }))}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Allowances" />
            <input type="number" value={defaults.deductions} onChange={(e) => setDefaults((p) => ({ ...p, deductions: Number(e.target.value) }))}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Deductions" />
            <input type="number" min={0} max={100} value={defaults.score} onChange={(e) => setDefaults((p) => ({ ...p, score: Number(e.target.value) }))}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none" placeholder="Performance score" />
          </div>
          <p className="mt-3 text-[10px] text-slate-500 dark:text-blue-300/60 font-bold uppercase tracking-widest">
            Salary = basic_salary * (days_present / working_days) + allowances - deductions + bonus (score &gt; 80)
          </p>
        </div>
      </div>

      <div className="liquid-panel p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Payslips</h3>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Click a row to view</span>
        </div>
        <div className="mt-4 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-blue-300/60">
              <tr>
                <th className="py-2 pr-3">Employee</th>
                <th className="py-2 pr-3">Month</th>
                <th className="py-2 pr-3">Year</th>
                <th className="py-2 pr-3">Net Salary</th>
                <th className="py-2 pr-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-blue-400/10">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-white/40 dark:hover:bg-slate-900/30 cursor-pointer" onClick={() => void openPayslip(r.id)}>
                  <td className="py-2 pr-3 font-bold text-slate-700 dark:text-white">{userNameById.get(r.userId) || r.userId}</td>
                  <td className="py-2 pr-3 font-mono text-slate-700 dark:text-white">{r.month}</td>
                  <td className="py-2 pr-3 font-mono text-slate-700 dark:text-white">{r.year}</td>
                  <td className="py-2 pr-3 font-black text-slate-900 dark:text-white">TZS {toMoney(r.netSalary)}</td>
                  <td className="py-2 pr-3 text-slate-600 dark:text-blue-200">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : ''}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td className="py-6 text-slate-500 dark:text-blue-300/60" colSpan={5}>No payroll records yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activePayslip && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center" onClick={() => setActivePayslip(null)}>
          <div className="w-full max-w-2xl liquid-panel p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Payslip</h3>
                <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Zaya Group Ltd</p>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadPdf} className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow">
                  Download PDF
                </button>
                <button onClick={() => setActivePayslip(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
                  Close
                </button>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5 text-sm">
              <pre className="whitespace-pre-wrap text-slate-700 dark:text-blue-200 text-xs font-mono">
                {JSON.stringify(activePayslip.breakdown, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollModule;
