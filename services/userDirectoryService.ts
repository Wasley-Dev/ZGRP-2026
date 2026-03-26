import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SystemUser } from '../types';
import { getSupabaseConfig } from './supabaseConfig';

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
  job_title?: string | null;
  avatar: string | null;
  last_login: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BANNED';
};

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

const toUser = (row: PortalUserRow): SystemUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone || undefined,
  password: row.password,
  hasCompletedOrientation: row.has_completed_orientation,
  role: row.role as SystemUser['role'],
  department: row.department,
  jobTitle: row.job_title || undefined,
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
  job_title: user.jobTitle || null,
  avatar: user.avatar || null,
  last_login: user.lastLogin,
  status: user.status,
});

export const hasRemoteUserDirectory = () => Boolean(getSupabase());

export const fetchRemoteUsers = async (): Promise<SystemUser[]> => {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from(TABLE_NAME).select('*').order('name');
  if (error || !data) {
    console.error('Remote user fetch error:', error);
    return [];
  }
  return (data as PortalUserRow[]).map(toUser);
};

export const syncRemoteUsers = async (users: SystemUser[]): Promise<void> => {
  const client = getSupabase();
  if (!client) return;

  const rows = users.map(toRow);
  const attempt = await client.from(TABLE_NAME).upsert(rows, { onConflict: 'id' });
  if (!attempt.error) return;

  // Backward compatibility: if the remote table doesn't have `job_title` yet, retry without it.
  const message = String(attempt.error?.message || '');
  if (!/job_title/i.test(message)) {
    console.error('Remote user upsert error:', attempt.error);
    throw attempt.error;
  }
  const legacyRows = rows.map(({ job_title, ...rest }) => rest);
  const retry = await client.from(TABLE_NAME).upsert(legacyRows as any, { onConflict: 'id' });
  if (retry.error) {
    console.error('Remote user upsert error (legacy retry):', retry.error);
    throw retry.error;
  }
};

export const removeRemoteUsers = async (ids: string[]): Promise<void> => {
  const client = getSupabase();
  if (!client || ids.length === 0) return;
  const { error } = await client.from(TABLE_NAME).delete().in('id', ids);
  if (error) {
    console.error('Remote user explicit delete error:', error);
  }
};

