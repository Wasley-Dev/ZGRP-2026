import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
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
  base_salary?: number | null;
  performance_score?: number | null;
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
  baseSalary: typeof (row as any).base_salary === 'number' ? (row as any).base_salary : undefined,
  performanceScore: typeof (row as any).performance_score === 'number' ? (row as any).performance_score : undefined,
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
  base_salary: typeof user.baseSalary === 'number' ? user.baseSalary : null,
  performance_score: typeof user.performanceScore === 'number' ? user.performanceScore : null,
});

export const hasRemoteUserDirectory = () => Boolean(getSupabase());

export const fetchRemoteUsersWithStatus = async (): Promise<{ users: SystemUser[]; ok: boolean }> => {
  const client = getSupabase();
  if (!client) return { users: [], ok: false };
  const { data, error } = await client.from(TABLE_NAME).select('*').order('name');
  if (error || !data) {
    console.error('Remote user fetch error:', error);
    return { users: [], ok: false };
  }
  return { users: (data as PortalUserRow[]).map(toUser), ok: true };
};

export const fetchRemoteUsers = async (): Promise<SystemUser[]> => {
  const res = await fetchRemoteUsersWithStatus();
  return res.users;
};

export const syncRemoteUsers = async (users: SystemUser[]): Promise<void> => {
  const client = getSupabase();
  if (!client) return;

  const rows = users.map(toRow);
  const attempt = await client.from(TABLE_NAME).upsert(rows, { onConflict: 'id' });
  if (!attempt.error) return;

  // Backward compatibility: if the remote table doesn't have newer columns, retry without them.
  const message = String(attempt.error?.message || '');
  const missingJobTitle = /job_title/i.test(message);
  const missingBaseSalary = /base_salary/i.test(message);
  const missingPerformance = /performance_score/i.test(message);
  if (!missingJobTitle && !missingBaseSalary && !missingPerformance) {
    console.error('Remote user upsert error:', attempt.error);
    throw attempt.error;
  }

  const legacyRows = rows.map((row: any) => {
    const next = { ...row };
    if (missingJobTitle) delete next.job_title;
    if (missingBaseSalary) delete next.base_salary;
    if (missingPerformance) delete next.performance_score;
    return next;
  });
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

export const subscribeRemoteUsers = (onChange: () => void): { unsubscribe: () => void } => {
  const client = getSupabase();
  if (!client) return { unsubscribe: () => {} };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, 400);
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

export const subscribeRemoteUserChanges = (handlers: {
  onUpsert: (user: SystemUser) => void;
  onDelete?: (id: string) => void;
}): { unsubscribe: () => void } => {
  const client = getSupabase();
  if (!client) return { unsubscribe: () => {} };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const pendingUpserts = new Map<string, SystemUser>();
  const pendingDeletes = new Set<string>();

  const flush = () => {
    timer = null;
    // Deletes first so re-inserts in the same batch win if present.
    if (pendingDeletes.size) {
      const ids = Array.from(pendingDeletes);
      pendingDeletes.clear();
      ids.forEach((id) => handlers.onDelete?.(id));
    }
    if (pendingUpserts.size) {
      const users = Array.from(pendingUpserts.values());
      pendingUpserts.clear();
      users.forEach((u) => handlers.onUpsert(u));
    }
  };

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(flush, 250);
  };

  const channel: RealtimeChannel = client
    .channel(`${TABLE_NAME}-row-changes`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE_NAME }, (payload: any) => {
      try {
        const row = payload?.new;
        if (!row?.id) return;
        pendingUpserts.set(String(row.id), toUser(row as PortalUserRow));
        schedule();
      } catch {
        // ignore
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE_NAME }, (payload: any) => {
      try {
        const row = payload?.new;
        if (!row?.id) return;
        pendingUpserts.set(String(row.id), toUser(row as PortalUserRow));
        schedule();
      } catch {
        // ignore
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLE_NAME }, (payload: any) => {
      try {
        const id = payload?.old?.id;
        if (!id) return;
        pendingDeletes.add(String(id));
        schedule();
      } catch {
        // ignore
      }
    });

  channel.subscribe();

  return {
    unsubscribe: () => {
      if (timer) clearTimeout(timer);
      client.removeChannel(channel);
    },
  };
};

