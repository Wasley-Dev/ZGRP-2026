import React, { useEffect, useMemo, useState } from 'react';
import type { AttendanceLog, DailyReport, LeaveRequest } from '../types';
import { SystemUser, UserRole } from '../types';
import { fetchAttendanceLogs, fetchDailyReports, fetchLeaveRequests } from '../services/employeeSystemService';

interface EmploymentManagementProps {
  users: SystemUser[];
  currentUser: SystemUser;
  onUpdateUsers: (updated: SystemUser[]) => void;
}

const EmploymentManagement: React.FC<EmploymentManagementProps> = ({ users, currentUser, onUpdateUsers }) => {
  const isSuperAdminViewer = currentUser.role === UserRole.SUPER_ADMIN;
  const isAdminViewer = currentUser.role !== UserRole.USER;
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(() => users[0]?.id || currentUser.id);
  const [isEditing, setIsEditing] = useState(false);
  const [reviewMonth, setReviewMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    department: '',
    jobTitle: '',
    phone: '',
    status: 'ACTIVE' as SystemUser['status'],
    baseSalary: '',
    allowancesTotal: '',
    deductionsTotal: '',
    performanceScore: '',
  });

  const normalizedUsers = useMemo(
    () => users.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedUsers;
    return normalizedUsers.filter((u) => {
      const roleLabel = u.role;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (u.jobTitle || '').toLowerCase().includes(q) ||
        roleLabel.toLowerCase().includes(q)
      );
    });
  }, [normalizedUsers, query]);

  const selectedUser = useMemo(() => {
    const hit = users.find((u) => u.id === selectedId);
    return hit || users[0] || currentUser;
  }, [users, selectedId, currentUser]);

  const isProtectedTarget = selectedUser.role === UserRole.SUPER_ADMIN && !isSuperAdminViewer;
  const visibleRole = isProtectedTarget ? UserRole.USER : selectedUser.role;
  const canEditTarget = isSuperAdminViewer || selectedUser.role !== UserRole.SUPER_ADMIN;

  React.useEffect(() => {
    setIsEditing(false);
    setDraft({
      department: selectedUser.department || '',
      jobTitle: selectedUser.jobTitle || '',
      phone: selectedUser.phone || '',
      status: selectedUser.status,
      baseSalary: typeof selectedUser.baseSalary === 'number' ? String(selectedUser.baseSalary) : '',
      allowancesTotal: typeof selectedUser.allowancesTotal === 'number' ? String(selectedUser.allowancesTotal) : '',
      deductionsTotal: typeof selectedUser.deductionsTotal === 'number' ? String(selectedUser.deductionsTotal) : '',
      performanceScore: typeof selectedUser.performanceScore === 'number' ? String(selectedUser.performanceScore) : '',
    });
  }, [selectedUser.id]);

  useEffect(() => {
    if (!isAdminViewer) return;
    let cancelled = false;
    const load = async () => {
      setReviewLoading(true);
      setReviewError(null);
      try {
        const [attendance, reports, leaves] = await Promise.all([
          fetchAttendanceLogs(currentUser, true),
          fetchDailyReports(currentUser, true),
          fetchLeaveRequests(currentUser, true),
        ]);
        if (cancelled) return;
        setAttendanceLogs(attendance);
        setDailyReports(reports);
        setLeaveRequests(leaves);
      } catch (err) {
        if (cancelled) return;
        setReviewError(err instanceof Error ? err.message : 'Failed to load attendance/performance data.');
      } finally {
        if (!cancelled) setReviewLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isAdminViewer, currentUser.id]);

  const toMoney = (n?: number) =>
    typeof n === 'number' ? `TZS ${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : '-';

  const toIsoDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const isWeekday = (d: Date) => {
    const day = d.getDay();
    return day !== 0 && day !== 6;
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

  const scoreBand = (percent: number) => {
    if (percent >= 86) return { label: 'GREEN', pill: 'bg-green-500/15 border border-green-500/30 text-green-700 dark:text-green-300' };
    if (percent >= 71) return { label: 'AMBER', pill: 'bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300' };
    return { label: 'RED', pill: 'bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-300' };
  };

  const monthStats = useMemo(() => {
    const start = new Date(reviewMonth.getFullYear(), reviewMonth.getMonth(), 1);
    const end = new Date(reviewMonth.getFullYear(), reviewMonth.getMonth() + 1, 0);
    const now = new Date();

    let progressEnd = end;
    if (reviewMonth.getFullYear() === now.getFullYear() && reviewMonth.getMonth() === now.getMonth()) {
      progressEnd = new Date(now);
      progressEnd.setDate(progressEnd.getDate() - 1);
      progressEnd.setHours(23, 59, 59, 999);
    }
    if (progressEnd.getTime() < start.getTime()) {
      progressEnd = new Date(start.getTime() - 1);
    }

    const leaveByUser = new Map<string, Set<string>>();
    leaveRequests
      .filter((r) => r.status === 'approved')
      .forEach((r) => {
        const set = leaveByUser.get(r.userId) || new Set<string>();
        const from = new Date(`${r.startDate}T00:00:00`);
        const to = new Date(`${r.endDate}T00:00:00`);
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          if (d.getTime() < start.getTime() || d.getTime() > progressEnd.getTime()) continue;
          if (!isWeekday(d)) continue;
          set.add(toIsoDate(d));
        }
        leaveByUser.set(r.userId, set);
      });

    const rows = users
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => {
        if (u.role !== UserRole.USER) {
          return {
            userId: u.id,
            name: u.name,
            role: u.role,
            attendancePercent: null as number | null,
            kpiPercent: null as number | null,
            expectedDays: 0,
            workedMinutes: 0,
            reportDays: 0,
          };
        }

        const leaveDays = leaveByUser.get(u.id) || new Set<string>();
        let expectedDays = 0;
        for (let d = new Date(start); d.getTime() <= progressEnd.getTime(); d.setDate(d.getDate() + 1)) {
          if (!isWeekday(d)) continue;
          const iso = toIsoDate(d);
          if (leaveDays.has(iso)) continue;
          expectedDays += 1;
        }

        const workedMinutes = attendanceLogs
          .filter((l) => l.userId === u.id)
          .filter((l) => l.date >= toIsoDate(start) && l.date <= toIsoDate(progressEnd))
          .reduce((sum, l) => sum + computeWorkedMinutes(l), 0);

        const reportDays = new Set(
          dailyReports
            .filter((r) => r.userId === u.id)
            .map((r) => toIsoDate(new Date(r.createdAt)))
            .filter((iso) => iso >= toIsoDate(start) && iso <= toIsoDate(progressEnd))
        ).size;

        const expectedMinutes = expectedDays * 8 * 60;
        const attendancePercent = expectedMinutes > 0 ? Math.max(0, Math.min(100, (workedMinutes / expectedMinutes) * 100)) : 100;
        const kpiPercent = expectedDays > 0 ? Math.max(0, Math.min(100, (reportDays / expectedDays) * 100)) : 100;

        return {
          userId: u.id,
          name: u.name,
          role: u.role,
          attendancePercent,
          kpiPercent,
          expectedDays,
          workedMinutes,
          reportDays,
        };
      });

    const valid = rows.filter((r) => typeof r.attendancePercent === 'number' && typeof r.kpiPercent === 'number') as Array<
      (typeof rows)[number] & { attendancePercent: number; kpiPercent: number }
    >;

    const teamAttendance = valid.length ? valid.reduce((sum, r) => sum + r.attendancePercent, 0) / valid.length : 100;
    const teamKpi = valid.length ? valid.reduce((sum, r) => sum + r.kpiPercent, 0) / valid.length : 100;

    return {
      startIso: toIsoDate(start),
      endIso: toIsoDate(end),
      progressEndIso: progressEnd.getTime() >= start.getTime() ? toIsoDate(progressEnd) : null,
      rows,
      teamAttendance,
      teamKpi,
    };
  }, [users, reviewMonth, attendanceLogs, dailyReports, leaveRequests]);

  const saveEdits = () => {
    if (!canEditTarget) return;
    const nextUsers = users.map((u) => {
      if (u.id !== selectedUser.id) return u;
      const baseSalary = draft.baseSalary.trim() ? Number(draft.baseSalary) : undefined;
      const allowancesTotal = draft.allowancesTotal.trim() ? Number(draft.allowancesTotal) : undefined;
      const deductionsTotal = draft.deductionsTotal.trim() ? Number(draft.deductionsTotal) : undefined;
      const performanceScore = draft.performanceScore.trim() ? Number(draft.performanceScore) : undefined;
      return {
        ...u,
        department: draft.department.trim() || u.department,
        jobTitle: draft.jobTitle.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        status: draft.status,
        baseSalary: Number.isFinite(baseSalary as any) ? baseSalary : u.baseSalary,
        allowancesTotal: Number.isFinite(allowancesTotal as any) ? allowancesTotal : u.allowancesTotal,
        deductionsTotal: Number.isFinite(deductionsTotal as any) ? deductionsTotal : u.deductionsTotal,
        performanceScore: Number.isFinite(performanceScore as any) ? performanceScore : u.performanceScore,
      };
    });
    onUpdateUsers(nextUsers);
    setIsEditing(false);
    alert('Employee profile updated.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Employment Management</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Employee directory and profile details (admin-only).</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gold">{users.length} employees</span>
        </div>
      </div>

      {isAdminViewer && (
        <div className="liquid-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Attendance Review (Team)</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-blue-300/60">
                Month starts at 100% and drops based on hours worked vs expected hours (8h weekdays). Green 100–86, Amber 85–71, Red ≤70.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="month"
                value={`${reviewMonth.getFullYear()}-${String(reviewMonth.getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => {
                  const [yy, mm] = e.target.value.split('-').map((v) => Number(v));
                  if (!yy || !mm) return;
                  setReviewMonth(new Date(yy, mm - 1, 1));
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              />
              <div className="px-3 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Team Attendance</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{Math.round(monthStats.teamAttendance)}%</p>
              </div>
              <div className="px-3 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Team KPI</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{Math.round(monthStats.teamKpi)}%</p>
              </div>
            </div>
          </div>

          {reviewError && (
            <div className="mt-4 rounded-2xl border border-red-300/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-200">
              {reviewError}
            </div>
          )}

          <div className="mt-4 overflow-auto rounded-2xl border border-slate-200 dark:border-blue-400/20">
            <table className="min-w-[900px] w-full text-left text-xs">
              <thead className="bg-white/50 dark:bg-slate-950/30 text-[10px] uppercase tracking-widest text-slate-500 dark:text-blue-300/60">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Expected Days</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">KPI Submissions</th>
                  <th className="py-3 px-4">Manual Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-blue-400/10 bg-white/40 dark:bg-slate-950/20">
                {monthStats.rows.map((row) => {
                  const attendance = row.attendancePercent;
                  const kpi = row.kpiPercent;
                  const user = users.find((u) => u.id === row.userId);
                  const performanceScore = typeof user?.performanceScore === 'number' ? Math.round(user.performanceScore) : null;
                  const attendanceBand = typeof attendance === 'number' ? scoreBand(attendance) : null;
                  const kpiBand = typeof kpi === 'number' ? scoreBand(kpi) : null;
                  return (
                    <tr key={`att-${row.userId}`}>
                      <td className="py-3 px-4">
                        <p className="font-black text-slate-900 dark:text-white truncate">{row.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-300/60">{user?.department || '—'}</p>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-blue-200">{row.expectedDays}</td>
                      <td className="py-3 px-4">
                        {typeof attendance === 'number' ? (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${attendanceBand?.pill || ''}`}>
                              {Math.round(attendance)}% {attendanceBand?.label}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-blue-300/60">
                              {Math.round(row.workedMinutes / 60)}h / {row.expectedDays * 8}h
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exempt</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {typeof kpi === 'number' ? (
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${kpiBand?.pill || ''}`}>
                              {Math.round(kpi)}% {kpiBand?.label}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-blue-300/60">
                              {row.reportDays} / {row.expectedDays}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Exempt</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
                          {performanceScore !== null ? `${performanceScore}/100` : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {reviewLoading && (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-slate-500 dark:text-blue-300/60 font-semibold">
                      Loading team attendance…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="liquid-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Employees</h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{filteredUsers.length} shown</span>
          </div>
          <div className="mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full p-3 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              placeholder="Search name, email, department, title…"
            />
          </div>
          <div className="mt-4 max-h-[520px] overflow-auto space-y-2 pr-1">
            {filteredUsers.map((u) => {
              const isSelected = u.id === selectedId;
              const maskedRole = !isSuperAdminViewer && u.role === UserRole.SUPER_ADMIN ? UserRole.USER : u.role;
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                    isSelected
                      ? 'border-gold bg-gold/10'
                      : 'border-slate-200 dark:border-blue-400/20 bg-white/50 dark:bg-slate-950/30 hover:border-gold'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">{u.name}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-300/60 truncate">
                        {u.jobTitle || maskedRole} • {u.department || '—'}
                      </p>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${u.status === 'ACTIVE' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {u.status}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredUsers.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-blue-400/20 p-8 text-center text-slate-500 dark:text-blue-300/60">
                No employees match this search.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 liquid-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-14 w-14 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 overflow-hidden">
                <img
                  src={selectedUser.avatar || '/apple-touch-icon.png'}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white truncate">{selectedUser.name}</h3>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gold">
                  {selectedUser.jobTitle || visibleRole}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Role</p>
              <p className="mt-1 text-xs font-black text-slate-900 dark:text-white">{visibleRole}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 justify-end">
            <button
              disabled={!canEditTarget}
              onClick={() => setIsEditing((v) => !v)}
              className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow disabled:opacity-60"
            >
              {isEditing ? 'Close Edit' : 'Edit Employee'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Department</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedUser.department || '-'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Job Title</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedUser.jobTitle || '-'}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Email</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white break-all">
                {isProtectedTarget ? 'Hidden' : selectedUser.email}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Phone</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{isProtectedTarget ? 'Hidden' : (selectedUser.phone || '-')}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Last Login</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString('en-GB') : '-'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Status</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedUser.status}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Base Salary</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{toMoney(selectedUser.baseSalary)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Performance Score</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {typeof selectedUser.performanceScore === 'number' ? `${Math.round(selectedUser.performanceScore)}/100` : '-'}
              </p>
            </div>
          </div>

          {isEditing && (
            <div className="mt-6 rounded-3xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Edit Details</h4>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={draft.department}
                  onChange={(e) => setDraft((p) => ({ ...p, department: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Department"
                />
                <input
                  value={draft.jobTitle}
                  onChange={(e) => setDraft((p) => ({ ...p, jobTitle: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Job title"
                />
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Phone"
                />
                <select
                  value={draft.status}
                  onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value as any }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="BANNED">BANNED</option>
                </select>
                <input
                  type="number"
                  value={draft.baseSalary}
                  onChange={(e) => setDraft((p) => ({ ...p, baseSalary: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Base salary (TZS)"
                />
                <input
                  type="number"
                  value={draft.allowancesTotal}
                  onChange={(e) => setDraft((p) => ({ ...p, allowancesTotal: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Allowances total"
                />
                <input
                  type="number"
                  value={draft.deductionsTotal}
                  onChange={(e) => setDraft((p) => ({ ...p, deductionsTotal: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Deductions total"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.performanceScore}
                  onChange={(e) => setDraft((p) => ({ ...p, performanceScore: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Performance score (0-100)"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  disabled={!canEditTarget}
                  onClick={saveEdits}
                  className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow disabled:opacity-60"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmploymentManagement;
