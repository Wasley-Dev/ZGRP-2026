import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type Invoice, type Lead, type SalesTarget, type SystemUser } from '../types';
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

export const hasSalesSupabase = () => Boolean(getSupabase());

const nowIso = () => new Date().toISOString();

const uuid = (): string => {
  try {
    const anyCrypto = globalThis.crypto as any;
    if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  } catch {
    // ignore
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());

const SALES_LOCAL_PREFIX = 'zaya_local_sales_v1:';

const readLocalArray = <T>(key: string, fallback: T[] = []): T[] => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(`${SALES_LOCAL_PREFIX}${key}`);
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
    window.localStorage.setItem(`${SALES_LOCAL_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const msg = (err: unknown): string => {
  if (!err) return '';
  if (err instanceof Error) return err.message || '';
  const anyErr = err as any;
  return String(anyErr?.message || anyErr?.error || anyErr?.details || '');
};

const isSchemaError = (err: unknown): boolean => {
  const m = msg(err).toLowerCase();
  const code = String((err as any)?.code || '').toLowerCase();
  return (
    code.startsWith('pgrst') ||
    m.includes('schema cache') ||
    m.includes('could not find the table') ||
    m.includes('does not exist') ||
    m.includes('relation') ||
    m.includes('permission denied') ||
    m.includes('row level security')
  );
};

const toLead = (row: any): Lead => ({
  id: String(row.id),
  userId: String(row.user_id),
  createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : undefined,
  createdByName: row.created_by_name ? String(row.created_by_name) : undefined,
  name: String(row.name || ''),
  company: row.company ? String(row.company) : undefined,
  phone: row.phone ? String(row.phone) : undefined,
  email: row.email ? String(row.email) : undefined,
  status: String(row.status || 'new') as any,
  estimatedValue: row.estimated_value != null ? Number(row.estimated_value) : undefined,
  notes: row.notes ? String(row.notes) : undefined,
  followUpAt: row.follow_up_at ? String(row.follow_up_at) : undefined,
  followUpNotes: row.follow_up_notes ? String(row.follow_up_notes) : undefined,
  reminderSentAt: row.reminder_sent_at ? String(row.reminder_sent_at) : undefined,
  createdAt: String(row.created_at || ''),
});

const toInvoice = (row: any): Invoice => ({
  id: String(row.id),
  userId: String(row.user_id),
  invoiceNo: String(row.invoice_no || ''),
  client: String(row.client || ''),
  amount: Number(row.amount || 0),
  status: String(row.status || 'draft') as any,
  dueDate: row.due_date ? String(row.due_date) : undefined,
  createdAt: String(row.created_at || ''),
});

const toTarget = (row: any): SalesTarget => ({
  id: String(row.id),
  userId: String(row.user_id),
  month: Number(row.month || 1),
  year: Number(row.year || new Date().getFullYear()),
  leadsTarget: Number(row.leads_target || 0),
  revenueTarget: Number(row.revenue_target || 0),
  createdAt: String(row.created_at || ''),
});

export const fetchLeads = async (user: SystemUser, canViewAll: boolean): Promise<Lead[]> => {
  const local = readLocalArray<Lead>('leads', []);
  const client = getSupabase();
  if (!client) return canViewAll ? local : local.filter((l) => l.userId === user.id);

  const q = client.from('leads').select('*').order('created_at', { ascending: false }).limit(300);
  const { data, error } = canViewAll ? await q : await q.eq('user_id', user.id);
  if (error || !data) {
    if (isSchemaError(error)) return canViewAll ? local : local.filter((l) => l.userId === user.id);
    return canViewAll ? local : local.filter((l) => l.userId === user.id);
  }
  const mapped = (data as any[]).map(toLead);
  writeLocalArray('leads', mapped);
  return canViewAll ? mapped : mapped.filter((l) => l.userId === user.id);
};

export const createLead = async (
  actor: SystemUser,
  targetUserId: string,
  input: Omit<Lead, 'id' | 'userId' | 'createdAt' | 'createdByUserId' | 'createdByName'>
): Promise<Lead> => {
  const local: Lead = {
    id: uuid(),
    userId: targetUserId,
    createdByUserId: actor.id,
    createdByName: actor.name,
    createdAt: nowIso(),
    ...input,
  };
  const current = readLocalArray<Lead>('leads', []);
  writeLocalArray('leads', [local, ...current].slice(0, 500));
  const client = getSupabase();
  if (!client) return local;

  const payload: any = {
    id: local.id,
    user_id: targetUserId,
    created_by_user_id: actor.id,
    created_by_name: actor.name,
    name: input.name,
    company: input.company || null,
    phone: input.phone || null,
    email: input.email || null,
    status: input.status,
    estimated_value: input.estimatedValue ?? null,
    notes: input.notes || null,
    follow_up_at: input.followUpAt || null,
    follow_up_notes: input.followUpNotes || null,
    reminder_sent_at: input.reminderSentAt || null,
    created_at: nowIso(),
  };
  let { data, error } = await client.from('leads').insert(payload).select('*').single();
  if ((error || !data) && isSchemaError(error)) {
    // Backward compatibility: older schemas may lack follow-up and created-by columns.
    const message = String((error as any)?.message || '');
    const missingCreatedBy = /created_by_/i.test(message);
    const missingFollowUp = /follow_up_/i.test(message) || /reminder_sent_at/i.test(message);
    const retryPayload = { ...payload };
    if (missingCreatedBy) { delete retryPayload.created_by_user_id; delete retryPayload.created_by_name; }
    if (missingFollowUp) { delete retryPayload.follow_up_at; delete retryPayload.follow_up_notes; delete retryPayload.reminder_sent_at; }
    ({ data, error } = await client.from('leads').insert(retryPayload).select('*').single());
  }
  if (error || !data) {
    if (isSchemaError(error)) return local;
    throw new Error(msg(error) || 'Failed to create lead.');
  }
  const created = toLead(data);
  writeLocalArray('leads', [created, ...current].slice(0, 500));
  return created;
};

export const updateLeadStatus = async (leadId: string, status: Lead['status']): Promise<void> => {
  const current = readLocalArray<Lead>('leads', []);
  writeLocalArray('leads', current.map((l) => (l.id === leadId ? { ...l, status } : l)));
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('leads').update({ status }).eq('id', leadId);
  if (error && !isSchemaError(error)) throw new Error(msg(error) || 'Failed to update lead.');
};

export const updateLead = async (
  leadId: string,
  patch: Partial<Pick<Lead, 'name' | 'company' | 'phone' | 'email' | 'status' | 'estimatedValue' | 'notes' | 'followUpAt' | 'followUpNotes' | 'reminderSentAt'>>
): Promise<void> => {
  const current = readLocalArray<Lead>('leads', []);
  writeLocalArray(
    'leads',
    current.map((l) => (l.id === leadId ? { ...l, ...patch } : l))
  );
  const client = getSupabase();
  if (!client) return;
  const payload: any = {};
  if (patch.name != null) payload.name = patch.name;
  if (patch.company !== undefined) payload.company = patch.company || null;
  if (patch.phone !== undefined) payload.phone = patch.phone || null;
  if (patch.email !== undefined) payload.email = patch.email || null;
  if (patch.status != null) payload.status = patch.status;
  if (patch.estimatedValue !== undefined) payload.estimated_value = patch.estimatedValue ?? null;
  if (patch.notes !== undefined) payload.notes = patch.notes || null;
  if (patch.followUpAt !== undefined) payload.follow_up_at = patch.followUpAt || null;
  if (patch.followUpNotes !== undefined) payload.follow_up_notes = patch.followUpNotes || null;
  if (patch.reminderSentAt !== undefined) payload.reminder_sent_at = patch.reminderSentAt || null;
  const { error } = await client.from('leads').update(payload).eq('id', leadId);
  if (error && !isSchemaError(error)) throw new Error(msg(error) || 'Failed to update lead.');
};

export const fetchInvoices = async (user: SystemUser, canViewAll: boolean): Promise<Invoice[]> => {
  const local = readLocalArray<Invoice>('invoices', []);
  const client = getSupabase();
  if (!client) return canViewAll ? local : local.filter((i) => i.userId === user.id);

  const q = client.from('invoices').select('*').order('created_at', { ascending: false }).limit(300);
  const { data, error } = canViewAll ? await q : await q.eq('user_id', user.id);
  if (error || !data) {
    if (isSchemaError(error)) return canViewAll ? local : local.filter((i) => i.userId === user.id);
    return canViewAll ? local : local.filter((i) => i.userId === user.id);
  }
  const mapped = (data as any[]).map(toInvoice);
  writeLocalArray('invoices', mapped);
  return canViewAll ? mapped : mapped.filter((i) => i.userId === user.id);
};

export const createInvoice = async (
  actor: SystemUser,
  targetUserId: string,
  input: Omit<Invoice, 'id' | 'userId' | 'createdAt'>
): Promise<Invoice> => {
  const local: Invoice = { id: uuid(), userId: targetUserId, createdAt: nowIso(), ...input };
  const current = readLocalArray<Invoice>('invoices', []);
  writeLocalArray('invoices', [local, ...current].slice(0, 500));
  const client = getSupabase();
  if (!client) return local;

  const payload = {
    id: local.id,
    user_id: targetUserId,
    invoice_no: input.invoiceNo,
    client: input.client,
    amount: input.amount,
    status: input.status,
    due_date: input.dueDate || null,
    created_at: nowIso(),
  };
  const { data, error } = await client.from('invoices').insert(payload).select('*').single();
  if (error || !data) {
    if (isSchemaError(error)) return local;
    throw new Error(msg(error) || 'Failed to create invoice.');
  }
  const created = toInvoice(data);
  writeLocalArray('invoices', [created, ...current].slice(0, 500));
  return created;
};

export const updateInvoiceStatus = async (invoiceId: string, status: Invoice['status']): Promise<void> => {
  const current = readLocalArray<Invoice>('invoices', []);
  writeLocalArray('invoices', current.map((i) => (i.id === invoiceId ? { ...i, status } : i)));
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('invoices').update({ status }).eq('id', invoiceId);
  if (error && !isSchemaError(error)) throw new Error(msg(error) || 'Failed to update invoice.');
};

export const updateInvoice = async (
  invoiceId: string,
  patch: Partial<Pick<Invoice, 'invoiceNo' | 'client' | 'amount' | 'status' | 'dueDate'>>
): Promise<void> => {
  const current = readLocalArray<Invoice>('invoices', []);
  writeLocalArray(
    'invoices',
    current.map((i) => (i.id === invoiceId ? { ...i, ...patch } : i))
  );
  const client = getSupabase();
  if (!client) return;
  const payload: any = {};
  if (patch.invoiceNo != null) payload.invoice_no = patch.invoiceNo;
  if (patch.client != null) payload.client = patch.client;
  if (patch.amount != null) payload.amount = patch.amount;
  if (patch.status != null) payload.status = patch.status;
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate || null;
  const { error } = await client.from('invoices').update(payload).eq('id', invoiceId);
  if (error && !isSchemaError(error)) throw new Error(msg(error) || 'Failed to update invoice.');
};

export const fetchSalesTargets = async (user: SystemUser, canViewAll: boolean): Promise<SalesTarget[]> => {
  const local = readLocalArray<SalesTarget>('targets', []);
  const client = getSupabase();
  if (!client) return canViewAll ? local : local.filter((t) => t.userId === user.id);

  const q = client.from('sales_targets').select('*').order('created_at', { ascending: false }).limit(300);
  const { data, error } = canViewAll ? await q : await q.eq('user_id', user.id);
  if (error || !data) {
    if (isSchemaError(error)) return canViewAll ? local : local.filter((t) => t.userId === user.id);
    return canViewAll ? local : local.filter((t) => t.userId === user.id);
  }
  const mapped = (data as any[]).map(toTarget);
  writeLocalArray('targets', mapped);
  return canViewAll ? mapped : mapped.filter((t) => t.userId === user.id);
};

export const upsertSalesTarget = async (
  actor: SystemUser,
  targetUserId: string,
  input: { month: number; year: number; leadsTarget: number; revenueTarget: number }
): Promise<SalesTarget> => {
  const id = `local-target-${targetUserId}-${input.year}-${input.month}`;
  const local: SalesTarget = {
    id,
    userId: targetUserId,
    month: input.month,
    year: input.year,
    leadsTarget: input.leadsTarget,
    revenueTarget: input.revenueTarget,
    createdAt: nowIso(),
  };
  const current = readLocalArray<SalesTarget>('targets', []);
  const next = [local, ...current.filter((t) => !(t.userId === targetUserId && t.month === input.month && t.year === input.year))];
  writeLocalArray('targets', next.slice(0, 500));
  const client = getSupabase();
  if (!client) return local;

  const payload = {
    user_id: targetUserId,
    month: input.month,
    year: input.year,
    leads_target: input.leadsTarget,
    revenue_target: input.revenueTarget,
    created_at: nowIso(),
  };
  const attempt = await client.from('sales_targets').upsert(payload as any, { onConflict: 'user_id,month,year' }).select('*').single();
  if (attempt.error || !attempt.data) {
    if (isSchemaError(attempt.error)) return local;
    throw new Error(msg(attempt.error) || 'Failed to save targets.');
  }
  const created = toTarget(attempt.data);
  writeLocalArray('targets', [created, ...next.filter((t) => t.id !== created.id)].slice(0, 500));
  return created;
};

export const syncLocalSalesData = async (): Promise<void> => {
  const client = getSupabase();
  if (!client) return;

  const localLeads = readLocalArray<Lead>('leads', []);
  const leadRows = localLeads
    .filter((l) => isUuid(l.id) && l.userId && l.name)
    .map((l) => ({
      id: l.id,
      user_id: l.userId,
      created_by_user_id: l.createdByUserId || null,
      created_by_name: l.createdByName || null,
      name: l.name,
      company: l.company || null,
      phone: l.phone || null,
      email: l.email || null,
      status: l.status,
      estimated_value: l.estimatedValue ?? null,
      notes: l.notes || null,
      follow_up_at: l.followUpAt || null,
      follow_up_notes: l.followUpNotes || null,
      reminder_sent_at: l.reminderSentAt || null,
      created_at: l.createdAt || nowIso(),
    }));
  if (leadRows.length) {
    const attempt = await client.from('leads').upsert(leadRows as any, { onConflict: 'id' });
    if (attempt.error && isSchemaError(attempt.error)) {
      const message = String((attempt.error as any)?.message || '');
      const missingCreatedBy = /created_by_/i.test(message);
      const missingFollowUp = /follow_up_/i.test(message) || /reminder_sent_at/i.test(message);
      const legacy = leadRows.map((row: any) => {
        const next = { ...row };
        if (missingCreatedBy) { delete next.created_by_user_id; delete next.created_by_name; }
        if (missingFollowUp) { delete next.follow_up_at; delete next.follow_up_notes; delete next.reminder_sent_at; }
        return next;
      });
      await client.from('leads').upsert(legacy as any, { onConflict: 'id' });
    }
  }

  const localInvoices = readLocalArray<Invoice>('invoices', []);
  const invoiceRows = localInvoices
    .filter((i) => isUuid(i.id) && i.userId && i.invoiceNo && i.client)
    .map((i) => ({
      id: i.id,
      user_id: i.userId,
      invoice_no: i.invoiceNo,
      client: i.client,
      amount: i.amount,
      status: i.status,
      due_date: i.dueDate || null,
      created_at: i.createdAt || nowIso(),
    }));
  if (invoiceRows.length) {
    await client.from('invoices').upsert(invoiceRows as any, { onConflict: 'id' });
  }

  const localTargets = readLocalArray<SalesTarget>('targets', []);
  const targetRows = localTargets
    .filter((t) => t.userId && typeof t.month === 'number' && typeof t.year === 'number')
    .map((t) => ({
      user_id: t.userId,
      month: t.month,
      year: t.year,
      leads_target: t.leadsTarget,
      revenue_target: t.revenueTarget,
      created_at: t.createdAt || nowIso(),
    }));
  if (targetRows.length) {
    await client.from('sales_targets').upsert(targetRows as any, { onConflict: 'user_id,month,year' });
  }
};

export const purgeLocalSalesData = (): void => {
  if (typeof window === 'undefined') return;
  const keys = ['leads', 'invoices', 'targets'];
  keys.forEach((k) => {
    try {
      window.localStorage.removeItem(`${SALES_LOCAL_PREFIX}${k}`);
    } catch {
      // ignore
    }
  });
};
