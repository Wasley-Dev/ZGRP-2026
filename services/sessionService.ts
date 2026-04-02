import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { MachineSession, SystemUser } from '../types';
import { getSupabaseConfig } from './supabaseConfig';

const TABLE_NAME = 'portal_sessions';
const LOCAL_SESSIONS_KEY = 'zaya_local_sessions_v1';

let supabase: SupabaseClient | null = null;
let supabaseConfigKey = '';
const getSupabase = (): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (!config) return null;
  const key = `${config.url}|${config.anonKey}`;
  if (supabase && supabaseConfigKey === key) return supabase;
  supabase = createClient(config.url, config.anonKey);
  supabaseConfigKey = key;
  return supabase;
};

const useLocalSessionStore = () =>
  !getSupabase() || (typeof navigator !== 'undefined' && navigator.onLine === false);

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

const readLocalSessions = (): SessionRow[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionRow[]) : [];
  } catch {
    return [];
  }
};

const writeLocalSessions = (sessions: SessionRow[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    // ignore
  }
};

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

const IP_CACHE_KEY = 'zaya_public_ip_v1';
const GEO_CACHE_KEY = 'zaya_public_geo_v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const NETWORK_TIMEOUT_MS = 2500;

const readCache = <T,>(key: string): { value: T; savedAt: number } | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value: T; savedAt: number };
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCache = <T,>(key: string, value: T) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // ignore
  }
};

const fetchJsonWithTimeout = async <T,>(url: string, timeoutMs = NETWORK_TIMEOUT_MS): Promise<T | null> => {
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
    const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (timer) window.clearTimeout(timer);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const fetchPublicIp = async (): Promise<string> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Offline';
    const cached = readCache<{ ip?: string }>(IP_CACHE_KEY);
    if (cached?.value?.ip) return cached.value.ip;
    const payload = await fetchJsonWithTimeout<{ ip?: string }>('https://api.ipify.org?format=json');
    const ip = payload?.ip || 'Unavailable';
    if (ip !== 'Unavailable') writeCache(IP_CACHE_KEY, { ip });
    return ip;
  } catch {
    return 'Unavailable';
  }
};

const fetchGeoFromIp = async (): Promise<{ latitude?: number; longitude?: number; locationLabel?: string }> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return {};
    const cached = readCache<{ latitude?: number; longitude?: number; locationLabel?: string }>(GEO_CACHE_KEY);
    if (cached?.value && (cached.value.latitude || cached.value.locationLabel)) return cached.value;

    const payload = await fetchJsonWithTimeout<{
      latitude?: number;
      longitude?: number;
      city?: string;
      region?: string;
      country_name?: string;
    }>('https://ipapi.co/json/');
    if (!payload) return {};
    if (typeof payload.latitude !== 'number' || typeof payload.longitude !== 'number') return {};
    const latitude = Number(payload.latitude.toFixed(6));
    const longitude = Number(payload.longitude.toFixed(6));
    const area = [payload.city, payload.region, payload.country_name].filter(Boolean).join(', ');
    const geo = {
      latitude,
      longitude,
      locationLabel: area || `${latitude}, ${longitude}`,
    };
    writeCache(GEO_CACHE_KEY, geo);
    return geo;
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

export const hasRemoteSessionStore = () => Boolean(getSupabase());

export const createLocalSessionId = () =>
  `SES-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const upsertSessionHeartbeat = async (
  sessionId: string,
  user: SystemUser,
  forceStatus?: MachineSession['status']
) => {
  if (useLocalSessionStore()) {
    const session: MachineSession = {
      id: sessionId,
      userId: user.id,
      userName: user.name,
      email: user.email,
      machineName: getMachineName(),
      os: getOsName(),
      ip: typeof navigator !== 'undefined' && navigator.onLine === false ? 'Offline' : 'Unavailable',
      lastSeenAt: nowIso(),
      isOnline: (forceStatus || 'ACTIVE') === 'ACTIVE',
      status: forceStatus || 'ACTIVE',
      forceLogoutReason: undefined,
      forcedOutAt: undefined,
    };
    const rows = readLocalSessions();
    const next = rows.filter((r) => r.id !== sessionId);
    next.unshift(toRow(session));
    writeLocalSessions(next.slice(0, 100));
    return;
  }
  const client = getSupabase();
  if (!client) return;
  const [ip, browserGeo, ipGeo] = await Promise.all([fetchPublicIp(), fetchBrowserGeo(), fetchGeoFromIp()]);
  const { data: existing, error: existingError } = await client
    .from(TABLE_NAME)
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (existingError) {
    console.warn('Session existing lookup error:', existingError);
  }
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
  const upsert = await client.from(TABLE_NAME).upsert(toRow(session), { onConflict: 'id' });
  if (upsert.error) {
    console.warn('Session heartbeat upsert error:', upsert.error);
  }
};

export const markSessionOffline = async (sessionId: string) => {
  if (useLocalSessionStore()) {
    const rows = readLocalSessions();
    const next = rows.map((r) =>
      r.id === sessionId ? { ...r, is_online: false, last_seen_at: nowIso() } : r
    );
    writeLocalSessions(next);
    return;
  }
  const client = getSupabase();
  if (!client) return;
  const res = await client
    .from(TABLE_NAME)
    .update({ is_online: false, last_seen_at: nowIso() })
    .eq('id', sessionId);
  if (res.error) {
    console.warn('Session mark offline error:', res.error);
  }
};

export const fetchActiveSessions = async (): Promise<MachineSession[]> => {
  if (useLocalSessionStore()) {
    return readLocalSessions()
      .sort((a, b) => String(b.last_seen_at).localeCompare(String(a.last_seen_at)))
      .map(toSession);
  }
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from(TABLE_NAME).select('*').order('last_seen_at', { ascending: false });
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
  if (useLocalSessionStore()) {
    const rows = readLocalSessions();
    const payload: Partial<SessionRow> = {
      status,
      last_seen_at: nowIso(),
      is_online: status === 'ACTIVE',
      force_logout_reason: status === 'FORCED_OUT' ? (reason || 'This machine was signed out because a newer login became active.') : null,
      forced_out_at: status === 'FORCED_OUT' ? nowIso() : null,
    };
    const next = rows.map((r) => (r.id === sessionId ? { ...r, ...payload } as SessionRow : r));
    writeLocalSessions(next);
    return;
  }
  const client = getSupabase();
  if (!client) return;
  const payload: Record<string, unknown> = {
    status,
    last_seen_at: nowIso(),
    is_online: status === 'ACTIVE',
  };
  if (status === 'FORCED_OUT') {
    payload.force_logout_reason = reason || 'This machine was signed out because a newer login became active.';
    payload.forced_out_at = nowIso();
  }
  const res = await client
    .from(TABLE_NAME)
    .update(payload)
    .eq('id', sessionId);
  if (res.error) {
    throw res.error;
  }
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  if (useLocalSessionStore()) {
    const rows = readLocalSessions();
    writeLocalSessions(rows.filter((r) => r.id !== sessionId));
    return;
  }
  const client = getSupabase();
  if (!client) return;
  const res = await client.from(TABLE_NAME).delete().eq('id', sessionId);
  if (res.error) {
    throw res.error;
  }
};

export const enforceSingleSessionPerUser = async (
  userId: string,
  keepSessionId: string
): Promise<void> => {
  if (useLocalSessionStore()) {
    const reason = 'You were signed out because your account logged in on another machine. Only the latest login stays online.';
    const rows = readLocalSessions();
    const next = rows.map((r) => {
      if (r.user_id !== userId) return r;
      if (r.id === keepSessionId) return r;
      if (r.status !== 'ACTIVE') return r;
      return {
        ...r,
        status: 'FORCED_OUT' as SessionRow['status'],
        is_online: false,
        last_seen_at: nowIso(),
        force_logout_reason: reason,
        forced_out_at: nowIso(),
      };
    });
    writeLocalSessions(next);
    return;
  }
  const client = getSupabase();
  if (!client) return;
  const reason = 'You were signed out because your account logged in on another machine. Only the latest login stays online.';
  const res = await client
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
  if (res.error) {
    console.warn('Session enforcement error:', res.error);
  }
};

export const subscribeSessionChanges = (onChange: () => void): { unsubscribe: () => void } => {
  const client = getSupabase();
  if (!client) return { unsubscribe: () => {} };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, 500);
  };

  const channel: RealtimeChannel = client
    .channel(`${TABLE_NAME}-changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, schedule);
  channel.subscribe();

  return {
    unsubscribe: () => {
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    },
  };
};
