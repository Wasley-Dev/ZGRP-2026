import { createClient } from '@supabase/supabase-js';
import { BookingEntry, Candidate, SystemConfig, SystemUser } from '../types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const hasRemoteData = () => Boolean(supabase);

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
  maintenance_mode: boolean;
  maintenance_message: string | null;
  maintenance_updated_by: string | null;
  maintenance_updated_at: string | null;
  backup_hour: number;
  updated_at: string;
};
type UserRow = SystemUser & { updated_at: string };
type BookingRow = {
  id: string;
  booker: string;
  time: string;
  purpose: string;
  remarks: string;
  created_at: string;
  created_by_user_id: string;
  updated_at: string;
};

const nowIso = () => new Date().toISOString();

export const fetchRemoteCandidates = async (): Promise<Candidate[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('portal_candidates').select('*');
  if (error || !data) {
    console.error('Remote candidates fetch error:', error);
    return [];
  }
  return (data as CandidateRow[]).map((row) => ({
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
};

export const syncRemoteCandidates = async (candidates: Candidate[]): Promise<void> => {
  if (!supabase) return;
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
  const { error } = await supabase.from('portal_candidates').upsert(rows, { onConflict: 'id' });
  if (error) console.error('Remote candidates upsert error:', error);
};

export const fetchRemoteSystemConfig = async (): Promise<SystemConfig | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.from('portal_system_config').select('*').eq('id', 'config').single();
  if (error || !data) {
    if (error) console.error('Remote system config fetch error:', error);
    return null;
  }
  const row = data as ConfigRow;
  return {
    systemName: row.system_name,
    logoIcon: row.logo_icon,
    maintenanceMode: row.maintenance_mode,
    maintenanceMessage: row.maintenance_message || undefined,
    maintenanceUpdatedBy: row.maintenance_updated_by || undefined,
    maintenanceUpdatedAt: row.maintenance_updated_at || undefined,
    backupHour: row.backup_hour ?? 15,
  };
};

export const syncRemoteSystemConfig = async (config: SystemConfig): Promise<void> => {
  if (!supabase) return;
  const row: ConfigRow = {
    id: 'config',
    system_name: config.systemName,
    logo_icon: config.logoIcon,
    maintenance_mode: config.maintenanceMode ?? false,
    maintenance_message: config.maintenanceMessage ?? null,
    maintenance_updated_by: config.maintenanceUpdatedBy ?? null,
    maintenance_updated_at: config.maintenanceUpdatedAt ?? null,
    backup_hour: config.backupHour ?? 15,
    updated_at: nowIso(),
  };
  const { error } = await supabase.from('portal_system_config').upsert(row, { onConflict: 'id' });
  if (error) console.error('Remote system config upsert error:', error);
};

export const syncRemoteUsers = async (users: SystemUser[]): Promise<void> => {
  if (!supabase) return;
  const rows = users.map((u) => ({ ...u, updated_at: nowIso() } as UserRow));
  const { error } = await supabase.from('portal_users').upsert(rows, { onConflict: 'id' });
  if (error) console.error('Remote users upsert error:', error);
};

export const fetchRemoteBookings = async (): Promise<BookingEntry[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('portal_bookings').select('*').order('created_at', { ascending: false });
  if (error || !data) {
    console.error('Remote bookings fetch error:', error);
    return [];
  }
  return (data as BookingRow[]).map((row) => ({
    id: row.id,
    booker: row.booker,
    time: row.time,
    purpose: row.purpose,
    remarks: row.remarks,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
  }));
};

export const syncRemoteBookings = async (bookings: BookingEntry[]): Promise<void> => {
  if (!supabase) return;
  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    booker: b.booker,
    time: b.time,
    purpose: b.purpose,
    remarks: b.remarks,
    created_at: b.createdAt,
    created_by_user_id: b.createdByUserId,
    updated_at: nowIso(),
  }));
  const { error } = await supabase.from('portal_bookings').upsert(rows, { onConflict: 'id' });
  if (error) console.error('Remote bookings upsert error:', error);
};
