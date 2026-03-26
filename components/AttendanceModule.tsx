import React, { useEffect, useMemo, useState } from 'react';
import type { AttendanceCheckoutRequest, AttendanceLog, LeaveRequest, SystemUser } from '../types';
import {
  fetchAttendanceLogs,
  fetchLatestMiddayCheckoutRequest,
  fetchLeaveRequests,
  fetchTodayAttendance,
  requestClockOutApproval,
  clockIn,
  clockOut,
  midDayClockOut,
  requestLeaveByEmail,
} from '../services/employeeSystemService';
import { hasEmployeeSupabase, subscribeToTableChanges } from '../services/employeeSystemService';

interface AttendanceModuleProps {
  user: SystemUser;
  isAdmin: boolean;
  users: SystemUser[];
  onNavigate: (module: string) => void;
}

const AttendanceModule: React.FC<AttendanceModuleProps> = ({ user, isAdmin, users, onNavigate }) => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [today, setToday] = useState<AttendanceLog | null>(null);
  const [checkoutReason, setCheckoutReason] = useState('');
  const [checkoutRequest, setCheckoutRequest] = useState<AttendanceCheckoutRequest | null>(null);
  const [leaveType, setLeaveType] = useState<'leave' | 'sick'>('leave');
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveEnd, setLeaveEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const isCurrentlyCheckedIn = useMemo(() => {
    if (!today?.checkIn) return false;
    if (today?.checkOut) return false;
    const segments = Array.isArray(today?.segments) ? today.segments : [];
    if (segments.length === 0) return true;
    const last = segments[segments.length - 1];
    return Boolean(last?.in && !last?.out);
  }, [today]);

  const statusLabel = useMemo(() => {
    if (!today?.checkIn) return 'Not Checked In';
    if (today?.checkOut) return 'Checked Out';
    return isCurrentlyCheckedIn ? 'Checked In' : 'Mid-day Checked Out';
  }, [today, isCurrentlyCheckedIn]);

  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const summary = useMemo(() => {
    const presentDays = new Set(logs.filter((l) => l.userId === user.id && l.checkIn).map((l) => l.date)).size;
    const approved = leaveRequests.filter((r) => r.userId === user.id && r.status === 'approved');
    const leaveDays = approved.filter((r) => r.type === 'leave').length;
    const sickDays = approved.filter((r) => r.type === 'sick').length;
    return { presentDays, leaveDays, sickDays };
  }, [logs, leaveRequests, user.id]);

  const monthLabel = useMemo(
    () => calendarMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    [calendarMonth]
  );

  const monthDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number; iso: string } | null> = [];
    for (let i = 0; i < startDay; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, iso });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);

  const myAttendanceByDate = useMemo(() => {
    const map = new Map<string, AttendanceLog>();
    logs.filter((l) => l.userId === user.id).forEach((l) => map.set(l.date, l));
    return map;
  }, [logs, user.id]);

  const approvedLeaveDays = useMemo(() => {
    const map = new Map<string, LeaveRequest['type']>();
    const approved = leaveRequests.filter((r) => r.userId === user.id && r.status === 'approved');
    approved.forEach((r) => {
      const start = new Date(`${r.startDate}T00:00:00`);
      const end = new Date(`${r.endDate}T00:00:00`);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        map.set(iso, r.type);
      }
    });
    return map;
  }, [leaveRequests, user.id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [loaded, t, leave] = await Promise.all([
        fetchAttendanceLogs(user, isAdmin),
        fetchTodayAttendance(user),
        fetchLeaveRequests(user, isAdmin),
      ]);
      if (cancelled) return;
      setLogs(loaded);
      setToday(t);
      setCheckoutRequest(t?.id ? await fetchLatestMiddayCheckoutRequest(String(t.id)) : null);
      setLeaveRequests(leave);
    };
    void load();
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  useEffect(() => {
    if (!hasEmployeeSupabase()) return;
    if (!today?.id) return;
    const attendanceId = String(today.id);
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
  }, [today?.id]);

  useEffect(() => {
    if (!hasEmployeeSupabase()) return;
    const attendanceFilter = isAdmin ? undefined : `user_id=eq.${user.id}`;
    const leaveFilter = isAdmin ? undefined : `user_id=eq.${user.id}`;

    const attendanceSub = subscribeToTableChanges('attendance', {
      filter: attendanceFilter,
      onInsert: (row) => {
        const next: AttendanceLog = {
          id: String(row.id),
          userId: String(row.user_id),
          date: String(row.date),
          checkIn: String(row.check_in),
          checkOut: row.check_out ? String(row.check_out) : undefined,
        };
        setLogs((prev) => (prev.some((l) => l.id === next.id) ? prev : [next, ...prev]));
        if (next.userId === user.id && next.date === new Date().toISOString().slice(0, 10)) setToday(next);
      },
      onUpdate: (row) => {
        const next: AttendanceLog = {
          id: String(row.id),
          userId: String(row.user_id),
          date: String(row.date),
          checkIn: String(row.check_in),
          checkOut: row.check_out ? String(row.check_out) : undefined,
        };
        setLogs((prev) => prev.map((l) => (l.id === next.id ? next : l)));
        if (next.userId === user.id && next.date === new Date().toISOString().slice(0, 10)) setToday(next);
      },
    });

    const leaveSub = subscribeToTableChanges('leave_requests', {
      filter: leaveFilter,
      onInsert: (row) => {
        const next: LeaveRequest = {
          id: String(row.id),
          userId: String(row.user_id),
          type: String(row.type || 'leave') === 'sick' ? 'sick' : 'leave',
          startDate: String(row.start_date),
          endDate: String(row.end_date),
          reason: String(row.reason || ''),
          status: String(row.status || 'pending') as any,
          createdAt: String(row.created_at || ''),
        };
        setLeaveRequests((prev) => (prev.some((r) => r.id === next.id) ? prev : [next, ...prev]));
      },
      onUpdate: (row) => {
        const next: LeaveRequest = {
          id: String(row.id),
          userId: String(row.user_id),
          type: String(row.type || 'leave') === 'sick' ? 'sick' : 'leave',
          startDate: String(row.start_date),
          endDate: String(row.end_date),
          reason: String(row.reason || ''),
          status: String(row.status || 'pending') as any,
          createdAt: String(row.created_at || ''),
        };
        setLeaveRequests((prev) => prev.map((r) => (r.id === next.id ? next : r)));
      },
    });

    return () => { attendanceSub.unsubscribe(); leaveSub.unsubscribe(); };
  }, [user.id, isAdmin]);

  const handleClockIn = async () => {
    try {
      const next = await clockIn(user);
      setToday(next);
      setLogs((prev) => [next, ...prev.filter((l) => l.id !== next.id)]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Clock in failed.');
    }
  };

  const handleRequestCheckout = async () => {
    if (!today) { alert('Clock in first.'); return; }
    if (today.checkOut) { alert('You already checked out today.'); return; }
    if (!isCurrentlyCheckedIn) { alert('You must be checked in to request a mid-day checkout.'); return; }
    try {
      const created = await requestClockOutApproval(user, today, checkoutReason.trim());
      setCheckoutRequest(created);
      alert('Authorization email sent to gm@zayagroupltd.com.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to send approval email.');
    }
  };

  const handleMidDayCheckout = async () => {
    if (!today) { alert('Clock in first.'); return; }
    try {
      const next = await midDayClockOut(user, today);
      setToday(next);
      setLogs((prev) => prev.map((l) => (l.id === next.id ? next : l)));
      setCheckoutReason('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Mid-day checkout failed.');
    }
  };

  const handleClockOut = async () => {
    if (!today) { alert('Clock in first.'); return; }
    try {
      const next = await clockOut(user, today);
      setToday(next);
      setLogs((prev) => prev.map((l) => (l.id === next.id ? next : l)));
      setCheckoutReason('');
      setCheckoutRequest(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Clock out failed.');
    }
  };

  const handleLeaveRequest = async () => {
    if (!leaveStart || !leaveEnd) { alert('Select start and end dates.'); return; }
    try {
      await requestLeaveByEmail(user, {
        type: leaveType,
        startDate: leaveStart,
        endDate: leaveEnd,
        reason: leaveReason.trim(),
      });
      alert('Leave request sent to gm@zayagroupltd.com.');
      setLeaveReason('');
      const updated = await fetchLeaveRequests(user, isAdmin);
      setLeaveRequests(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Leave request failed.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Attendance</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Clock in once per day. Mid-day checkout requires GM approval. End-of-day clock out does not.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('dailyReports')}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
            >
              Submit Report
            </button>
            <button
              onClick={() => onNavigate('chat')}
              className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow"
            >
              Open Chat
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { label: 'Present Days', value: summary.presentDays.toString() },
            { label: 'Leave Requests (Approved)', value: summary.leaveDays.toString() },
            { label: 'Sick Requests (Approved)', value: summary.sickDays.toString() },
            { label: 'Today', value: new Date().toISOString().slice(0, 10) },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">{c.label}</p>
              <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {!isAdmin && (
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Clock In / Clock Out</h3>
              <div className="mt-4 space-y-3 text-sm">
                <p className="text-slate-600 dark:text-blue-200">
                  Status:{' '}
                  <span className="font-black text-slate-900 dark:text-white">
                    {statusLabel}
                  </span>
                </p>
                {today?.checkIn && (
                  <p className="text-slate-600 dark:text-blue-200">
                    Check-in: <span className="font-mono">{new Date(today.checkIn).toLocaleTimeString('en-GB')}</span>
                  </p>
                )}
                {today?.checkOut && (
                  <p className="text-slate-600 dark:text-blue-200">
                    Check-out: <span className="font-mono">{new Date(today.checkOut).toLocaleTimeString('en-GB')}</span>
                  </p>
                )}
                {!today?.checkOut && Array.isArray(today?.segments) && today.segments?.[today.segments.length - 1]?.out && (
                  <p className="text-slate-600 dark:text-blue-200">
                    Mid-day out: <span className="font-mono">{new Date(today.segments[today.segments.length - 1].out).toLocaleTimeString('en-GB')}</span>
                  </p>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2">
                <button
                  onClick={handleClockIn}
                  disabled={!!today?.checkOut || isCurrentlyCheckedIn}
                  className="w-full py-3 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest disabled:opacity-60 border-b-4 border-black/10 hover:brightness-110 active:scale-[0.98]"
                >
                  Clock In
                </button>

                <div className="rounded-xl border border-slate-200 dark:border-blue-400/20 p-4">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60 mb-2">Checkout reason (optional)</label>
                  <input
                    value={checkoutReason}
                    onChange={(e) => setCheckoutReason(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                    placeholder="Emergency / errands / appointment"
                  />
                  <button
                    onClick={handleRequestCheckout}
                    disabled={!isCurrentlyCheckedIn || checkoutRequest?.status === 'pending'}
                    className="w-full mt-3 py-3 rounded-xl border border-gold/30 text-gold text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                  >
                    {checkoutRequest?.status === 'pending' ? 'Approval Pending' : 'Request Mid-day Approval (Email)'}
                  </button>
                  <button
                    onClick={handleMidDayCheckout}
                    disabled={!isCurrentlyCheckedIn || checkoutRequest?.status !== 'approved'}
                    className="w-full mt-3 py-3 rounded-xl border border-red-300/40 text-red-600 dark:text-red-300 text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                  >
                    Mid-day Checkout {checkoutRequest?.status === 'approved' ? '' : '(Requires Approval)'}
                  </button>
                  <button
                    onClick={handleClockOut}
                    disabled={!isCurrentlyCheckedIn}
                    className="w-full mt-3 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                  >
                    Clock Out (End of Day)
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={`${isAdmin ? 'lg:col-span-3' : 'lg:col-span-2'} rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">
                {isAdmin ? 'Attendance Logs' : 'Attendance'}
              </h3>
              {isAdmin && (
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{logs.length} records</span>
              )}
            </div>

            {isAdmin ? (
              <div className="mt-4 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-blue-300/60">
                    <tr>
                      <th className="py-2 pr-3">Employee</th>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Check In</th>
                      <th className="py-2 pr-3">Check Out</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-blue-400/10">
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2 pr-3 font-bold text-slate-700 dark:text-white">{userNameById.get(l.userId) || l.userId}</td>
                        <td className="py-2 pr-3 font-mono text-slate-700 dark:text-white">{l.date}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-blue-200">{new Date(l.checkIn).toLocaleTimeString('en-GB')}</td>
                        <td className="py-2 pr-3 text-slate-700 dark:text-blue-200">{l.checkOut ? new Date(l.checkOut).toLocaleTimeString('en-GB') : '-'}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td className="py-6 text-slate-500 dark:text-blue-300/60" colSpan={4}>
                          No attendance data yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300/70 dark:border-blue-400/20 p-8 text-center">
                <p className="text-sm font-semibold text-slate-600 dark:text-blue-200">Attendance logs are managed by administrators.</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-blue-300/60">Use Clock In / Clock Out to submit today&apos;s attendance.</p>
              </div>
            )}

            {!isAdmin && (
              <>
                <div className="mt-6 rounded-2xl border border-slate-200 dark:border-blue-400/20 p-5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Leave / Sick Request (Email)</h3>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value as any)}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                    >
                      <option value="leave">Leave</option>
                      <option value="sick">Sick</option>
                    </select>
                    <input
                      type="date"
                      value={leaveStart}
                      onChange={(e) => setLeaveStart(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                    />
                    <input
                      type="date"
                      value={leaveEnd}
                      onChange={(e) => setLeaveEnd(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                    />
                    <input
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                      placeholder="Reason"
                    />
                    <div className="md:col-span-2 flex justify-end">
                      <button
                        onClick={handleLeaveRequest}
                        className="px-6 py-3 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow"
                      >
                        Send Request to GM
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] text-slate-500 dark:text-blue-300/60 font-bold uppercase tracking-widest">
                    Requests are emailed to gm@zayagroupltd.com.
                  </p>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 dark:border-blue-400/20 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Attendance Calendar</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                        className="w-8 h-8 rounded-lg border border-slate-200 dark:border-blue-400/20 text-slate-500 dark:text-blue-200 hover:border-gold transition-all"
                        aria-label="Previous month"
                      >
                        <i className="fas fa-chevron-left text-xs"></i>
                      </button>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">{monthLabel}</span>
                      <button
                        onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                        className="w-8 h-8 rounded-lg border border-slate-200 dark:border-blue-400/20 text-slate-500 dark:text-blue-200 hover:border-gold transition-all"
                        aria-label="Next month"
                      >
                        <i className="fas fa-chevron-right text-xs"></i>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[9px] font-black text-slate-500 dark:text-blue-300/60 uppercase">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {monthDays.map((cell, idx) => {
                      if (!cell) return <div key={`empty-${idx}`} />;
                      const attendance = myAttendanceByDate.get(cell.iso);
                      const leaveTypeForDay = approvedLeaveDays.get(cell.iso);
                      const todayIso = new Date().toISOString().slice(0, 10);
                      const isToday = cell.iso === todayIso;

                      const base =
                        'h-8 rounded-lg text-xs font-black relative border transition-all flex items-center justify-center';
                      const style = leaveTypeForDay
                        ? leaveTypeForDay === 'sick'
                          ? 'bg-red-500/15 border-red-400/30 text-red-700 dark:text-red-300'
                          : 'bg-blue-500/15 border-blue-400/30 text-blue-700 dark:text-blue-200'
                        : attendance
                        ? 'bg-gold/15 border-gold text-gold'
                        : 'bg-white/40 dark:bg-slate-950/30 border-slate-200 dark:border-blue-400/20 text-slate-700 dark:text-blue-200 hover:border-gold';

                      return (
                        <div key={cell.iso} className={`${base} ${style} ${isToday ? 'ring-2 ring-gold/40' : ''}`} title={attendance ? `Present (${attendance.checkIn ? 'IN' : ''}${attendance.checkOut ? ' / OUT' : ''})` : leaveTypeForDay ? `${leaveTypeForDay.toUpperCase()} (approved)` : ''}>
                          {cell.day}
                          {attendance && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-gold border border-white/60"></span>
                          )}
                          {leaveTypeForDay && (
                            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${leaveTypeForDay === 'sick' ? 'bg-red-500' : 'bg-blue-500'} border border-white/60`}></span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-300/60">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gold"></span>Present</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Leave</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span>Sick</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceModule;
