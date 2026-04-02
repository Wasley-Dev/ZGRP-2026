import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { BookingEntry, Candidate, SystemConfig, SystemUser } from '../types';
import { getSupabaseConfig } from './supabaseConfig';

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

export const hasRemoteData = () => Boolean(getSupabase());

type CandidateRow = {
  id: string;
  full_name: string;
  gender: string;
  phone: string;
  email: string;
  dob: string;
  age: number;
  address: string;
  occupation: string;
  experience_years: number;
  position_applied: string;
  status: string;
  documents: unknown;
  skills: unknown;
  photo_url: string | null;
  created_at: string;
  notes: string | null;
  source: string | null;
  updated_at: string;
};

type ConfigRow = {
  id: string;
  system_name: string;
  logo_icon: string;
  login_hero_image: string | null;
  login_hero_images: unknown;
  login_showcase_title: string | null;
  login_showcase_summary: string | null;
  login_quote: string | null;
  login_quote_author: string | null;
  login_facts: unknown;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  maintenance_updated_by: string | null;
  maintenance_updated_at: string | null;
  backup_hour: number;
  updated_at: string;
};
type PortalUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password: string;
  has_completed_orientation: boolean;
  role: string;
  department: string;
  job_title?: string | null;
  avatar: string | null;
  last_login: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BANNED';
  base_salary?: number | null;
  performance_score?: number | null;
};
type BookingRow = {
  id: string;
  booker: string;
  date: string | null;
  time: string;
  purpose: string;
  remarks: string;
  created_at: string;
  created_by_user_id: string;
  updated_at: string;
};

const nowIso = () => new Date().toISOString();

export const fetchRemoteCandidatesWithStatus = async (): Promise<{ items: Candidate[]; ok: boolean }> => {
  const client = getSupabase();
  if (!client) return { items: [], ok: false };
  const { data, error } = await client.from('portal_candidates').select('*');
  if (error || !data) {
    console.error('Remote candidates fetch error:', error);
    return { items: [], ok: false };
  }
  const items = (data as CandidateRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    gender: row.gender as Candidate['gender'],
    phone: row.phone,
    email: row.email,
    dob: row.dob,
    age: row.age,
    address: row.address,
    occupation: row.occupation,
    experienceYears: row.experience_years,
    positionApplied: row.position_applied,
    status: row.status as Candidate['status'],
    documents: row.documents as Candidate['documents'],
    skills: (row.skills as string[] | null) || undefined,
    photoUrl: row.photo_url || undefined,
    createdAt: row.created_at,
    notes: row.notes || undefined,
    source: (row.source as Candidate['source']) || undefined,
  }));
  return { items, ok: true };
};

export const fetchRemoteCandidates = async (): Promise<Candidate[]> => {
  const res = await fetchRemoteCandidatesWithStatus();
  return res.items;
};

export const syncRemoteCandidates = async (candidates: Candidate[]): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  const rows: CandidateRow[] = candidates.map((c) => ({
    id: c.id,
    full_name: c.fullName,
    gender: c.gender,
    phone: c.phone,
    email: c.email,
    dob: c.dob,
    age: c.age,
    address: c.address,
    occupation: c.occupation,
    experience_years: c.experienceYears,
    position_applied: c.positionApplied,
    status: c.status,
    documents: c.documents,
    skills: c.skills || null,
    photo_url: c.photoUrl || null,
    created_at: c.createdAt,
    notes: c.notes || null,
    source: c.source || null,
    updated_at: nowIso(),
  }));
  const { error } = await client.from('portal_candidates').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('Remote candidates upsert error:', error);
    throw error;
  }
};

export const fetchRemoteSystemConfig = async (): Promise<SystemConfig | null> => {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('portal_system_config').select('*').eq('id', 'config').single();
  if (error || !data) {
    if (error) console.error('Remote system config fetch error:', error);
    return null;
  }
  const row = data as ConfigRow;
  return {
    systemName: row.system_name,
    logoIcon: row.logo_icon,
    loginHeroImage: row.login_hero_image || undefined,
    loginHeroImages: Array.isArray(row.login_hero_images) ? (row.login_hero_images as string[]) : undefined,
    loginShowcaseTitle: row.login_showcase_title || undefined,
    loginShowcaseSummary: row.login_showcase_summary || undefined,
    loginQuote: row.login_quote || undefined,
    loginQuoteAuthor: row.login_quote_author || undefined,
    loginFacts: Array.isArray(row.login_facts) ? (row.login_facts as string[]) : undefined,
    maintenanceMode: row.maintenance_mode,
    maintenanceMessage: row.maintenance_message || undefined,
    maintenanceUpdatedBy: row.maintenance_updated_by || undefined,
    maintenanceUpdatedAt: row.maintenance_updated_at || undefined,
    backupHour: row.backup_hour ?? 15,
  };
};

export const syncRemoteSystemConfig = async (config: SystemConfig): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  const row: ConfigRow = {
    id: 'config',
    system_name: config.systemName,
    logo_icon: config.logoIcon,
    login_hero_image: config.loginHeroImage ?? null,
    login_hero_images: config.loginHeroImages ?? null,
    login_showcase_title: config.loginShowcaseTitle ?? null,
    login_showcase_summary: config.loginShowcaseSummary ?? null,
    login_quote: config.loginQuote ?? null,
    login_quote_author: config.loginQuoteAuthor ?? null,
    login_facts: config.loginFacts ?? null,
    maintenance_mode: config.maintenanceMode ?? false,
    maintenance_message: config.maintenanceMessage ?? null,
    maintenance_updated_by: config.maintenanceUpdatedBy ?? null,
    maintenance_updated_at: config.maintenanceUpdatedAt ?? null,
    backup_hour: config.backupHour ?? 15,
    updated_at: nowIso(),
  };
  const { error } = await client.from('portal_system_config').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('Remote system config upsert error:', error);
    throw error;
  }
};

export const syncRemoteUsers = async (users: SystemUser[]): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  const rows: PortalUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? null,
    password: u.password,
    has_completed_orientation: u.hasCompletedOrientation ?? false,
    role: u.role,
    department: u.department,
    job_title: u.jobTitle || null,
    avatar: u.avatar ?? null,
    last_login: u.lastLogin,
    status: u.status,
    base_salary: typeof u.baseSalary === 'number' ? u.baseSalary : null,
    performance_score: typeof u.performanceScore === 'number' ? u.performanceScore : null,
  }));
  const attempt = await client.from('portal_users').upsert(rows, { onConflict: 'id' });
  if (!attempt.error) return;

  const message = String(attempt.error?.message || '');
  const missingJobTitle = /job_title/i.test(message);
  const missingBaseSalary = /base_salary/i.test(message);
  const missingPerformance = /performance_score/i.test(message);
  if (!missingJobTitle && !missingBaseSalary && !missingPerformance) {
    console.error('Remote users upsert error:', attempt.error);
    throw attempt.error;
  }
  const legacyRows = rows.map((row: any) => {
    const next = { ...row };
    if (missingJobTitle) delete next.job_title;
    if (missingBaseSalary) delete next.base_salary;
    if (missingPerformance) delete next.performance_score;
    return next;
  });
  const retry = await client.from('portal_users').upsert(legacyRows as any, { onConflict: 'id' });
  if (retry.error) {
    console.error('Remote users upsert error (legacy retry):', retry.error);
    throw retry.error;
  }
};

export const fetchRemoteBookingsWithStatus = async (): Promise<{ items: BookingEntry[]; ok: boolean }> => {
  const client = getSupabase();
  if (!client) return { items: [], ok: false };
  const { data, error } = await client.from('portal_bookings').select('*').order('created_at', { ascending: false });
  if (error || !data) {
    console.error('Remote bookings fetch error:', error);
    return { items: [], ok: false };
  }
  const items = (data as BookingRow[]).map((row) => ({
    id: row.id,
    booker: row.booker,
    date: row.date || row.created_at.slice(0, 10),
    time: row.time,
    purpose: row.purpose,
    remarks: row.remarks,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
  }));
  return { items, ok: true };
};

export const fetchRemoteBookings = async (): Promise<BookingEntry[]> => {
  const res = await fetchRemoteBookingsWithStatus();
  return res.items;
};

export const syncRemoteBookings = async (bookings: BookingEntry[]): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    booker: b.booker,
    date: b.date,
    time: b.time,
    purpose: b.purpose,
    remarks: b.remarks,
    created_at: b.createdAt,
    created_by_user_id: b.createdByUserId,
    updated_at: nowIso(),
  }));
  const { error } = await client.from('portal_bookings').upsert(rows, { onConflict: 'id' });
  if (error) {
    console.error('Remote bookings upsert error:', error);
    throw error;
  }
};

export const purgeRemotePortalDataExceptUsers = async (): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  const targets = ['portal_candidates', 'portal_bookings'];
  for (const table of targets) {
    try {
      const attempt = await client.from(table).delete().not('id', 'is', null);
      if (attempt.error) {
        console.error(`purgeRemotePortalDataExceptUsers error (${table}):`, attempt.error);
      }
    } catch (err) {
      console.error(`purgeRemotePortalDataExceptUsers exception (${table}):`, err);
    }
  }
};

export const subscribeRemotePortalData = (handlers: {
  onCandidates?: (items: Candidate[]) => void;
  onBookings?: (items: BookingEntry[]) => void;
  onSystemConfig?: (config: SystemConfig | null) => void;
}): { unsubscribe: () => void } => {
  const client = getSupabase();
  if (!client) return { unsubscribe: () => {} };

  let candidatesTimer: ReturnType<typeof setTimeout> | null = null;
  let bookingsTimer: ReturnType<typeof setTimeout> | null = null;
  let configTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleCandidates = () => {
    if (!handlers.onCandidates) return;
    if (candidatesTimer) return;
    candidatesTimer = setTimeout(async () => {
      candidatesTimer = null;
      const res = await fetchRemoteCandidatesWithStatus();
      if (!res.ok) return;
      handlers.onCandidates?.(res.items);
    }, 600);
  };

  const scheduleBookings = () => {
    if (!handlers.onBookings) return;
    if (bookingsTimer) return;
    bookingsTimer = setTimeout(async () => {
      bookingsTimer = null;
      const res = await fetchRemoteBookingsWithStatus();
      if (!res.ok) return;
      handlers.onBookings?.(res.items);
    }, 600);
  };

  const scheduleConfig = () => {
    if (!handlers.onSystemConfig) return;
    if (configTimer) return;
    configTimer = setTimeout(async () => {
      configTimer = null;
      handlers.onSystemConfig?.(await fetchRemoteSystemConfig());
    }, 600);
  };

  const channel: RealtimeChannel = client
    .channel('portal-data-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_candidates' }, scheduleCandidates)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_bookings' }, scheduleBookings)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_system_config' }, scheduleConfig);

  channel.subscribe();

  return {
    unsubscribe: () => {
      if (candidatesTimer) clearTimeout(candidatesTimer);
      if (bookingsTimer) clearTimeout(bookingsTimer);
      if (configTimer) clearTimeout(configTimer);
      client.removeChannel(channel);
    },
  };
};
