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
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  last_seen_at: string;
  is_online: boolean;
  status: MachineSession['status'];
  force_logout_reason?: string | null;
  forced_out_at?: string | null;
};

const toSession = (row: SessionRow): MachineSession => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  email: row.email,
  machineName: row.machine_name,
  os: row.os,
  ip: row.ip,
  latitude: row.latitude ?? undefined,
  longitude: row.longitude ?? undefined,
  locationLabel: row.location_label ?? undefined,
  lastSeenAt: row.last_seen_at,
  isOnline: row.is_online,
  status: row.status,
  forceLogoutReason: row.force_logout_reason ?? undefined,
  forcedOutAt: row.forced_out_at ?? undefined,
});

const toRow = (session: MachineSession): SessionRow => ({
  id: session.id,
  user_id: session.userId,
  user_name: session.userName,
  email: session.email,
  machine_name: session.machineName,
  os: session.os,
  ip: session.ip,
  latitude: session.latitude ?? null,
  longitude: session.longitude ?? null,
  location_label: session.locationLabel ?? null,
  last_seen_at: session.lastSeenAt,
  is_online: session.isOnline,
  status: session.status,
  force_logout_reason: session.forceLogoutReason ?? null,
  forced_out_at: session.forcedOutAt ?? null,
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

const fetchGeoFromIp = async (): Promise<{ latitude?: number; longitude?: number; locationLabel?: string }> => {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) return {};
    const payload = (await response.json()) as {
      latitude?: number;
      longitude?: number;
      city?: string;
      region?: string;
      country_name?: string;
    };
    if (typeof payload.latitude !== 'number' || typeof payload.longitude !== 'number') return {};
    const latitude = Number(payload.latitude.toFixed(6));
    const longitude = Number(payload.longitude.toFixed(6));
    const area = [payload.city, payload.region, payload.country_name].filter(Boolean).join(', ');
    return {
      latitude,
      longitude,
      locationLabel: area || `${latitude}, ${longitude}`,
    };
  } catch {
    return {};
  }
};

const fetchBrowserGeo = async (): Promise<{ latitude?: number; longitude?: number; locationLabel?: string }> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return {};
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 120000,
      });
    });
    const latitude = Number(position.coords.latitude.toFixed(6));
    const longitude = Number(position.coords.longitude.toFixed(6));
    return {
      latitude,
      longitude,
      locationLabel: `${latitude}, ${longitude}`,
    };
  } catch {
    return {};
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
  const [ip, browserGeo, ipGeo] = await Promise.all([fetchPublicIp(), fetchBrowserGeo(), fetchGeoFromIp()]);
  const { data: existing } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  const existingSession = existing as SessionRow | null;
  const forcedOrRevoked = existingSession?.status === 'FORCED_OUT' || existingSession?.status === 'REVOKED';
  const effectiveStatus = forceStatus || (forcedOrRevoked ? existingSession!.status : 'ACTIVE');
  const session: MachineSession = {
    id: sessionId,
    userId: user.id,
    userName: user.name,
    email: user.email,
    machineName: getMachineName(),
    os: getOsName(),
    ip,
    latitude: browserGeo.latitude ?? ipGeo.latitude ?? existingSession?.latitude ?? undefined,
    longitude: browserGeo.longitude ?? ipGeo.longitude ?? existingSession?.longitude ?? undefined,
    locationLabel: browserGeo.locationLabel ?? ipGeo.locationLabel ?? existingSession?.location_label ?? undefined,
    lastSeenAt: nowIso(),
    isOnline: effectiveStatus === 'ACTIVE',
    status: effectiveStatus,
    forceLogoutReason: existingSession?.force_logout_reason ?? undefined,
    forcedOutAt: existingSession?.forced_out_at ?? undefined,
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
  status: MachineSession['status'],
  reason?: string
): Promise<void> => {
  if (!supabase) return;
  const payload: Record<string, unknown> = {
    status,
    last_seen_at: nowIso(),
    is_online: status === 'ACTIVE',
  };
  if (status === 'FORCED_OUT') {
    payload.force_logout_reason = reason || 'This machine was signed out because a newer login became active.';
    payload.forced_out_at = nowIso();
  }
  await supabase
    .from(TABLE_NAME)
    .update(payload)
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
  const reason = 'You were signed out because your account logged in on another machine. Only the latest login stays online.';
  await supabase
    .from(TABLE_NAME)
    .update({
      status: 'FORCED_OUT',
      is_online: false,
      last_seen_at: nowIso(),
      force_logout_reason: reason,
      forced_out_at: nowIso(),
    })
    .eq('user_id', userId)
    .neq('id', keepSessionId)
    .eq('status', 'ACTIVE');
};
