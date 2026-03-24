import React, { useEffect, useMemo, useState } from 'react';
import type { AttendanceLog, LeaveRequest, SystemUser } from '../types';
import {
  fetchAttendanceLogs,
  fetchLeaveRequests,
  fetchTodayAttendance,
  requestClockOutApproval,
  clockIn,
  clockOut,
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
  const [approvalCode, setApprovalCode] = useState('');
  const [checkoutReason, setCheckoutReason] = useState('');
  const [leaveType, setLeaveType] = useState<'leave' | 'sick'>('leave');
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveEnd, setLeaveEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

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
      setLeaveRequests(leave);
    };
    void load();
    return () => { cancelled = true; };
  }, [user, isAdmin]);

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
    try {
      await requestClockOutApproval(user, today, checkoutReason.trim());
      alert('Authorization email sent to gm@zayagroupltd.com. Enter the approval code to clock out.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to send approval email.');
    }
  };

  const handleClockOut = async () => {
    if (!today) { alert('Clock in first.'); return; }
    try {
      const next = await clockOut(user, today, approvalCode);
      setToday(next);
      setLogs((prev) => prev.map((l) => (l.id === next.id ? next : l)));
      setApprovalCode('');
      setCheckoutReason('');
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
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Clock in once per day. Clock out once per check-in (requires GM approval).</p>
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
          <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Clock In / Clock Out</h3>
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-slate-600 dark:text-blue-200">
                Status:{' '}
                <span className="font-black text-slate-900 dark:text-white">
                  {today?.checkIn ? (today.checkOut ? 'Checked Out' : 'Checked In') : 'Not Checked In'}
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
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2">
              <button
                onClick={handleClockIn}
                disabled={!!today?.checkIn}
                className="w-full py-3 rounded-xl bg-enterprise-blue text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
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
                  disabled={!today?.checkIn || !!today?.checkOut}
                  className="w-full mt-3 py-3 rounded-xl border border-gold/30 text-gold text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                >
                  Request GM Approval (Email)
                </button>

                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60 mt-4 mb-2">Approval code</label>
                <input
                  value={approvalCode}
                  onChange={(e) => setApprovalCode(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Enter code from GM email"
                />
                <button
                  onClick={handleClockOut}
                  disabled={!today?.checkIn || !!today?.checkOut}
                  className="w-full mt-3 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                >
                  Clock Out
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Attendance Logs</h3>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{logs.length} records</span>
            </div>

            <div className="mt-4 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-blue-300/60">
                  <tr>
                    {isAdmin && <th className="py-2 pr-3">Employee</th>}
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Check In</th>
                    <th className="py-2 pr-3">Check Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-blue-400/10">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      {isAdmin && <td className="py-2 pr-3 font-bold text-slate-700 dark:text-white">{userNameById.get(l.userId) || l.userId}</td>}
                      <td className="py-2 pr-3 font-mono text-slate-700 dark:text-white">{l.date}</td>
                      <td className="py-2 pr-3 text-slate-700 dark:text-blue-200">{new Date(l.checkIn).toLocaleTimeString('en-GB')}</td>
                      <td className="py-2 pr-3 text-slate-700 dark:text-blue-200">{l.checkOut ? new Date(l.checkOut).toLocaleTimeString('en-GB') : '-'}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td className="py-6 text-slate-500 dark:text-blue-300/60" colSpan={isAdmin ? 4 : 3}>
                        No attendance data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

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
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceModule;
