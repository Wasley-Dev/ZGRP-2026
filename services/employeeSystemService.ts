import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AttendanceLog, DailyReport, LeaveRequest, Notice, PayrollRecord, PayrollRunInput, PayslipRecord, SystemUser, TaskItem, TeamMessage } from '../types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const DEFAULT_API_BASE_URL = 'https://zgrp-portal-2026.vercel.app';

const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const hasEmployeeSupabase = () => Boolean(supabase);

const nowIso = () => new Date().toISOString();

const toDateOnly = (iso: string) => iso.slice(0, 10);

const normalizeSegments = (value: unknown): AttendanceLog['segments'] => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const inTime = (item as any)?.in;
        const outTime = (item as any)?.out;
        if (!inTime) return null;
        return { in: String(inTime), out: outTime ? String(outTime) : undefined };
      })
      .filter(Boolean) as AttendanceLog['segments'];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return normalizeSegments(parsed);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const isCheckedIn = (attendance: AttendanceLog): boolean => {
  const segments = attendance.segments || [];
  const last = segments[segments.length - 1];
  if (last?.in && !last?.out) return true;
  // Backwards compatibility: if no segments stored, infer from checkOut.
  if (!attendance.segments && attendance.checkIn && !attendance.checkOut) return true;
  return false;
};

const resolveApiBaseUrl = (): string => {
  if (typeof window === 'undefined') return API_BASE_URL || '';
  const origin = window.location?.origin || '';
  if (origin.startsWith('http://') || origin.startsWith('https://')) return origin;
  return API_BASE_URL || DEFAULT_API_BASE_URL;
};

export const fetchDailyReports = async (user: SystemUser, isAdmin: boolean): Promise<DailyReport[]> => {
  if (!supabase) return [];
  const q = supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200);
  const { data, error } = isAdmin ? await q : await q.eq('user_id', user.id);
  if (error || !data) {
    console.error('fetchDailyReports error:', error);
    return [];
  }
  return (data as any[]).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title || ''),
    description: String(row.description || ''),
    createdAt: String(row.created_at || ''),
  }));
};

export const createDailyReport = async (
  user: SystemUser,
  input: { title: string; description: string; date?: string }
): Promise<DailyReport> => {
  if (!supabase) {
    return {
      id: `local-${Date.now()}`,
      userId: user.id,
      title: input.title,
      description: input.description,
      createdAt: nowIso(),
    };
  }
  const payload = {
    user_id: user.id,
    title: input.title,
    description: input.description,
    created_at: input.date ? new Date(`${input.date}T12:00:00`).toISOString() : nowIso(),
  };
  const { data, error } = await supabase.from('reports').insert(payload).select('*').single();
  if (error || !data) throw error || new Error('Create report failed');
  return {
    id: String((data as any).id),
    userId: String((data as any).user_id),
    title: String((data as any).title || ''),
    description: String((data as any).description || ''),
    createdAt: String((data as any).created_at || ''),
  };
};

export const fetchAttendanceLogs = async (user: SystemUser, isAdmin: boolean): Promise<AttendanceLog[]> => {
  if (!supabase) return [];
  const q = supabase.from('attendance').select('*').order('date', { ascending: false }).limit(400);
  const { data, error } = isAdmin ? await q : await q.eq('user_id', user.id);
  if (error || !data) {
    console.error('fetchAttendanceLogs error:', error);
    return [];
  }
  return (data as any[]).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    date: String(row.date),
    checkIn: String(row.check_in),
    checkOut: row.check_out ? String(row.check_out) : undefined,
    segments: normalizeSegments(row.segments),
  }));
};

export const fetchTodayAttendance = async (user: SystemUser): Promise<AttendanceLog | null> => {
  if (!supabase) return null;
  const today = toDateOnly(nowIso());
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle();
  if (error) {
    console.error('fetchTodayAttendance error:', error);
    return null;
  }
  if (!data) return null;
  return {
    id: String((data as any).id),
    userId: String((data as any).user_id),
    date: String((data as any).date),
    checkIn: String((data as any).check_in),
    checkOut: (data as any).check_out ? String((data as any).check_out) : undefined,
    segments: normalizeSegments((data as any).segments),
  };
};

export const clockIn = async (user: SystemUser): Promise<AttendanceLog> => {
  const today = toDateOnly(nowIso());
  if (!supabase) {
    const local: AttendanceLog = { id: `local-${Date.now()}`, userId: user.id, date: today, checkIn: nowIso() };
    local.segments = [{ in: local.checkIn }];
    return local;
  }
  const existing = await fetchTodayAttendance(user);
  const now = nowIso();

  // First check-in of the day creates the row.
  if (!existing) {
    const payload = { user_id: user.id, date: today, check_in: now, check_out: null, segments: [{ in: now }] };
    const attempt = await supabase.from('attendance').insert(payload as any).select('*').single();
    if (attempt.error && /segments/i.test(String(attempt.error.message || ''))) {
      const legacyAttempt = await supabase
        .from('attendance')
        .insert({ user_id: user.id, date: today, check_in: now, check_out: null })
        .select('*')
        .single();
      if (legacyAttempt.error || !legacyAttempt.data) throw legacyAttempt.error || new Error('Clock in failed');
      const data = legacyAttempt.data as any;
      return {
        id: String(data.id),
        userId: String(data.user_id),
        date: String(data.date),
        checkIn: String(data.check_in),
        checkOut: undefined,
      };
    }
    if (attempt.error || !attempt.data) throw attempt.error || new Error('Clock in failed');
    const data = attempt.data as any;
    return {
      id: String(data.id),
      userId: String(data.user_id),
      date: String(data.date),
      checkIn: String(data.check_in),
      checkOut: undefined,
      segments: normalizeSegments(data.segments) || [{ in: now }],
    };
  }

  // If already finalized for the day, block.
  if (existing.checkOut) throw new Error('You already completed attendance for today.');

  // If currently checked in (open segment), block.
  const segments = (existing.segments || []).slice();
  const last = segments[segments.length - 1];
  if (last?.in && !last?.out) throw new Error('You are already checked in.');

  // Allow one mid-day return check-in (max 2 segments per day).
  if (segments.length >= 2) throw new Error('Mid-day return already used for today.');
  segments.push({ in: now });

  const { data, error } = await supabase
    .from('attendance')
    .update({ segments })
    .eq('id', existing.id)
    .select('*')
    .single();
  if (error && /segments/i.test(String(error.message || ''))) {
    throw new Error('Mid-day return requires an attendance schema update (segments column). Apply the latest Supabase migration.');
  }
  if (error || !data) throw error || new Error('Clock in failed');
  return {
    id: String((data as any).id),
    userId: String((data as any).user_id),
    date: String((data as any).date),
    checkIn: String((data as any).check_in),
    checkOut: (data as any).check_out ? String((data as any).check_out) : undefined,
    segments: normalizeSegments((data as any).segments) || segments,
  };
};

const CHECKOUT_TOKEN_KEY_PREFIX = 'zaya_checkout_token_v1:';

export const requestClockOutApproval = async (user: SystemUser, attendance: AttendanceLog, reason: string): Promise<void> => {
  const token = `CO-${attendance.date}-${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(`${CHECKOUT_TOKEN_KEY_PREFIX}${user.id}:${attendance.date}`, token);
    } catch {
      // ignore
    }
  }

  // Send email (if backend configured). If not configured, GM can still approve manually by sharing the code shown in the email failure UI.
  const subject = `Clock-Out Authorization Request (${attendance.date})`;
  const body = [
    `Employee: ${user.name} (${user.email})`,
    `User ID: ${user.id}`,
    `Date: ${attendance.date}`,
    `Check-in: ${attendance.checkIn}`,
    `Reason: ${reason || 'Not provided'}`,
    '',
    `Authorization Code: ${token}`,
    '',
    'Reply to the employee with the Authorization Code to permit checkout.',
  ].join('\n');

  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) throw new Error('Email backend URL not set. Configure VITE_API_BASE_URL.');
  await fetch(`${baseUrl}/api/v1/messages/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: ['gm@zayagroupltd.com'], subject, body }),
  });
};

export const midDayClockOut = async (user: SystemUser, attendance: AttendanceLog, approvalCode: string): Promise<AttendanceLog> => {
  if (!attendance.checkIn) throw new Error('You must clock in first.');
  if (attendance.checkOut) throw new Error('You already completed attendance for today.');
  if (!isCheckedIn(attendance)) throw new Error('You are not currently checked in.');
  const expectedKey = `${CHECKOUT_TOKEN_KEY_PREFIX}${user.id}:${attendance.date}`;
  const expected = typeof window !== 'undefined' ? window.localStorage.getItem(expectedKey) : null;
  if (!expected || expected.trim().toUpperCase() !== approvalCode.trim().toUpperCase()) {
    throw new Error('Invalid authorization code. Request approval from gm@zayagroupltd.com.');
  }

  if (!supabase) {
    const now = nowIso();
    const segments = (attendance.segments || [{ in: attendance.checkIn }]).slice();
    const last = segments[segments.length - 1];
    if (!last?.in || last?.out) throw new Error('Mid-day checkout not available.');
    last.out = now;
    return { ...attendance, segments };
  }

  const now = nowIso();
  const segments = (attendance.segments || [{ in: attendance.checkIn }]).slice();
  const last = segments[segments.length - 1];
  if (!last?.in || last?.out) throw new Error('Mid-day checkout not available.');
  last.out = now;

  const { data, error } = await supabase.from('attendance').update({ segments }).eq('id', attendance.id).select('*').single();
  if (error && /segments/i.test(String(error.message || ''))) {
    throw new Error('Mid-day checkout requires an attendance schema update (segments column). Apply the latest Supabase migration.');
  }
  if (error || !data) throw error || new Error('Clock out failed');
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(expectedKey);
  } catch {
    // ignore
  }
  return {
    id: String((data as any).id),
    userId: String((data as any).user_id),
    date: String((data as any).date),
    checkIn: String((data as any).check_in),
    checkOut: (data as any).check_out ? String((data as any).check_out) : undefined,
    segments: normalizeSegments((data as any).segments) || segments,
  };
};

export const clockOut = async (user: SystemUser, attendance: AttendanceLog): Promise<AttendanceLog> => {
  if (!attendance.checkIn) throw new Error('You must clock in first.');
  if (attendance.checkOut) throw new Error('You already completed attendance for today.');
  if (!isCheckedIn(attendance)) throw new Error('You are not currently checked in.');

  const now = nowIso();
  const segments = (attendance.segments || [{ in: attendance.checkIn }]).slice();
  const last = segments[segments.length - 1];
  if (!last?.in || last?.out) throw new Error('Clock out not available.');
  last.out = now;

  if (!supabase) {
    return { ...attendance, checkOut: now, segments };
  }

  const attempt = await supabase
    .from('attendance')
    .update({ check_out: now, segments } as any)
    .eq('id', attendance.id)
    .select('*')
    .single();
  if (attempt.error && /segments/i.test(String(attempt.error.message || ''))) {
    const legacyAttempt = await supabase
      .from('attendance')
      .update({ check_out: now })
      .eq('id', attendance.id)
      .select('*')
      .single();
    if (legacyAttempt.error || !legacyAttempt.data) throw legacyAttempt.error || new Error('Clock out failed');
    const data = legacyAttempt.data as any;
    return {
      id: String(data.id),
      userId: String(data.user_id),
      date: String(data.date),
      checkIn: String(data.check_in),
      checkOut: data.check_out ? String(data.check_out) : undefined,
    };
  }
  if (attempt.error || !attempt.data) throw attempt.error || new Error('Clock out failed');
  const data = attempt.data as any;
  return {
    id: String(data.id),
    userId: String(data.user_id),
    date: String(data.date),
    checkIn: String(data.check_in),
    checkOut: data.check_out ? String(data.check_out) : undefined,
    segments: normalizeSegments(data.segments) || segments,
  };
};

export const fetchNotices = async (): Promise<Notice[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(200);
  if (error || !data) {
    console.error('fetchNotices error:', error);
    return [];
  }
  return (data as any[]).map((row) => ({
    id: String(row.id),
    title: String(row.title || ''),
    content: String(row.content || ''),
    createdAt: String(row.created_at || ''),
  }));
};

export const createNotice = async (input: { title: string; content: string }): Promise<Notice> => {
  if (!supabase) {
    return { id: `local-${Date.now()}`, title: input.title, content: input.content, createdAt: nowIso() };
  }
  const { data, error } = await supabase.from('notices').insert({ ...input, created_at: nowIso() }).select('*').single();
  if (error || !data) throw error || new Error('Create notice failed');
  return {
    id: String((data as any).id),
    title: String((data as any).title || ''),
    content: String((data as any).content || ''),
    createdAt: String((data as any).created_at || ''),
  };
};

export const fetchTasks = async (user: SystemUser, isAdmin: boolean): Promise<TaskItem[]> => {
  if (!supabase) return [];
  const q = supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(300);
  const { data, error } = isAdmin ? await q : await q.eq('user_id', user.id);
  if (error || !data) {
    console.error('fetchTasks error:', error);
    return [];
  }
  return (data as any[]).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title || ''),
    description: String(row.description || ''),
    status: (String(row.status || 'pending').toLowerCase() === 'completed' ? 'completed' : 'pending'),
    createdAt: String(row.created_at || ''),
  }));
};

export const createTask = async (input: { userId: string; title: string; description: string }): Promise<TaskItem> => {
  if (!supabase) {
    return { id: `local-${Date.now()}`, userId: input.userId, title: input.title, description: input.description, status: 'pending', createdAt: nowIso() };
  }
  const { data, error } = await supabase.from('tasks').insert({
    user_id: input.userId,
    title: input.title,
    description: input.description,
    status: 'pending',
    created_at: nowIso(),
  }).select('*').single();
  if (error || !data) throw error || new Error('Create task failed');
  return {
    id: String((data as any).id),
    userId: String((data as any).user_id),
    title: String((data as any).title || ''),
    description: String((data as any).description || ''),
    status: (String((data as any).status || 'pending').toLowerCase() === 'completed' ? 'completed' : 'pending'),
    createdAt: String((data as any).created_at || ''),
  };
};

export const setTaskStatus = async (taskId: string, status: 'pending' | 'completed'): Promise<void> => {
  if (!supabase) return;
  await supabase.from('tasks').update({ status }).eq('id', taskId);
};

export const fetchChatMessages = async (): Promise<TeamMessage[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(300);
  if (error || !data) {
    console.error('fetchChatMessages error:', error);
    return [];
  }
  return (data as any[]).map((row) => ({
    id: String(row.id),
    senderId: String(row.sender_id),
    message: String(row.message || ''),
    createdAt: String(row.created_at || ''),
  }));
};

export const sendChatMessage = async (sender: SystemUser, message: string): Promise<TeamMessage> => {
  if (!supabase) {
    return { id: `local-${Date.now()}`, senderId: sender.id, message, createdAt: nowIso() };
  }
  const { data, error } = await supabase.from('messages').insert({
    sender_id: sender.id,
    message,
    created_at: nowIso(),
  }).select('*').single();
  if (error || !data) throw error || new Error('Send message failed');
  return {
    id: String((data as any).id),
    senderId: String((data as any).sender_id),
    message: String((data as any).message || ''),
    createdAt: String((data as any).created_at || ''),
  };
};

export const subscribeToTableInserts = (
  table: string,
  onInsert: (row: any) => void
) => {
  if (!supabase) return { unsubscribe: () => {} };
  const channel = supabase
    .channel(`erp-${table}-inserts`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (payload) => {
      onInsert(payload.new);
    })
    .subscribe();
  return {
    unsubscribe: () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    },
  };
};

export const subscribeToTableChanges = (
  table: string,
  options: {
    events?: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
    filter?: string;
    onInsert?: (row: any) => void;
    onUpdate?: (row: any) => void;
    onDelete?: (row: any) => void;
  }
) => {
  if (!supabase) return { unsubscribe: () => {} };
  const events = options.events?.length ? options.events : ['INSERT', 'UPDATE'];
  const channel = supabase.channel(`erp-${table}-changes:${options.filter || 'all'}`);
  events.forEach((event) => {
    channel.on(
      'postgres_changes',
      { event, schema: 'public', table, filter: options.filter },
      (payload) => {
        if (event === 'INSERT') options.onInsert?.(payload.new);
        if (event === 'UPDATE') options.onUpdate?.(payload.new);
        if (event === 'DELETE') options.onDelete?.(payload.old);
      }
    );
  });
  channel.subscribe();
  return {
    unsubscribe: () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    },
  };
};

export const requestLeaveByEmail = async (
  user: SystemUser,
  input: { type: LeaveRequest['type']; startDate: string; endDate: string; reason: string }
): Promise<void> => {
  const subject = `Leave Request (${input.type.toUpperCase()}) - ${user.name}`;
  const body = [
    `Employee: ${user.name} (${user.email})`,
    `User ID: ${user.id}`,
    `Type: ${input.type}`,
    `Start: ${input.startDate}`,
    `End: ${input.endDate}`,
    `Reason: ${input.reason || 'Not provided'}`,
  ].join('\n');
  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) throw new Error('Email backend URL not set. Configure VITE_API_BASE_URL.');
  await fetch(`${baseUrl}/api/v1/messages/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: ['gm@zayagroupltd.com'], subject, body }),
  });

  if (!supabase) return;
  await supabase.from('leave_requests').insert({
    user_id: user.id,
    type: input.type,
    start_date: input.startDate,
    end_date: input.endDate,
    reason: input.reason,
    status: 'pending',
    created_at: nowIso(),
  });
};

export const fetchLeaveRequests = async (user: SystemUser, isAdmin: boolean): Promise<LeaveRequest[]> => {
  if (!supabase) return [];
  const q = supabase.from('leave_requests').select('*').order('created_at', { ascending: false }).limit(300);
  const { data, error } = isAdmin ? await q : await q.eq('user_id', user.id);
  if (error || !data) {
    console.error('fetchLeaveRequests error:', error);
    return [];
  }
  return (data as any[]).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    type: String(row.type || 'leave') === 'sick' ? 'sick' : 'leave',
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    reason: String(row.reason || ''),
    status: String(row.status || 'pending') as any,
    createdAt: String(row.created_at || ''),
  }));
};

export const processPayroll = async (
  users: SystemUser[],
  input: PayrollRunInput
): Promise<{ processed: PayrollRecord[]; skippedUserIds: string[] }> => {
  if (!supabase) return { processed: [], skippedUserIds: users.map((u) => u.id) };
  const month = input.month;
  const year = input.year;
  const workingDays = input.workingDays ?? 26;
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(year, month, 0, 0, 0, 0)).toISOString().slice(0, 10);

  const { data: attendanceRows } = await supabase
    .from('attendance')
    .select('*')
    .gte('date', monthStart)
    .lte('date', monthEnd);
  const attendance = (attendanceRows as any[] | null) || [];

  const { data: existingPayrollRows } = await supabase
    .from('payroll')
    .select('user_id, month, year')
    .eq('month', month)
    .eq('year', year);
  const existingPayroll = new Set(((existingPayrollRows as any[] | null) || []).map((r) => `${r.user_id}:${r.month}:${r.year}`));

  const processed: PayrollRecord[] = [];
  const skipped: string[] = [];

  for (const u of users) {
    const key = `${u.id}:${month}:${year}`;
    if (existingPayroll.has(key)) {
      skipped.push(u.id);
      continue;
    }
    const daysPresent = attendance.filter((a) => String(a.user_id) === u.id && a.check_in).length;
    const basicSalary = Number(u.baseSalary ?? input.defaultBasicSalary ?? 0);
    const allowancesTotal = Number(u.allowancesTotal ?? input.defaultAllowancesTotal ?? 0);
    const deductionsTotal = Number(u.deductionsTotal ?? input.defaultDeductionsTotal ?? 0);
    const score = Number(u.performanceScore ?? input.defaultPerformanceScore ?? 0);
    const performanceBonus = score > 80 ? Math.round(basicSalary * 0.1) : 0;
    const prorated = workingDays > 0 ? (basicSalary * (daysPresent / workingDays)) : basicSalary;
    const netSalary = Math.max(0, Math.round(prorated + allowancesTotal - deductionsTotal + performanceBonus));

    const payrollRow = {
      user_id: u.id,
      month,
      year,
      basic_salary: basicSalary,
      allowances_total: allowancesTotal,
      deductions_total: deductionsTotal,
      net_salary: netSalary,
      created_at: nowIso(),
    };
    const { data: payroll, error } = await supabase.from('payroll').insert(payrollRow).select('*').single();
    if (error || !payroll) throw error || new Error('Payroll insert failed');
    const payrollId = String((payroll as any).id);

    const breakdown = {
      company: 'Zaya Group Ltd',
      employeeName: u.name,
      month,
      year,
      daysPresent,
      workingDays,
      basicSalary,
      allowancesTotal,
      deductionsTotal,
      performanceScore: score,
      performanceBonus,
      netSalary,
    };

    await supabase.from('payslips').insert({
      payroll_id: payrollId,
      breakdown_json: breakdown,
      created_at: nowIso(),
    });

    processed.push({
      id: payrollId,
      userId: u.id,
      month,
      year,
      basicSalary,
      allowancesTotal,
      deductionsTotal,
      netSalary,
      createdAt: String((payroll as any).created_at || nowIso()),
    });
  }

  return { processed, skippedUserIds: skipped };
};

export const fetchPayrollDashboard = async (): Promise<PayrollRecord[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('payroll').select('*').order('created_at', { ascending: false }).limit(200);
  if (error || !data) {
    console.error('fetchPayrollDashboard error:', error);
    return [];
  }
  return (data as any[]).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    month: Number(row.month),
    year: Number(row.year),
    basicSalary: Number(row.basic_salary ?? 0),
    allowancesTotal: Number(row.allowances_total ?? 0),
    deductionsTotal: Number(row.deductions_total ?? 0),
    netSalary: Number(row.net_salary ?? 0),
    createdAt: String(row.created_at || ''),
  }));
};

export const fetchPayslipByPayrollId = async (payrollId: string): Promise<PayslipRecord | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.from('payslips').select('*').eq('payroll_id', payrollId).maybeSingle();
  if (error) {
    console.error('fetchPayslipByPayrollId error:', error);
    return null;
  }
  if (!data) return null;
  return {
    id: String((data as any).id),
    payrollId: String((data as any).payroll_id),
    breakdown: (data as any).breakdown_json,
    createdAt: String((data as any).created_at || ''),
  };
};
