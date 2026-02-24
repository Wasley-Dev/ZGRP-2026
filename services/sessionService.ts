import { createClient } from '@supabase/supabase-js';
import { MachineSession, SystemUser } from '../types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const TABLE_NAME = 'portal_sessions';

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

type SessionRow = {
  id: string;
  user_id: string;
  user_name: string;
  email: string;
  machine_name: string;
  os: string;
  ip: string;
  last_seen_at: string;
  is_online: boolean;
  status: 'ACTIVE' | 'FORCED_OUT' | 'REVOKED';
};

const toSession = (row: SessionRow): MachineSession => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  email: row.email,
  machineName: row.machine_name,
  os: row.os,
  ip: row.ip,
  lastSeenAt: row.last_seen_at,
  isOnline: row.is_online,
  status: row.status,
});

const toRow = (session: MachineSession): SessionRow => ({
  id: session.id,
  user_id: session.userId,
  user_name: session.userName,
  email: session.email,
  machine_name: session.machineName,
  os: session.os,
  ip: session.ip,
  last_seen_at: session.lastSeenAt,
  is_online: session.isOnline,
  status: session.status,
});

const nowIso = () => new Date().toISOString();

const getMachineName = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const platform = typeof navigator !== 'undefined' ? navigator.platform : 'Unknown OS';
  return host && host !== 'localhost' ? `${platform} @ ${host}` : platform;
};

const getOsName = () => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  return 'Unknown';
};

const fetchPublicIp = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) return 'Unavailable';
    const payload = (await response.json()) as { ip?: string };
    return payload.ip || 'Unavailable';
  } catch {
    return 'Unavailable';
  }
};

export const hasRemoteSessionStore = () => Boolean(supabase);

export const createLocalSessionId = () =>
  `SES-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const upsertSessionHeartbeat = async (
  sessionId: string,
  user: SystemUser,
  forceStatus?: MachineSession['status']
) => {
  if (!supabase) return;
  const ip = await fetchPublicIp();
  const session: MachineSession = {
    id: sessionId,
    userId: user.id,
    userName: user.name,
    email: user.email,
    machineName: getMachineName(),
    os: getOsName(),
    ip,
    lastSeenAt: nowIso(),
    isOnline: true,
    status: forceStatus || 'ACTIVE',
  };
  await supabase.from(TABLE_NAME).upsert(toRow(session), { onConflict: 'id' });
};

export const markSessionOffline = async (sessionId: string) => {
  if (!supabase) return;
  await supabase
    .from(TABLE_NAME)
    .update({ is_online: false, last_seen_at: nowIso() })
    .eq('id', sessionId);
};

export const fetchActiveSessions = async (): Promise<MachineSession[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from(TABLE_NAME).select('*').order('last_seen_at', { ascending: false });
  if (error || !data) {
    console.error('Session fetch error:', error);
    return [];
  }
  return (data as SessionRow[]).map(toSession);
};

export const updateSessionStatus = async (
  sessionId: string,
  status: MachineSession['status']
): Promise<void> => {
  if (!supabase) return;
  await supabase
    .from(TABLE_NAME)
    .update({ status, last_seen_at: nowIso(), is_online: status === 'ACTIVE' })
    .eq('id', sessionId);
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  if (!supabase) return;
  await supabase.from(TABLE_NAME).delete().eq('id', sessionId);
};

export const enforceSingleSessionPerUser = async (
  userId: string,
  keepSessionId: string
): Promise<void> => {
  if (!supabase) return;
  await supabase
    .from(TABLE_NAME)
    .update({ status: 'FORCED_OUT', is_online: false, last_seen_at: nowIso() })
    .eq('user_id', userId)
    .neq('id', keepSessionId)
    .eq('status', 'ACTIVE');
};
