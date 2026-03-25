import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  Area
} from 'recharts';

import { AttendanceCheckoutRequest, BookingEntry, Candidate, Notice, RecruitmentStatus, SystemUser, TaskItem, UserRole } from '../types';
import { getTodayIsoInEAT } from '../services/dateTime';
import { clockIn, clockOut, fetchDailyReports, fetchLatestMiddayCheckoutRequest, fetchNotices, fetchTasks, fetchTodayAttendance, hasEmployeeSupabase, midDayClockOut, requestClockOutApproval, setTaskStatus, subscribeToTableChanges } from '../services/employeeSystemService';

interface DashboardProps {
  onNavigate: (module: string) => void;
  candidatesCount: number;
  candidates: Candidate[];
  bookings: BookingEntry[];
  user: SystemUser;
}

const DashboardOverview: React.FC<DashboardProps> = ({ onNavigate, candidatesCount, candidates, bookings, user }) => {
  const todayIsoInEAT = getTodayIsoInEAT();
  const isAdminExempt = user.role === UserRole.ADMIN;
  const isEmployee = user.role === UserRole.USER;
  const isAdminOrSuper = user.role !== UserRole.USER;
  const [todayAttendance, setTodayAttendance] = React.useState<any>(null);
  const [myReportsCount, setMyReportsCount] = React.useState(0);
  const [weeklyReportsCount, setWeeklyReportsCount] = React.useState(0);
  const [checkoutReason, setCheckoutReason] = React.useState('');
  const [checkoutRequest, setCheckoutRequest] = React.useState<AttendanceCheckoutRequest | null>(null);
  const [myTasks, setMyTasks] = React.useState<TaskItem[]>([]);
  const [latestNotices, setLatestNotices] = React.useState<Notice[]>([]);

  const isCurrentlyCheckedIn = React.useMemo(() => {
    if (!todayAttendance?.checkIn) return false;
    if (todayAttendance?.checkOut) return false;
    const segments = Array.isArray(todayAttendance?.segments) ? todayAttendance.segments : [];
    if (segments.length === 0) return true;
    const last = segments[segments.length - 1];
    return Boolean(last?.in && !last?.out);
  }, [todayAttendance]);

  const statusLabel = React.useMemo(() => {
    if (!todayAttendance?.checkIn) return 'Not Checked In';
    if (todayAttendance?.checkOut) return 'Checked Out';
    return isCurrentlyCheckedIn ? 'Checked In' : 'Mid-day Checked Out';
  }, [todayAttendance, isCurrentlyCheckedIn]);
  const panelClass =
    'rounded-3xl border border-slate-200/80 dark:border-blue-400/20 bg-white/90 dark:bg-[linear-gradient(180deg,#121c46_0%,#0b1431_100%)] shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur';
  const tileClass =
    'group p-4 rounded-2xl bg-white/70 dark:bg-slate-900/50 border border-slate-200 dark:border-blue-400/20 hover:border-gold transition-all cursor-pointer';
  const trainingCount = candidates.filter((c) => c.status === RecruitmentStatus.TRAINING).length;
  const interviewCount = candidates.filter((c) => c.status === RecruitmentStatus.INTERVIEW).length;
  const deployedCount = candidates.filter((c) => c.status === RecruitmentStatus.DEPLOYMENT).length;
  const pendingCount = candidates.filter((c) => c.status === RecruitmentStatus.PENDING).length;
  const appliedCount = candidates.length;
  // Calculate compliance data from candidates
  const complianceStats = React.useMemo(() => {
    let complete = 0;
    let incomplete = 0;
    let missing = 0;

    candidates.forEach(c => {
      const docs = Object.values(c.documents);
      const completedDocs = docs.filter(d => d === 'COMPLETE').length;
      const totalDocs = docs.length;

      if (completedDocs === totalDocs) complete++;
      else if (completedDocs > 0) incomplete++;
      else missing++;
    });

    return [
      { name: 'Complete', value: complete, color: '#22c55e' },
      { name: 'Incomplete', value: incomplete, color: '#f59e0b' },
      { name: 'Missing', value: missing, color: '#ef4444' },
    ];
  }, [candidates]);

  const monthlyStatus = React.useMemo(() => {
    const monthMap = new Map<string, { recruitment: number; deployment: number; training: number }>();
    const fmt = new Intl.DateTimeFormat('en', { month: 'short' });
    const now = new Date();
    const maxMonth = now.getFullYear() === 2026 ? now.getMonth() : 11;
    for (let month = 0; month <= maxMonth; month += 1) {
      const d = new Date(2026, month, 1);
      const label = fmt.format(d);
      monthMap.set(label, { recruitment: 0, deployment: 0, training: 0 });
    }
    candidates.forEach((c) => {
      const d = new Date(c.createdAt);
      const label = fmt.format(d);
      const bucket = monthMap.get(label);
      if (!bucket) return;
      bucket.recruitment += 1;
      if (c.status === RecruitmentStatus.DEPLOYMENT) bucket.deployment += 1;
      if (c.status === RecruitmentStatus.TRAINING) bucket.training += 1;
    });
    return Array.from(monthMap.entries()).map(([name, value]) => ({ name, ...value }));
  }, [candidates]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [reports, attendance, tasks, notices] = await Promise.all([
          fetchDailyReports(user, false),
          fetchTodayAttendance(user),
          fetchTasks(user, user.role !== UserRole.USER),
          fetchNotices(),
        ]);
        if (cancelled) return;
        setTodayAttendance(attendance);
        setCheckoutRequest(attendance?.id ? await fetchLatestMiddayCheckoutRequest(String(attendance.id)) : null);
        setMyReportsCount(reports.length);
        setMyTasks(tasks);
        setLatestNotices(notices.slice(0, 12));
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        setWeeklyReportsCount(reports.filter((r) => new Date(r.createdAt).getTime() >= weekAgo.getTime()).length);
      } catch {
        // ignore
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user.id]);

  React.useEffect(() => {
    if (!hasEmployeeSupabase()) return;
    if (!todayAttendance?.id) return;
    const attendanceId = String(todayAttendance.id);
    const toRequest = (row: any): AttendanceCheckoutRequest => ({
      id: String(row.id),
      attendanceId: String(row.attendance_id),
      userId: String(row.user_id),
      date: String(row.date),
      reason: row.reason ? String(row.reason) : undefined,
      status: String(row.status || 'pending') === 'approved' ? 'approved' : String(row.status || 'pending') === 'denied' ? 'denied' : 'pending',
      requestedAt: String(row.requested_at || row.created_at || ''),
      decidedAt: row.decided_at ? String(row.decided_at) : undefined,
    });

    const sub = subscribeToTableChanges('attendance_checkout_requests', {
      filter: `attendance_id=eq.${attendanceId}`,
      onInsert: (row) => setCheckoutRequest(toRequest(row)),
      onUpdate: (row) => setCheckoutRequest(toRequest(row)),
    });
    return () => sub.unsubscribe();
  }, [todayAttendance?.id]);

  const handleClockIn = async () => {
    try {
      const next = await clockIn(user);
      setTodayAttendance(next);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Clock in failed.');
    }
  };

  const handleRequestCheckout = async () => {
    if (!todayAttendance?.checkIn || !todayAttendance?.id) { alert('Clock in first.'); return; }
    if (todayAttendance.checkOut) { alert('You already checked out today.'); return; }
    if (!isCurrentlyCheckedIn) { alert('You must be checked in to request a mid-day checkout.'); return; }
    try {
      const created = await requestClockOutApproval(user, todayAttendance, checkoutReason.trim());
      setCheckoutRequest(created);
      alert('Approval request sent to gm@zayagroupltd.com.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to send approval email.');
    }
  };

  const handleMidDayCheckout = async () => {
    if (!todayAttendance?.checkIn || !todayAttendance?.id) { alert('Clock in first.'); return; }
    try {
      const next = await midDayClockOut(user, todayAttendance);
      setTodayAttendance(next);
      setCheckoutReason('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Mid-day checkout failed.');
    }
  };

  const handleClockOut = async () => {
    if (!todayAttendance?.checkIn || !todayAttendance?.id) { alert('Clock in first.'); return; }
    try {
      const next = await clockOut(user, todayAttendance);
      setTodayAttendance(next);
      setCheckoutReason('');
      setCheckoutRequest(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Clock out failed.');
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setMyTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'completed' } : t)));
    try {
      await setTaskStatus(taskId, 'completed');
    } catch {
      // Keep optimistic state even if offline
    }
  };

  const upcomingOps = React.useMemo(
    () => [
      {
        title: 'Interviews Today',
        items: (bookings.length ? bookings : [])
          .filter((b) => b.date === todayIsoInEAT)
          .slice(0, 2)
          .map((b) => `${b.booker} (${b.time})`),
        icon: 'fa-comments',
        color: 'blue',
        action: 'booking',
      },
      {
        title: 'Trainings Scheduled',
        items: [`Candidates in training: ${trainingCount}`, `Pending interviews: ${interviewCount}`],
        icon: 'fa-graduation-cap',
        color: 'amber',
        action: 'recruitment',
      },
      {
        title: 'Deployments',
        items: [`Ready for deployment: ${deployedCount}`, `Pending review: ${pendingCount}`],
        icon: 'fa-shipping-fast',
        color: 'green',
        action: 'recruitment',
      },
      {
        title: 'Documentation Deadlines',
        items: [`Total candidates: ${appliedCount}`, `Open records need review`],
        icon: 'fa-file-exclamation',
        color: 'red',
        action: 'database',
      },
      { title: 'System Maintenance', items: ['Daily auto-backup at 15:00', 'Realtime sync active'], icon: 'fa-tools', color: 'slate', action: 'maintenance' },
    ],
    [bookings, trainingCount, interviewCount, deployedCount, pendingCount, appliedCount, todayIsoInEAT]
  );

  // Convert funnelSteps for Chart
  const dataFunnel = [
    { name: 'Applied', value: appliedCount, barValue: Math.max(1, Math.round(appliedCount * 0.8)) },
    { name: 'Screening', value: pendingCount, barValue: Math.max(1, Math.round(pendingCount * 0.8)) },
    { name: 'Interviewed', value: interviewCount, barValue: Math.max(1, Math.round(interviewCount * 0.8)) },
    { name: 'Training', value: trainingCount, barValue: Math.max(1, Math.round(trainingCount * 0.8)) },
    { name: 'Hired/Deployed', value: deployedCount, barValue: Math.max(1, Math.round(deployedCount * 0.8)) },
  ];

  const hiringEfficiency = appliedCount > 0 ? ((deployedCount / appliedCount) * 100).toFixed(1) : '0.0';
  const screeningDropoff = appliedCount > 0 ? (((appliedCount - interviewCount) / appliedCount) * 100).toFixed(1) : '0.0';
  const avgDaysToEvent = bookings.length
    ? (
        bookings.reduce((acc, booking) => {
          const target = new Date(`${booking.date}T00:00:00`);
          const diff = (target.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return acc + Math.max(0, diff);
        }, 0) / bookings.length
      ).toFixed(1)
    : '0.0';

  const handleTrace = () => {
    alert("SYSTEM TRACE: Full schedule synchronization complete. All modules aligned.");
  };

  const handleOpClick = (action: string) => {
    if (action === 'maintenance') {
      if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
        onNavigate('recovery');
      } else {
        onNavigate('settings');
      }
    } else {
      onNavigate(action);
    }
  };

  const getColorClass = (color: string) => {
    switch (color) {
      case 'blue': return 'text-blue-500';
      case 'amber': return 'text-amber-500';
      case 'green': return 'text-green-500';
      case 'red': return 'text-red-500';
      case 'slate': return 'text-slate-500';
      default: return 'text-slate-500';
    }
  };

  const employeeReportingPanel = isAdminExempt ? (
    <div className={`${panelClass} p-8`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Admin Approval Center</h2>
          <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60 font-semibold">
            Admins are exempt from daily reports and attendance. Approve mid-day checkouts in the system or via email links.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={() => onNavigate('admin')} className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow">
            Open Approvals
          </button>
          <button onClick={() => onNavigate('chat')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
            Open Chat
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Performance Reviews', value: `${Math.round(Number(user.performanceScore ?? 0))}/100`, icon: 'fa-star', action: 'settings' },
          { label: 'Notices', value: 'View', icon: 'fa-bell', action: 'notices' },
          { label: 'Tasks', value: 'Manage', icon: 'fa-list', action: 'tasks' },
          { label: 'Admin Console', value: 'Open', icon: 'fa-user-shield', action: 'admin' },
        ].map((kpi) => (
          <button key={kpi.label} onClick={() => onNavigate(kpi.action)} className={`${tileClass} text-left`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">{kpi.label}</p>
                <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-blue-400/20 flex items-center justify-center text-gold shadow-sm">
                <i className={`fas ${kpi.icon}`}></i>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  ) : (
    <div className={`${panelClass} p-8`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Employee Reporting & Performance</h2>
          <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60 font-semibold">Daily reports, attendance, tasks, and payroll.</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={() => onNavigate('dailyReports')} className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow">
            Submit Report
          </button>
          <button onClick={() => onNavigate('attendance')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
            Check Attendance
          </button>
          <button onClick={() => onNavigate('chat')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
            Open Chat
          </button>
          <button onClick={() => onNavigate('tasks')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
            My Tasks
          </button>
          <button onClick={() => onNavigate('notices')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
            Notices
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'My Reports', value: myReportsCount.toString(), icon: 'fa-clipboard-list', action: 'dailyReports' },
          { label: 'Today Attendance', value: todayAttendance?.checkIn ? (todayAttendance.checkOut ? 'OUT' : 'IN') : 'NONE', icon: 'fa-user-clock', action: 'attendance' },
          { label: 'Performance Reviews', value: `${Math.round(Number(user.performanceScore ?? 0))}/100`, icon: 'fa-star', action: 'settings' },
          { label: 'Weekly Reports', value: weeklyReportsCount.toString(), icon: 'fa-calendar-day', action: 'dailyReports' },
        ].map((kpi) => (
          <button key={kpi.label} onClick={() => onNavigate(kpi.action)} className={`${tileClass} text-left`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">{kpi.label}</p>
                <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-blue-400/20 flex items-center justify-center text-gold shadow-sm">
                <i className={`fas ${kpi.icon}`}></i>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Clock In / Clock Out</h3>
          <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60 font-semibold">Mid-day checkout requires GM email approval. End-of-day clock out does not.</p>
          <div className="mt-4 space-y-2 text-sm text-slate-700 dark:text-blue-200">
            <p>Status: <span className="font-black text-slate-900 dark:text-white">{statusLabel}</span></p>
            {todayAttendance?.checkIn && <p>Check-in: <span className="font-mono">{new Date(todayAttendance.checkIn).toLocaleTimeString('en-GB')}</span></p>}
            {todayAttendance?.checkOut && <p>Check-out: <span className="font-mono">{new Date(todayAttendance.checkOut).toLocaleTimeString('en-GB')}</span></p>}
            {!todayAttendance?.checkOut && Array.isArray(todayAttendance?.segments) && todayAttendance.segments?.[todayAttendance.segments.length - 1]?.out && (
              <p>Mid-day out: <span className="font-mono">{new Date(todayAttendance.segments[todayAttendance.segments.length - 1].out).toLocaleTimeString('en-GB')}</span></p>
            )}
          </div>

          <div className="mt-5 space-y-2">
            <button
              onClick={handleClockIn}
              disabled={!!todayAttendance?.checkOut || isCurrentlyCheckedIn}
              className="w-full py-3 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest disabled:opacity-60 border-b-4 border-black/10 hover:brightness-110 active:scale-[0.98]"
            >
              Clock In
            </button>
            <input
              value={checkoutReason}
              onChange={(e) => setCheckoutReason(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              placeholder="Checkout reason (optional)"
            />
            <button
              onClick={handleRequestCheckout}
              disabled={!isCurrentlyCheckedIn || checkoutRequest?.status === 'pending'}
              className="w-full py-3 rounded-xl border border-gold/30 text-gold text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
            >
              {checkoutRequest?.status === 'pending' ? 'Approval Pending' : 'Request Mid-day Approval'}
            </button>
            <button
              onClick={handleMidDayCheckout}
              disabled={!isCurrentlyCheckedIn || checkoutRequest?.status !== 'approved'}
              className="w-full py-3 rounded-xl border border-red-300/40 text-red-600 dark:text-red-300 text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
            >
              Mid-day Checkout {checkoutRequest?.status === 'approved' ? '' : '(Requires Approval)'}
            </button>
            <button
              onClick={handleClockOut}
              disabled={!isCurrentlyCheckedIn}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
            >
              Clock Out (End of Day)
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'Quick Action', title: 'Submit Report', icon: 'fa-pen', action: 'dailyReports', hint: 'Write-once daily reporting' },
            { label: 'Quick Action', title: 'My Tasks', icon: 'fa-list-check', action: 'tasks', hint: 'Tasks assigned to you' },
            { label: 'Quick Action', title: 'View Notices', icon: 'fa-bell', action: 'notices', hint: 'Company announcements' },
            { label: 'Quick Action', title: 'Open Team Chat', icon: 'fa-comments', action: 'chat', hint: 'Realtime messaging' },
          ].map((q) => (
            <button key={q.title} onClick={() => onNavigate(q.action)} className={`${tileClass} text-left`}>
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-blue-400/20 flex items-center justify-center text-gold shadow-sm shrink-0">
                  <i className={`fas ${q.icon}`}></i>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">{q.label}</p>
                  <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{q.title}</p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60 font-semibold">{q.hint}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (isEmployee) {
    const pending = myTasks.filter((t) => t.status !== 'completed');
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10 text-slate-900 dark:text-slate-100">
        {employeeReportingPanel}

        <div className={`${panelClass} p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Tasks & Notices</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60 font-semibold">Your assigned tasks and company-wide notices.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button onClick={() => onNavigate('chat')} className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow">
                Open Chat
              </button>
              <button onClick={() => onNavigate('attendance')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
                Attendance
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Pending Tasks</p>
                <span className="text-[10px] font-black uppercase tracking-widest text-gold">{pending.length}</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-blue-200">
                {pending.slice(0, 8).map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{t.title}</p>
                      <p className="text-[10px] font-mono text-slate-400 dark:text-blue-300/50">{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB') : ''}</p>
                    </div>
                    <button
                      onClick={() => void handleCompleteTask(t.id)}
                      className="px-3 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow shrink-0"
                    >
                      Complete
                    </button>
                  </div>
                ))}
                {pending.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-blue-300/60">No pending tasks.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Latest Notices</p>
                <span className="text-[10px] font-black uppercase tracking-widest text-gold">{latestNotices.length}</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-blue-200">
                {latestNotices.slice(0, 8).map((n) => (
                  <div key={n.id} className="flex items-start justify-between gap-3">
                    <span className="font-semibold truncate">{n.title}</span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-blue-300/50 shrink-0">{n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-GB') : ''}</span>
                  </div>
                ))}
                {latestNotices.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-blue-300/60">No notices yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10 text-slate-900 dark:text-slate-100">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Candidates', value: candidatesCount.toLocaleString(), icon: 'fa-users', color: 'blue', target: 'database' },
          { label: 'In Training', value: trainingCount.toLocaleString(), icon: 'fa-graduation-cap', color: 'amber', target: 'recruitment' },
          { label: 'Interview Stage', value: interviewCount.toLocaleString(), icon: 'fa-comments', color: 'indigo', target: 'recruitment' },
          { label: 'Deployed', value: deployedCount.toLocaleString(), icon: 'fa-check-circle', color: 'gold', target: 'recruitment' },
        ].map((kpi, idx) => (
          <button 
            key={idx} 
            onClick={() => onNavigate(kpi.target)}
            className="group p-6 rounded-2xl border border-slate-200/80 dark:border-blue-400/20 bg-white/90 dark:bg-[linear-gradient(180deg,#141f4e_0%,#0d1739_100%)] shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] flex items-center justify-between text-left hover:shadow-[0_12px_36px_rgba(42,88,255,0.25)] hover:border-gold/40 transition-all active:scale-[0.98]"
          >
            <div>
              <p className="text-sm text-slate-500 dark:text-blue-100/70 font-medium mb-1">{kpi.label}</p>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{kpi.value}</h3>
              <p className="text-xs text-gold mt-2 flex items-center gap-1 font-bold uppercase tracking-widest">
                <i className="fas fa-arrow-up"></i> 12% Growth
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-[#0b1536] flex items-center justify-center text-gold shadow-inner border border-slate-200 dark:border-blue-300/15">
              <i className={`fas ${kpi.icon} text-xl`}></i>
            </div>
          </button>
        ))}
      </div>

      {isAdminOrSuper && (
        <div className={`${panelClass} p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Tasks & Notices</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60 font-semibold">Admin view: pending tasks and latest notices.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button onClick={() => onNavigate('tasks')} className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow">
                Open Tasks
              </button>
              <button onClick={() => onNavigate('notices')} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">
                Open Notices
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Pending Tasks</p>
                <span className="text-[10px] font-black uppercase tracking-widest text-gold">
                  {myTasks.filter((t) => t.status !== 'completed').length}
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-blue-200">
                {myTasks.filter((t) => t.status !== 'completed').slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3">
                    <span className="font-semibold truncate">{t.title}</span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-blue-300/50 shrink-0">{t.userId}</span>
                  </div>
                ))}
                {myTasks.filter((t) => t.status !== 'completed').length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-blue-300/60">No pending tasks.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Latest Notices</p>
                <span className="text-[10px] font-black uppercase tracking-widest text-gold">{latestNotices.length}</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-blue-200">
                {latestNotices.slice(0, 4).map((n) => (
                  <div key={n.id} className="flex items-start justify-between gap-3">
                    <span className="font-semibold truncate">{n.title}</span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-blue-300/50 shrink-0">{n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-GB') : ''}</span>
                  </div>
                ))}
                {latestNotices.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-blue-300/60">No notices yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Department Performance Chart with Training in red */}
          <div className={`${panelClass} p-8`}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Department Performance</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                  <div className="w-2 h-2 rounded-full bg-enterprise-blue"></div> Recruitment
                  <div className="w-2 h-2 rounded-full bg-gold"></div> Deployment
                  <div className="w-2 h-2 rounded-full bg-red-500"></div> Training
                </div>
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyStatus}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f033" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                  <Tooltip cursor={{fill: '#f1f5f933'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="recruitment" fill="#003366" radius={[6, 6, 0, 0]} barSize={24} />
                  <Bar dataKey="deployment" fill="#D4AF37" radius={[6, 6, 0, 0]} barSize={24} />
                  <Bar dataKey="training" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Enterprise Recruitment Funnel - Clustered Line Bar Chart */}
          <div className={`${panelClass} p-8`}>
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Enterprise Recruitment Funnel</h3>
              <span className="text-[10px] font-black text-gold uppercase tracking-[0.3em]">Hiring Efficiency Score</span>
            </div>
            <div className="h-64 mb-8 px-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dataFunnel}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f033" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f1f5f933' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="barValue" className="fill-[#003366] dark:fill-white" barSize={20} radius={[4, 4, 0, 0]} opacity={0.3} />
                  <Line type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={3} dot={{ r: 4, fill: '#D4AF37' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-6 pt-6 border-t dark:border-slate-700">
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Conversion Efficiency</p>
                <p className="text-lg font-bold text-gold">{hiringEfficiency}% Overall</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Screening Drop-off</p>
                <p className="text-lg font-bold text-red-500">-{screeningDropoff}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Time-to-Hire Avg</p>
                <p className="text-lg font-bold dark:text-white">{avgDaysToEvent} Days</p>
              </div>
            </div>
          </div>

          {/* Employee Reporting & Performance (below Enterprise Recruitment Funnel) */}
          {employeeReportingPanel}

          {/* Real-time Operations - Broad Alignment */}
          <div className={`${panelClass} p-8`}>
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Real-time Operations</h3>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(bookings.length
                ? bookings.slice(0, 4).map((booking) => ({
                    title: `${booking.purpose}: ${booking.booker}`,
                    time: `${booking.date} ${booking.time}`,
                    status: 'Scheduled',
                  }))
                : [{ title: 'No Bookings Yet', time: '-', status: 'Waiting for data' }]).map((event, idx) => (
                <div key={idx} className={tileClass} onClick={() => onNavigate('recruitment')}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-white uppercase leading-tight">{event.title}</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{event.status}</p>
                    </div>
                    <span className="text-[9px] font-black text-gold bg-gold/5 px-2 py-0.5 rounded border border-gold/20 whitespace-nowrap">{event.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={handleTrace}
              className="w-full mt-8 py-4 bg-enterprise-blue text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all hover:brightness-110"
            >
              Execute Full Schedule Trace
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Documentation Sync Pie Chart */}
          <div className={`${panelClass} p-8 flex flex-col`}>
             <h3 className="font-black text-slate-900 dark:text-white mb-8 uppercase tracking-tight text-sm">Document Compliance</h3>
             <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie data={complianceStats} innerRadius={60} outerRadius={80} dataKey="value">
                         {complianceStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                   </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="mt-6 space-y-3">
                {complianceStats.map(s => (
                  <div key={s.name} className="flex justify-between items-center text-[10px] font-bold uppercase">
                     <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor: s.color}}></div> <span className="text-slate-500 dark:text-slate-400">{s.name}</span></div>
                     <span className="dark:text-white">{s.value} CANDIDATES</span>
                  </div>
                ))}
             </div>
          </div>

          {/* Upcoming Operations Widget */}
          <div className={`${panelClass} p-8`}>
             <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">Upcoming Operations</h3>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
             </div>
             <div className="space-y-4">
                {upcomingOps.map((op, i) => (
                  <div key={i} className={tileClass} onClick={() => handleOpClick(op.action)}>
                     <div className="flex items-start gap-4">
                        <div className={`w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center ${getColorClass(op.color)} shadow-sm shrink-0`}>
                           {op.title === 'Documentation Deadlines' ? (
                             <i className="fas fa-file-alt text-lg"></i>
                           ) : (
                             <i className={`fas ${op.icon}`}></i>
                           )}
                        </div>
                        <div>
                           <h4 className="text-[10px] font-black dark:text-white uppercase tracking-widest mb-2">{op.title}</h4>
                           <div className="space-y-1">
                              {op.items.map((item, j) => (
                                <div key={j} className="text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                   <div className="w-1 h-1 rounded-full bg-gold"></div>
                                   {item}
                                </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
