import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { UserRole, type AttendanceCheckoutRequest, type AttendanceLog, type DailyReport, type LeaveRequest, type Notice, type PayrollRecord, type PayrollRunInput, type PayslipRecord, type SystemUser, type TaskItem, type TeamMessage } from '../types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const DEFAULT_API_BASE_URL = 'https://zgrp-portal-2026.vercel.app';

const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const hasEmployeeSupabase = () => Boolean(supabase);

const nowIso = () => new Date().toISOString();

const toDateOnly = (iso: string) => iso.slice(0, 10);

const LOCAL_KEY_PREFIX = 'zaya_local_employee_v1:';

const readLocalArray = <T>(key: string, fallback: T[] = []): T[] => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(`${LOCAL_KEY_PREFIX}${key}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

const writeLocalArray = <T>(key: string, value: T[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${LOCAL_KEY_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const errorMessage = (err: unknown): string => {
  if (!err) return '';
  if (err instanceof Error) return err.message || '';
  const anyErr = err as any;
  if (typeof anyErr?.message === 'string') return anyErr.message;
  if (typeof anyErr?.error === 'string') return anyErr.error;
  if (typeof anyErr?.details === 'string') return anyErr.details;
  return '';
};

const asError = (err: unknown, fallback: string) => {
  if (err instanceof Error) return err;
  const msg = errorMessage(err);
  return new Error(msg || fallback);
};

const isSchemaOrPermissionError = (err: unknown) => {
  const msg = errorMessage(err).toLowerCase();
  const code = String((err as any)?.code || '').toLowerCase();
  return (
    code.startsWith('pgrst') ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('permission denied') ||
    msg.includes('row level security') ||
    msg.includes('not allowed') ||
    msg.includes('jwt') ||
    msg.includes('invalid api key')
  );
};

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

const generateToken = (): string => {
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // ignore
  }
  return `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
};

const sha256Hex = async (value: string): Promise<string> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Browser crypto is unavailable for approval token hashing.');
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const normalizeCheckoutRequest = (row: any): AttendanceCheckoutRequest => ({
  id: String(row.id),
  attendanceId: String(row.attendance_id),
  userId: String(row.user_id),
  date: String(row.date),
  reason: row.reason ? String(row.reason) : undefined,
  status: String(row.status || 'pending') === 'approved' ? 'approved' : String(row.status || 'pending') === 'denied' ? 'denied' : 'pending',
  requestedAt: String(row.requested_at || row.created_at || ''),
  decidedAt: row.decided_at ? String(row.decided_at) : undefined,
});

export const fetchLatestMiddayCheckoutRequest = async (attendanceId: string): Promise<AttendanceCheckoutRequest | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('attendance_checkout_requests')
    .select('*')
    .eq('attendance_id', attendanceId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('fetchLatestMiddayCheckoutRequest error:', error);
    return null;
  }
  if (!data) return null;
  return normalizeCheckoutRequest(data);
};

export const fetchDailyReports = async (user: SystemUser, isAdmin: boolean): Promise<DailyReport[]> => {
  if (!supabase) return readLocalArray<DailyReport>('reports', []).filter((r) => (isAdmin ? true : r.userId === user.id));
  const q = supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200);
  const { data, error } = isAdmin ? await q : await q.eq('user_id', user.id);
  if (error || !data) {
    console.error('fetchDailyReports error:', error);
    if (isSchemaOrPermissionError(error)) {
      return readLocalArray<DailyReport>('reports', []).filter((r) => (isAdmin ? true : r.userId === user.id));
    }
    return readLocalArray<DailyReport>('reports', []).filter((r) => (isAdmin ? true : r.userId === user.id));
  }
  const mapped = (data as any[]).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title || ''),
    description: String(row.description || ''),
    createdAt: String(row.created_at || ''),
  }));
  writeLocalArray('reports', mapped);
  return mapped;
};

export const createDailyReport = async (
  user: SystemUser,
  input: { title: string; description: string; date?: string }
): Promise<DailyReport> => {
  const localReport: DailyReport = {
    id: `local-${Date.now()}`,
    userId: user.id,
    title: input.title,
    description: input.description,
    createdAt: input.date ? new Date(`${input.date}T12:00:00`).toISOString() : nowIso(),
  };
  if (!supabase) {
    const next = [localReport, ...readLocalArray<DailyReport>('reports', [])];
    writeLocalArray('reports', next.slice(0, 400));
    return localReport;
  }
  const payload = {
    user_id: user.id,
    title: input.title,
    description: input.description,
    created_at: input.date ? new Date(`${input.date}T12:00:00`).toISOString() : nowIso(),
  };
  const { data, error } = await supabase.from('reports').insert(payload).select('*').single();
  if (error || !data) {
    console.error('createDailyReport error:', error);
    if (isSchemaOrPermissionError(error)) {
      const next = [localReport, ...readLocalArray<DailyReport>('reports', [])];
      writeLocalArray('reports', next.slice(0, 400));
      return localReport;
    }
    throw asError(error, 'Create report failed');
  }
  return {
    id: String((data as any).id),
    userId: String((data as any).user_id),
    title: String((data as any).title || ''),
    description: String((data as any).description || ''),
    createdAt: String((data as any).created_at || ''),
  };
};

export const fetchAttendanceLogs = async (user: SystemUser, isAdmin: boolean): Promise<AttendanceLog[]> => {
  if (!supabase) return readLocalArray<AttendanceLog>('attendance', []).filter((l) => (isAdmin ? true : l.userId === user.id));
  const q = supabase.from('attendance').select('*').order('date', { ascending: false }).limit(400);
  const { data, error } = isAdmin ? await q : await q.eq('user_id', user.id);
  if (error || !data) {
    console.error('fetchAttendanceLogs error:', error);
    return readLocalArray<AttendanceLog>('attendance', []).filter((l) => (isAdmin ? true : l.userId === user.id));
  }
  const mapped = (data as any[]).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    date: String(row.date),
    checkIn: String(row.check_in),
    checkOut: row.check_out ? String(row.check_out) : undefined,
    segments: normalizeSegments(row.segments),
  }));
  writeLocalArray('attendance', mapped);
  return mapped;
};

export const fetchTodayAttendance = async (user: SystemUser): Promise<AttendanceLog | null> => {
  const today = toDateOnly(nowIso());
  if (!supabase) {
    const local = readLocalArray<AttendanceLog>('attendance', []);
    return local.find((l) => l.userId === user.id && l.date === today) || null;
  }
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle();
  if (error) {
    console.error('fetchTodayAttendance error:', error);
    const local = readLocalArray<AttendanceLog>('attendance', []);
    return local.find((l) => l.userId === user.id && l.date === today) || null;
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
  const localStore = readLocalArray<AttendanceLog>('attendance', []);
  const localExisting = localStore.find((l) => l.userId === user.id && l.date === today) || null;
  if (!supabase) {
    if (localExisting?.checkOut) throw new Error('You already completed attendance for today.');
    const now = nowIso();
    if (!localExisting) {
      const local: AttendanceLog = { id: `local-${Date.now()}`, userId: user.id, date: today, checkIn: now, segments: [{ in: now }] };
      writeLocalArray('attendance', [local, ...localStore].slice(0, 500));
      return local;
    }
    const segments = (localExisting.segments || [{ in: localExisting.checkIn }]).slice();
    const last = segments[segments.length - 1];
    if (last?.in && !last?.out) throw new Error('You are already checked in.');
    if (segments.length >= 2) throw new Error('Mid-day return already used for today.');
    segments.push({ in: now });
    const updated = { ...localExisting, segments };
    writeLocalArray('attendance', [updated, ...localStore.filter((l) => l.id !== updated.id)].slice(0, 500));
    return updated;
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
      if (legacyAttempt.error || !legacyAttempt.data) {
        console.error('clockIn legacy insert error:', legacyAttempt.error);
        if (isSchemaOrPermissionError(legacyAttempt.error)) {
          const fallback: AttendanceLog = { id: `local-${Date.now()}`, userId: user.id, date: today, checkIn: now, segments: [{ in: now }] };
          writeLocalArray('attendance', [fallback, ...localStore].slice(0, 500));
          return fallback;
        }
        throw asError(legacyAttempt.error, 'Clock in failed');
      }
      const data = legacyAttempt.data as any;
      const mapped = {
        id: String(data.id),
        userId: String(data.user_id),
        date: String(data.date),
        checkIn: String(data.check_in),
        checkOut: undefined,
      };
      writeLocalArray('attendance', [mapped, ...localStore.filter((l) => l.id !== mapped.id)].slice(0, 500));
      return mapped;
    }
    if (attempt.error || !attempt.data) {
      console.error('clockIn insert error:', attempt.error);
      if (isSchemaOrPermissionError(attempt.error)) {
        const fallback: AttendanceLog = { id: `local-${Date.now()}`, userId: user.id, date: today, checkIn: now, segments: [{ in: now }] };
        writeLocalArray('attendance', [fallback, ...localStore].slice(0, 500));
        return fallback;
      }
      throw asError(attempt.error, 'Clock in failed');
    }
    const data = attempt.data as any;
    const mapped = {
      id: String(data.id),
      userId: String(data.user_id),
      date: String(data.date),
      checkIn: String(data.check_in),
      checkOut: undefined,
      segments: normalizeSegments(data.segments) || [{ in: now }],
    };
    writeLocalArray('attendance', [mapped, ...localStore.filter((l) => l.id !== mapped.id)].slice(0, 500));
    return mapped;
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
    throw new Error('Mid-day return requires an attendance schema update (segments column). Apply supabase/migrations/20260324000200_attendance_segments.sql.');
  }
  if (error || !data) {
    console.error('clockIn update error:', error);
    if (isSchemaOrPermissionError(error)) {
      const fallback: AttendanceLog = { ...existing, segments };
      writeLocalArray('attendance', [fallback, ...localStore.filter((l) => l.id !== fallback.id)].slice(0, 500));
      return fallback;
    }
    throw asError(error, 'Clock in failed');
  }
  const mapped = {
    id: String((data as any).id),
    userId: String((data as any).user_id),
    date: String((data as any).date),
    checkIn: String((data as any).check_in),
    checkOut: (data as any).check_out ? String((data as any).check_out) : undefined,
    segments: normalizeSegments((data as any).segments) || segments,
  };
  writeLocalArray('attendance', [mapped, ...localStore.filter((l) => l.id !== mapped.id)].slice(0, 500));
  return mapped;
};

export const requestClockOutApproval = async (user: SystemUser, attendance: AttendanceLog, reason: string): Promise<AttendanceCheckoutRequest> => {
  if (!supabase) {
    throw new Error('GM approval requires an online connection (Supabase).');
  }
  const existing = await fetchLatestMiddayCheckoutRequest(attendance.id);
  if (existing?.status === 'pending') {
    throw new Error('Approval already requested. Await GM response.');
  }

  const token = generateToken();
  const tokenHash = await sha256Hex(token);
  const payload = {
    attendance_id: attendance.id,
    user_id: user.id,
    date: attendance.date,
    reason: reason || null,
    status: 'pending',
    token_hash: tokenHash,
    requested_at: nowIso(),
  };

  const insert = await supabase.from('attendance_checkout_requests').insert(payload as any).select('*').single();
  if (insert.error || !insert.data) {
    const message = String(insert.error?.message || '');
    if (/attendance_checkout_requests/i.test(message) || /relation/i.test(message)) {
      throw new Error(
        'Approval requests table missing. Apply the latest Supabase migrations: ' +
        'supabase/migrations/20260325000100_attendance_checkout_requests.sql (and 20260324000100_employee_system.sql).'
      );
    }
    throw insert.error || new Error('Failed to create approval request.');
  }

  const request = normalizeCheckoutRequest(insert.data as any);

  const baseUrl = resolveApiBaseUrl();
  if (!baseUrl) throw new Error('Email backend URL not set. Configure VITE_API_BASE_URL.');
  const approveUrl = `${baseUrl}/api/v1/approvals/attendance-midday?id=${encodeURIComponent(request.id)}&action=approve&token=${encodeURIComponent(token)}`;
  const denyUrl = `${baseUrl}/api/v1/approvals/attendance-midday?id=${encodeURIComponent(request.id)}&action=deny&token=${encodeURIComponent(token)}`;

  const subject = `Mid-day Clock-Out Authorization (${attendance.date})`;
  const body = [
    'MID-DAY CHECKOUT AUTHORIZATION REQUEST',
    '',
    `Employee: ${user.name} (${user.email})`,
    `User ID: ${user.id}`,
    `Date: ${attendance.date}`,
    `Check-in: ${attendance.checkIn}`,
    `Reason: ${reason || 'Not provided'}`,
    '',
    'Approve:',
    approveUrl,
    '',
    'Deny:',
    denyUrl,
    '',
    'This decision will update automatically in the employee portal.',
  ].join('\n');

  await fetch(`${baseUrl}/api/v1/messages/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: ['gm@zayagroupltd.com'], subject, body }),
  });

  return request;
};

export const midDayClockOut = async (user: SystemUser, attendance: AttendanceLog): Promise<AttendanceLog> => {
  if (!attendance.checkIn) throw new Error('You must clock in first.');
  if (attendance.checkOut) throw new Error('You already completed attendance for today.');
  if (!isCheckedIn(attendance)) throw new Error('You are not currently checked in.');
  if (!supabase) throw new Error('Mid-day checkout requires GM approval (online connection required).');

  const latest = await fetchLatestMiddayCheckoutRequest(attendance.id);
  if (!latest) throw new Error('No approval request found. Request mid-day approval first.');
  if (latest.status === 'pending') throw new Error('Approval pending. Await GM response.');
  if (latest.status !== 'approved') throw new Error('Approval denied. Contact GM for assistance.');

  const now = nowIso();
  const segments = (attendance.segments || [{ in: attendance.checkIn }]).slice();
  const last = segments[segments.length - 1];
  if (!last?.in || last?.out) throw new Error('Mid-day checkout not available.');
  last.out = now;

  const { data, error } = await supabase.from('attendance').update({ segments }).eq('id', attendance.id).select('*').single();
  if (error && /segments/i.test(String(error.message || ''))) {
    throw new Error('Mid-day checkout requires an attendance schema update (segments column). Apply supabase/migrations/20260324000200_attendance_segments.sql.');
  }
  if (error || !data) throw error || new Error('Clock out failed');
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
    const updated = { ...attendance, checkOut: now, segments };
    const localStore = readLocalArray<AttendanceLog>('attendance', []);
    writeLocalArray('attendance', [updated, ...localStore.filter((l) => l.id !== updated.id)].slice(0, 500));
    return updated;
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
    if (legacyAttempt.error || !legacyAttempt.data) {
      console.error('clockOut legacy update error:', legacyAttempt.error);
      if (isSchemaOrPermissionError(legacyAttempt.error)) {
        const updated = { ...attendance, checkOut: now, segments };
        const localStore = readLocalArray<AttendanceLog>('attendance', []);
        writeLocalArray('attendance', [updated, ...localStore.filter((l) => l.id !== updated.id)].slice(0, 500));
        return updated;
      }
      throw asError(legacyAttempt.error, 'Clock out failed');
    }
    const data = legacyAttempt.data as any;
    const mapped = {
      id: String(data.id),
      userId: String(data.user_id),
      date: String(data.date),
      checkIn: String(data.check_in),
      checkOut: data.check_out ? String(data.check_out) : undefined,
    };
    const localStore = readLocalArray<AttendanceLog>('attendance', []);
    writeLocalArray('attendance', [mapped, ...localStore.filter((l) => l.id !== mapped.id)].slice(0, 500));
    return mapped;
  }
  if (attempt.error || !attempt.data) {
    console.error('clockOut update error:', attempt.error);
    if (isSchemaOrPermissionError(attempt.error)) {
      const updated = { ...attendance, checkOut: now, segments };
      const localStore = readLocalArray<AttendanceLog>('attendance', []);
      writeLocalArray('attendance', [updated, ...localStore.filter((l) => l.id !== updated.id)].slice(0, 500));
      return updated;
    }
    throw asError(attempt.error, 'Clock out failed');
  }
  const data = attempt.data as any;
  const mapped = {
    id: String(data.id),
    userId: String(data.user_id),
    date: String(data.date),
    checkIn: String(data.check_in),
    checkOut: data.check_out ? String(data.check_out) : undefined,
    segments: normalizeSegments(data.segments) || segments,
  };
  const localStore = readLocalArray<AttendanceLog>('attendance', []);
  writeLocalArray('attendance', [mapped, ...localStore.filter((l) => l.id !== mapped.id)].slice(0, 500));
  return mapped;
};

export const fetchNotices = async (): Promise<Notice[]> => {
  if (!supabase) return readLocalArray<Notice>('notices', []);
  const { data, error } = await supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(200);
  if (error || !data) {
    console.error('fetchNotices error:', error);
    return readLocalArray<Notice>('notices', []);
  }
  const mapped = (data as any[]).map((row) => ({
    id: String(row.id),
    title: String(row.title || ''),
    content: String(row.content || ''),
    createdAt: String(row.created_at || ''),
  }));
  writeLocalArray('notices', mapped);
  return mapped;
};

export const createNotice = async (input: { title: string; content: string }): Promise<Notice> => {
  const local: Notice = { id: `local-${Date.now()}`, title: input.title, content: input.content, createdAt: nowIso() };
  if (!supabase) {
    writeLocalArray('notices', [local, ...readLocalArray<Notice>('notices', [])].slice(0, 400));
    return local;
  }
  const { data, error } = await supabase.from('notices').insert({ ...input, created_at: nowIso() }).select('*').single();
  if (error || !data) {
    console.error('createNotice error:', error);
    if (isSchemaOrPermissionError(error)) {
      writeLocalArray('notices', [local, ...readLocalArray<Notice>('notices', [])].slice(0, 400));
      return local;
    }
    throw asError(error, 'Create notice failed');
  }
  const created = {
    id: String((data as any).id),
    title: String((data as any).title || ''),
    content: String((data as any).content || ''),
    createdAt: String((data as any).created_at || ''),
  };
  writeLocalArray('notices', [created, ...readLocalArray<Notice>('notices', []).filter((n) => n.id !== created.id)].slice(0, 400));
  return created;
};

export const fetchTasks = async (user: SystemUser, isAdmin: boolean): Promise<TaskItem[]> => {
  if (!supabase) return readLocalArray<TaskItem>('tasks', []).filter((t) => (isAdmin ? true : t.userId === user.id));
  const q = supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(300);
  const { data, error } = isAdmin ? await q : await q.eq('user_id', user.id);
  if (error || !data) {
    console.error('fetchTasks error:', error);
    return readLocalArray<TaskItem>('tasks', []).filter((t) => (isAdmin ? true : t.userId === user.id));
  }
  const mapped = (data as any[]).map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title || ''),
    description: String(row.description || ''),
    status: (String(row.status || 'pending').toLowerCase() === 'completed' ? 'completed' : 'pending') as TaskItem['status'],
    createdAt: String(row.created_at || ''),
  }));
  writeLocalArray('tasks', mapped);
  return mapped;
};

export const createTask = async (input: { userId: string; title: string; description: string }): Promise<TaskItem> => {
  const local: TaskItem = { id: `local-${Date.now()}`, userId: input.userId, title: input.title, description: input.description, status: 'pending', createdAt: nowIso() };
  if (!supabase) {
    writeLocalArray('tasks', [local, ...readLocalArray<TaskItem>('tasks', [])].slice(0, 800));
    return local;
  }
  const { data, error } = await supabase.from('tasks').insert({
    user_id: input.userId,
    title: input.title,
    description: input.description,
    status: 'pending',
    created_at: nowIso(),
  }).select('*').single();
  if (error || !data) {
    console.error('createTask error:', error);
    if (isSchemaOrPermissionError(error)) {
      writeLocalArray('tasks', [local, ...readLocalArray<TaskItem>('tasks', [])].slice(0, 800));
      return local;
    }
    throw asError(error, 'Create task failed');
  }
  const created = {
    id: String((data as any).id),
    userId: String((data as any).user_id),
    title: String((data as any).title || ''),
    description: String((data as any).description || ''),
    status: (String((data as any).status || 'pending').toLowerCase() === 'completed' ? 'completed' : 'pending') as TaskItem['status'],
    createdAt: String((data as any).created_at || ''),
  };
  writeLocalArray('tasks', [created, ...readLocalArray<TaskItem>('tasks', []).filter((t) => t.id !== created.id)].slice(0, 800));
  return created;
};

export const setTaskStatus = async (taskId: string, status: 'pending' | 'completed'): Promise<void> => {
  const local = readLocalArray<TaskItem>('tasks', []);
  if (local.length) {
    writeLocalArray('tasks', local.map((t) => (t.id === taskId ? { ...t, status } : t)));
  }
  if (!supabase) return;
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId);
  if (error) {
    console.error('setTaskStatus error:', error);
    if (isSchemaOrPermissionError(error)) return;
    throw asError(error, 'Update task failed');
  }
};

export const fetchChatMessages = async (): Promise<TeamMessage[]> => {
  if (!supabase) return readLocalArray<TeamMessage>('messages', []);
  const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(300);
  if (error || !data) {
    console.error('fetchChatMessages error:', error);
    return readLocalArray<TeamMessage>('messages', []);
  }
  const mapped = (data as any[]).map((row) => ({
    id: String(row.id),
    senderId: String(row.sender_id),
    message: String(row.message || ''),
    createdAt: String(row.created_at || ''),
  }));
  writeLocalArray('messages', mapped);
  return mapped;
};

export const sendChatMessage = async (sender: SystemUser, message: string): Promise<TeamMessage> => {
  const local: TeamMessage = { id: `local-${Date.now()}`, senderId: sender.id, message, createdAt: nowIso() };
  if (!supabase) {
    writeLocalArray('messages', [...readLocalArray<TeamMessage>('messages', []), local].slice(-500));
    return local;
  }
  const { data, error } = await supabase.from('messages').insert({
    sender_id: sender.id,
    message,
    created_at: nowIso(),
  }).select('*').single();
  if (error || !data) {
    console.error('sendChatMessage error:', error);
    if (isSchemaOrPermissionError(error)) {
      writeLocalArray('messages', [...readLocalArray<TeamMessage>('messages', []), local].slice(-500));
      return local;
    }
    throw asError(error, 'Send message failed');
  }
  const created = {
    id: String((data as any).id),
    senderId: String((data as any).sender_id),
    message: String((data as any).message || ''),
    createdAt: String((data as any).created_at || ''),
  };
  writeLocalArray('messages', [...readLocalArray<TeamMessage>('messages', []), created].slice(-500));
  return created;
};

export const subscribeToTableInserts = (
  table: string,
  onInsert: (row: any) => void
) => {
  if (!supabase) return { unsubscribe: () => {} };
  const channel = supabase.channel(`erp-${table}-inserts`);
  (channel as any)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (payload: any) => {
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
    (channel as any).on(
      'postgres_changes',
      { event, schema: 'public', table, filter: options.filter },
      (payload: any) => {
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
  input: PayrollRunInput,
  options?: { bypassWriteOnce?: boolean; actor?: SystemUser }
): Promise<{ processed: PayrollRecord[]; skippedUserIds: string[] }> => {
  const month = input.month;
  const year = input.year;
  const workingDays = input.workingDays ?? 26;
  const allowBypass = Boolean(options?.bypassWriteOnce && options?.actor?.role === UserRole.SUPER_ADMIN);

  const computeRecord = (u: SystemUser, daysPresent: number): { record: PayrollRecord; breakdown: any } => {
    const basicSalary = Number(u.baseSalary ?? input.defaultBasicSalary ?? 0);
    const allowancesTotal = Number(u.allowancesTotal ?? input.defaultAllowancesTotal ?? 0);
    const deductionsTotal = Number(u.deductionsTotal ?? input.defaultDeductionsTotal ?? 0);
    const score = Number(u.performanceScore ?? input.defaultPerformanceScore ?? 0);
    const performanceBonus = score > 80 ? Math.round(basicSalary * 0.1) : 0;
    const prorated = workingDays > 0 ? (basicSalary * (daysPresent / workingDays)) : basicSalary;
    const netSalary = Math.max(0, Math.round(prorated + allowancesTotal - deductionsTotal + performanceBonus));
    const id = `local-pay-${u.id}-${year}-${month}-${Date.now()}`;
    return {
      record: {
        id,
        userId: u.id,
        month,
        year,
        basicSalary,
        allowancesTotal,
        deductionsTotal,
        netSalary,
        createdAt: nowIso(),
      },
      breakdown: {
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
      },
    };
  };

  const processLocal = (): { processed: PayrollRecord[]; skippedUserIds: string[] } => {
    const attendance = readLocalArray<AttendanceLog>('attendance', []);
    let payrollStore = readLocalArray<PayrollRecord>('payroll', []);
    const existing = new Set(payrollStore.map((r) => `${r.userId}:${r.month}:${r.year}`));
    const processed: PayrollRecord[] = [];
    const skipped: string[] = [];
    const removedPayrollIds: string[] = [];
    for (const u of users) {
      const key = `${u.id}:${month}:${year}`;
      if (existing.has(key) && !allowBypass) { skipped.push(u.id); continue; }
      if (existing.has(key) && allowBypass) {
        const removed = payrollStore.filter((r) => r.userId === u.id && r.month === month && r.year === year);
        removedPayrollIds.push(...removed.map((r) => r.id));
        payrollStore = payrollStore.filter((r) => !(r.userId === u.id && r.month === month && r.year === year));
      }
      const daysPresent = attendance.filter((a) => a.userId === u.id && a.checkIn && a.date.startsWith(`${year}-${String(month).padStart(2, '0')}`)).length;
      const { record, breakdown } = computeRecord(u, daysPresent);
      processed.push(record);
      const payslips = readLocalArray<PayslipRecord>('payslips', []);
      writeLocalArray('payslips', [{ id: `local-slip-${record.id}`, payrollId: record.id, breakdown, createdAt: nowIso() }, ...payslips].slice(0, 800));
    }
    if (removedPayrollIds.length) {
      const slips = readLocalArray<PayslipRecord>('payslips', []);
      writeLocalArray('payslips', slips.filter((s) => !removedPayrollIds.includes(s.payrollId)).slice(0, 800));
    }
    writeLocalArray('payroll', [...processed, ...payrollStore].slice(0, 800));
    return { processed, skippedUserIds: skipped };
  };

  if (!supabase) return processLocal();
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString().slice(0, 10);
  const monthEnd = new Date(Date.UTC(year, month, 0, 0, 0, 0)).toISOString().slice(0, 10);

  const { data: attendanceRows, error: attendanceError } = await supabase
    .from('attendance')
    .select('*')
    .gte('date', monthStart)
    .lte('date', monthEnd);
  if (attendanceError) {
    console.error('processPayroll attendance fetch error:', attendanceError);
    if (isSchemaOrPermissionError(attendanceError)) return processLocal();
    throw asError(attendanceError, 'Payroll processing failed (attendance fetch).');
  }
  const attendance = (attendanceRows as any[] | null) || [];

  const { data: existingPayrollRows, error: existingError } = await supabase
    .from('payroll')
    .select('user_id, month, year')
    .eq('month', month)
    .eq('year', year);
  if (existingError) {
    console.error('processPayroll existing payroll fetch error:', existingError);
    if (isSchemaOrPermissionError(existingError)) return processLocal();
    throw asError(existingError, 'Payroll processing failed (existing payroll fetch).');
  }
  const existingPayroll = new Set(((existingPayrollRows as any[] | null) || []).map((r) => `${r.user_id}:${r.month}:${r.year}`));

  const processed: PayrollRecord[] = [];
  const skipped: string[] = [];

  for (const u of users) {
    const key = `${u.id}:${month}:${year}`;
    if (existingPayroll.has(key) && !allowBypass) {
      skipped.push(u.id);
      continue;
    }
    const daysPresent = attendance.filter((a) => String(a.user_id) === u.id && a.check_in).length;
    const { record: computed, breakdown } = computeRecord(u, daysPresent);

    const payrollRow = {
      user_id: u.id,
      month,
      year,
      basic_salary: computed.basicSalary,
      allowances_total: computed.allowancesTotal,
      deductions_total: computed.deductionsTotal,
      net_salary: computed.netSalary,
      created_at: nowIso(),
    };
    const { data: payroll, error } = allowBypass
      ? await supabase.from('payroll').upsert(payrollRow as any, { onConflict: 'user_id,month,year' }).select('*').single()
      : await supabase.from('payroll').insert(payrollRow as any).select('*').single();
    if (error || !payroll) {
      console.error('processPayroll payroll insert error:', error);
      if (isSchemaOrPermissionError(error)) return processLocal();
      throw asError(error, 'Payroll insert failed');
    }
    const payrollId = String((payroll as any).id);
    const slipAttempt = await supabase
      .from('payslips')
      .upsert(
        { payroll_id: payrollId, breakdown_json: breakdown, created_at: nowIso() } as any,
        { onConflict: 'payroll_id' }
      );
    if (slipAttempt.error) {
      console.error('processPayroll payslip upsert error:', slipAttempt.error);
      if (isSchemaOrPermissionError(slipAttempt.error)) return processLocal();
      throw asError(slipAttempt.error, 'Payslip generation failed.');
    }

    processed.push({
      id: payrollId,
      userId: u.id,
      month,
      year,
      basicSalary: computed.basicSalary,
      allowancesTotal: computed.allowancesTotal,
      deductionsTotal: computed.deductionsTotal,
      netSalary: computed.netSalary,
      createdAt: String((payroll as any).created_at || nowIso()),
    });
  }

  return { processed, skippedUserIds: skipped };
};

export const fetchPayrollDashboard = async (): Promise<PayrollRecord[]> => {
  if (!supabase) return readLocalArray<PayrollRecord>('payroll', []);
  const { data, error } = await supabase.from('payroll').select('*').order('created_at', { ascending: false }).limit(200);
  if (error || !data) {
    console.error('fetchPayrollDashboard error:', error);
    return readLocalArray<PayrollRecord>('payroll', []);
  }
  const mapped = (data as any[]).map((row) => ({
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
  writeLocalArray('payroll', mapped);
  return mapped;
};

export const fetchPayslipByPayrollId = async (payrollId: string): Promise<PayslipRecord | null> => {
  if (!supabase) return readLocalArray<PayslipRecord>('payslips', []).find((p) => p.payrollId === payrollId) || null;
  const { data, error } = await supabase.from('payslips').select('*').eq('payroll_id', payrollId).maybeSingle();
  if (error) {
    console.error('fetchPayslipByPayrollId error:', error);
    return readLocalArray<PayslipRecord>('payslips', []).find((p) => p.payrollId === payrollId) || null;
  }
  if (!data) return null;
  const mapped = {
    id: String((data as any).id),
    payrollId: String((data as any).payroll_id),
    breakdown: (data as any).breakdown_json,
    createdAt: String((data as any).created_at || ''),
  };
  const local = readLocalArray<PayslipRecord>('payslips', []);
  writeLocalArray('payslips', [mapped, ...local.filter((p) => p.id !== mapped.id)].slice(0, 800));
  return mapped;
};
