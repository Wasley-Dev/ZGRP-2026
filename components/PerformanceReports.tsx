import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UserRole, type AttendanceLog, type DailyReport, type LeaveRequest, type SystemUser } from '../types';
import { fetchAttendanceLogs, fetchDailyReports, fetchLeaveRequests } from '../services/employeeSystemService';

interface PerformanceReportsProps {
  user: SystemUser;
  users: SystemUser[];
}

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const startOfPreviousWeekMonday = () => {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMonday = (day + 6) % 7; // Mon->0 ... Sun->6
  const thisWeekMonday = new Date(now);
  thisWeekMonday.setDate(now.getDate() - diffToMonday);
  thisWeekMonday.setHours(0, 0, 0, 0);
  const prev = new Date(thisWeekMonday);
  prev.setDate(prev.getDate() - 7);
  return prev;
};

const isWeekday = (d: Date) => {
  const day = d.getDay();
  return day !== 0 && day !== 6;
};

const scoreBand = (percent: number) => {
  if (percent >= 86) return { label: 'GREEN', pill: 'bg-green-500/15 border border-green-500/30 text-green-700 dark:text-green-300' };
  if (percent >= 71) return { label: 'AMBER', pill: 'bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300' };
  return { label: 'RED', pill: 'bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300' };
};

const computeWorkedMinutes = (log: AttendanceLog): number => {
  const safeDiffMinutes = (fromIso: string, toIso: string): number => {
    const from = new Date(fromIso).getTime();
    const to = new Date(toIso).getTime();
    if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
    const ms = Math.max(0, to - from);
    return Math.min(24 * 60, Math.round(ms / 60000));
  };

  const segments = Array.isArray(log.segments) ? log.segments : [];
  if (segments.length > 0) {
    return segments.reduce((sum, seg) => {
      if (!seg?.in) return sum;
      const out = seg.out || log.checkOut;
      if (!out) return sum;
      return sum + safeDiffMinutes(seg.in, out);
    }, 0);
  }

  if (!log.checkIn || !log.checkOut) return 0;
  return safeDiffMinutes(log.checkIn, log.checkOut);
};

const PerformanceReports: React.FC<PerformanceReportsProps> = ({ user, users }) => {
  const isAdmin = user.role !== UserRole.USER;
  const [weekStart, setWeekStart] = useState(() => startOfPreviousWeekMonday());
  const [view, setView] = useState<'individual' | 'department' | 'organization'>('individual');
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [attendance, reports, leaves] = await Promise.all([
          fetchAttendanceLogs(user, isAdmin),
          fetchDailyReports(user, isAdmin),
          fetchLeaveRequests(user, isAdmin),
        ]);
        if (cancelled) return;
        setAttendanceLogs(attendance);
        setDailyReports(reports);
        setLeaveRequests(leaves);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load performance data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user.id, isAdmin]);

  const period = useMemo(() => {
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end, startIso: toIsoDate(start), endIso: toIsoDate(end) };
  }, [weekStart]);

  const stats = useMemo(() => {
    const leaveByUser = new Map<string, Set<string>>();
    leaveRequests
      .filter((r) => r.status === 'approved')
      .forEach((r) => {
        const set = leaveByUser.get(r.userId) || new Set<string>();
        const from = new Date(`${r.startDate}T00:00:00`);
        const to = new Date(`${r.endDate}T00:00:00`);
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          if (d.getTime() < period.start.getTime() || d.getTime() > period.end.getTime()) continue;
          if (!isWeekday(d)) continue;
          set.add(toIsoDate(d));
        }
        leaveByUser.set(r.userId, set);
      });

    const expectedWeekdays = (() => {
      let c = 0;
      for (let d = new Date(period.start); d.getTime() <= period.end.getTime(); d.setDate(d.getDate() + 1)) {
        if (isWeekday(d)) c += 1;
      }
      return c;
    })();

    const visibleUsers = isAdmin ? users : users.filter((u) => u.id === user.id);

    const rows = visibleUsers
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => {
        if (u.role !== UserRole.USER) {
          return {
            userId: u.id,
            name: u.name,
            department: u.department || '—',
            role: u.role,
            expectedDays: 0,
            attendancePercent: null as number | null,
            kpiPercent: null as number | null,
            manualScore: typeof u.performanceScore === 'number' ? Math.round(u.performanceScore) : null,
          };
        }

        const leaveDays = leaveByUser.get(u.id) || new Set<string>();
        const expectedDays = Math.max(0, expectedWeekdays - leaveDays.size);
        const expectedMinutes = expectedDays * 8 * 60;

        const workedMinutes = attendanceLogs
          .filter((l) => l.userId === u.id)
          .filter((l) => l.date >= period.startIso && l.date <= period.endIso)
          .reduce((sum, l) => sum + computeWorkedMinutes(l), 0);

        const reportDays = new Set(
          dailyReports
            .filter((r) => r.userId === u.id)
            .map((r) => toIsoDate(new Date(r.createdAt)))
            .filter((iso) => iso >= period.startIso && iso <= period.endIso)
        ).size;

        const attendancePercent = expectedMinutes > 0 ? Math.max(0, Math.min(100, (workedMinutes / expectedMinutes) * 100)) : 100;
        const kpiPercent = expectedDays > 0 ? Math.max(0, Math.min(100, (reportDays / expectedDays) * 100)) : 100;
        const manualScore = typeof u.performanceScore === 'number' ? Math.round(u.performanceScore) : null;

        return { userId: u.id, name: u.name, department: u.department || '—', role: u.role, expectedDays, attendancePercent, kpiPercent, manualScore };
      });

    const valid = rows.filter((r) => typeof r.attendancePercent === 'number' && typeof r.kpiPercent === 'number') as Array<
      (typeof rows)[number] & { attendancePercent: number; kpiPercent: number }
    >;

    const org = {
      employeeCount: valid.length,
      attendanceAvg: valid.length ? valid.reduce((s, r) => s + r.attendancePercent, 0) / valid.length : 100,
      kpiAvg: valid.length ? valid.reduce((s, r) => s + r.kpiPercent, 0) / valid.length : 100,
      manualAvg: valid.length ? valid.reduce((s, r) => s + Number(r.manualScore ?? 0), 0) / valid.length : 0,
    };

    const dept = new Map<string, typeof valid>();
    valid.forEach((r) => {
      const key = r.department || '—';
      const list = dept.get(key) || [];
      list.push(r);
      dept.set(key, list);
    });
    const departments = Array.from(dept.entries())
      .map(([department, list]) => ({
        department,
        employees: list.length,
        attendanceAvg: list.reduce((s, r) => s + r.attendancePercent, 0) / list.length,
        kpiAvg: list.reduce((s, r) => s + r.kpiPercent, 0) / list.length,
        manualAvg: list.reduce((s, r) => s + Number(r.manualScore ?? 0), 0) / list.length,
      }))
      .sort((a, b) => a.department.localeCompare(b.department));

    return { rows, org, departments };
  }, [users, isAdmin, user.id, attendanceLogs, dailyReports, leaveRequests, period.start, period.end, period.startIso, period.endIso]);

  const buildPdf = (kind: typeof view, mode: 'download' | 'print') => {
    const titleByKind = {
      individual: 'Individual Employee Weekly Report',
      department: 'Department / Team Weekly Report',
      organization: 'Organizational Weekly Report',
    } as const;

    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(`Zaya Group Portal — ${titleByKind[kind]}`, 14, 18);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Week: ${period.startIso} to ${period.endIso}`, 14, 26);

    if (kind === 'individual') {
      autoTable(pdf, {
        startY: 32,
        head: [['Employee', 'Department', 'Expected Days', 'Attendance %', 'KPI %', 'Manual Score']],
        body: stats.rows.map((r) => [
          r.name,
          r.department,
          String(r.expectedDays),
          typeof r.attendancePercent === 'number' ? `${Math.round(r.attendancePercent)}%` : 'EXEMPT',
          typeof r.kpiPercent === 'number' ? `${Math.round(r.kpiPercent)}%` : 'EXEMPT',
          r.manualScore !== null ? `${r.manualScore}/100` : '-',
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 51, 102] },
      });
    } else if (kind === 'department') {
      autoTable(pdf, {
        startY: 32,
        head: [['Department', 'Employees', 'Avg Attendance %', 'Avg KPI %', 'Avg Manual']],
        body: stats.departments.map((d) => [
          d.department,
          String(d.employees),
          `${Math.round(d.attendanceAvg)}%`,
          `${Math.round(d.kpiAvg)}%`,
          `${Math.round(d.manualAvg)}/100`,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [0, 51, 102] },
      });
    } else {
      autoTable(pdf, {
        startY: 32,
        head: [['Metric', 'Value']],
        body: [
          ['Employees included', String(stats.org.employeeCount)],
          ['Avg Attendance', `${Math.round(stats.org.attendanceAvg)}%`],
          ['Avg KPI Submission', `${Math.round(stats.org.kpiAvg)}%`],
          ['Avg Manual Performance', `${Math.round(stats.org.manualAvg)}/100`],
        ],
        styles: { fontSize: 9 },
        headStyles: { fillColor: [0, 51, 102] },
      });
    }

    const filename = `weekly_${kind}_report_${period.startIso}_to_${period.endIso}.pdf`;
    if (mode === 'download') {
      pdf.save(filename);
      return;
    }

    try {
      pdf.autoPrint();
      const url = pdf.output('bloburl');
      window.open(url, '_blank');
    } catch {
      pdf.save(filename);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Performance & Weekly Reports</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-blue-300/60">
              Attendance + KPI submission performance for the week, with downloadable/printable reports (admin/super admin).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={period.startIso}
              onChange={(e) => setWeekStart(new Date(`${e.target.value}T00:00:00`))}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              title="Week start (Monday recommended)"
            />
            <div className="px-3 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Org Attendance</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">{Math.round(stats.org.attendanceAvg)}%</p>
            </div>
            <div className="px-3 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Org KPI</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">{Math.round(stats.org.kpiAvg)}%</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-300/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { id: 'individual', label: 'Individual' },
            { id: 'department', label: 'Department / Team' },
            { id: 'organization', label: 'Organization' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id as any)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                view === t.id
                  ? 'bg-gold text-enterprise-blue border-gold shadow'
                  : 'border-slate-200 dark:border-blue-400/20 text-slate-700 dark:text-white hover:border-gold'
              }`}
            >
              {t.label}
            </button>
          ))}
          {isAdmin && (
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                onClick={() => buildPdf(view, 'download')}
                className="px-4 py-2 rounded-xl bg-enterprise-blue text-white text-[10px] font-black uppercase tracking-widest shadow hover:brightness-110"
              >
                Download PDF
              </button>
              <button
                onClick={() => buildPdf(view, 'print')}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white hover:border-gold"
              >
                Print
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="liquid-panel p-6">
        {loading ? (
          <div className="py-10 text-slate-500 dark:text-blue-300/60 font-semibold">Loading weekly report data…</div>
        ) : view === 'individual' ? (
          <div className="overflow-auto">
            <table className="min-w-[980px] w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-blue-300/60">
                <tr>
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Department</th>
                  <th className="py-2 pr-3">Expected Days</th>
                  <th className="py-2 pr-3">Attendance</th>
                  <th className="py-2 pr-3">KPI Submissions</th>
                  <th className="py-2 pr-3">Manual Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-blue-400/10">
                {stats.rows.map((r) => {
                  const attendanceBand = typeof r.attendancePercent === 'number' ? scoreBand(r.attendancePercent) : null;
                  const kpiBand = typeof r.kpiPercent === 'number' ? scoreBand(r.kpiPercent) : null;
                  return (
                    <tr key={`wk-${r.userId}`}>
                      <td className="py-2 pr-3 font-bold text-slate-700 dark:text-white">{r.name}</td>
                      <td className="py-2 pr-3 text-slate-600 dark:text-blue-200">{r.department}</td>
                      <td className="py-2 pr-3 font-mono text-slate-700 dark:text-white">{r.expectedDays}</td>
                      <td className="py-2 pr-3">
                        {typeof r.attendancePercent === 'number' ? (
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${attendanceBand?.pill || ''}`}>
                            {Math.round(r.attendancePercent)}% {attendanceBand?.label}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exempt</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {typeof r.kpiPercent === 'number' ? (
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${kpiBand?.pill || ''}`}>
                            {Math.round(r.kpiPercent)}% {kpiBand?.label}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exempt</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-black text-slate-900 dark:text-white">
                        {r.manualScore !== null ? `${r.manualScore}/100` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : view === 'department' ? (
          <div className="overflow-auto">
            <table className="min-w-[820px] w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-blue-300/60">
                <tr>
                  <th className="py-2 pr-3">Department</th>
                  <th className="py-2 pr-3">Employees</th>
                  <th className="py-2 pr-3">Avg Attendance</th>
                  <th className="py-2 pr-3">Avg KPI</th>
                  <th className="py-2 pr-3">Avg Manual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-blue-400/10">
                {stats.departments.map((d) => {
                  const attendanceBand = scoreBand(d.attendanceAvg);
                  const kpiBand = scoreBand(d.kpiAvg);
                  return (
                    <tr key={`dept-${d.department}`}>
                      <td className="py-2 pr-3 font-bold text-slate-700 dark:text-white">{d.department}</td>
                      <td className="py-2 pr-3 font-mono text-slate-700 dark:text-white">{d.employees}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${attendanceBand.pill}`}>
                          {Math.round(d.attendanceAvg)}% {attendanceBand.label}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${kpiBand.pill}`}>
                          {Math.round(d.kpiAvg)}% {kpiBand.label}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-black text-slate-900 dark:text-white">{Math.round(d.manualAvg)}/100</td>
                    </tr>
                  );
                })}
                {stats.departments.length === 0 && (
                  <tr>
                    <td className="py-6 text-slate-500 dark:text-blue-300/60" colSpan={5}>No department performance data for this week.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Employees Included', value: stats.org.employeeCount.toString(), icon: 'fa-users' },
              { label: 'Avg Attendance', value: `${Math.round(stats.org.attendanceAvg)}%`, icon: 'fa-user-clock' },
              { label: 'Avg KPI Submission', value: `${Math.round(stats.org.kpiAvg)}%`, icon: 'fa-clipboard-list' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">{kpi.label}</p>
                  <i className={`fas ${kpi.icon} text-gold`}></i>
                </div>
                <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</p>
              </div>
            ))}
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5 md:col-span-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Notes</p>
              <p className="mt-2 text-xs text-slate-600 dark:text-blue-200">
                Attendance uses worked hours vs expected hours (8h weekdays). KPI submission uses daily report submissions per expected workday. Leave-approved days are excluded.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceReports;

