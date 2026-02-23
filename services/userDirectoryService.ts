import { createClient } from '@supabase/supabase-js';
import { SystemUser } from '../types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const TABLE_NAME = 'portal_users';

type PortalUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password: string;
  has_completed_orientation: boolean;
  role: string;
  department: string;
  avatar: string | null;
  last_login: string;
  status: 'ACTIVE' | 'BANNED';
};

const hasConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = hasConfig ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!) : null;

const toUser = (row: PortalUserRow): SystemUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone || undefined,
  password: row.password,
  hasCompletedOrientation: row.has_completed_orientation,
  role: row.role as SystemUser['role'],
  department: row.department,
  avatar: row.avatar || undefined,
  lastLogin: row.last_login,
  status: row.status,
});

const toRow = (user: SystemUser): PortalUserRow => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone || null,
  password: user.password,
  has_completed_orientation: user.hasCompletedOrientation ?? false,
  role: user.role,
  department: user.department,
  avatar: user.avatar || null,
  last_login: user.lastLogin,
  status: user.status,
});

export const hasRemoteUserDirectory = () => hasConfig;

export const fetchRemoteUsers = async (): Promise<SystemUser[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from(TABLE_NAME).select('*').order('name');
  if (error || !data) {
    console.error('Remote user fetch error:', error);
    return [];
  }
  return (data as PortalUserRow[]).map(toUser);
};

export const syncRemoteUsers = async (users: SystemUser[]): Promise<void> => {
  if (!supabase) return;

  const rows = users.map(toRow);
  const { error: upsertError } = await supabase.from(TABLE_NAME).upsert(rows, { onConflict: 'id' });
  if (upsertError) {
    console.error('Remote user upsert error:', upsertError);
    return;
  }

  const { data: existing, error: existingError } = await supabase.from(TABLE_NAME).select('id');
  if (existingError || !existing) {
    if (existingError) console.error('Remote user ID fetch error:', existingError);
    return;
  }

  const localIds = new Set(users.map((u) => u.id));
  const toDelete = (existing as { id: string }[]).map((r) => r.id).filter((id) => !localIds.has(id));
  if (toDelete.length === 0) return;

  const { error: deleteError } = await supabase.from(TABLE_NAME).delete().in('id', toDelete);
  if (deleteError) {
    console.error('Remote user delete error:', deleteError);
  }
};

