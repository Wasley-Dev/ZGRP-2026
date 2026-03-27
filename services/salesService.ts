import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type Invoice, type Lead, type SalesTarget, type SystemUser } from '../types';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const hasSalesSupabase = () => Boolean(supabase);

const nowIso = () => new Date().toISOString();

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
  name: String(row.name || ''),
  company: row.company ? String(row.company) : undefined,
  phone: row.phone ? String(row.phone) : undefined,
  email: row.email ? String(row.email) : undefined,
  status: String(row.status || 'new') as any,
  estimatedValue: row.estimated_value != null ? Number(row.estimated_value) : undefined,
  notes: row.notes ? String(row.notes) : undefined,
  followUpAt: row.follow_up_at ? String(row.follow_up_at) : undefined,
  followUpNotes: row.follow_up_notes ? String(row.follow_up_notes) : undefined,
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
  if (!supabase) return canViewAll ? local : local.filter((l) => l.userId === user.id);

  const q = supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(300);
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
  input: Omit<Lead, 'id' | 'userId' | 'createdAt'>
): Promise<Lead> => {
  const local: Lead = { id: `local-${Date.now()}`, userId: targetUserId, createdAt: nowIso(), ...input };
  const current = readLocalArray<Lead>('leads', []);
  writeLocalArray('leads', [local, ...current].slice(0, 500));
  if (!supabase) return local;

  const payload = {
    user_id: targetUserId,
    name: input.name,
    company: input.company || null,
    phone: input.phone || null,
    email: input.email || null,
    status: input.status,
    estimated_value: input.estimatedValue ?? null,
    notes: input.notes || null,
    follow_up_at: input.followUpAt || null,
    follow_up_notes: input.followUpNotes || null,
    created_at: nowIso(),
  };
  const { data, error } = await supabase.from('leads').insert(payload).select('*').single();
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
  if (!supabase) return;
  const { error } = await supabase.from('leads').update({ status }).eq('id', leadId);
  if (error && !isSchemaError(error)) throw new Error(msg(error) || 'Failed to update lead.');
};

export const updateLead = async (
  leadId: string,
  patch: Partial<Pick<Lead, 'name' | 'company' | 'phone' | 'email' | 'status' | 'estimatedValue' | 'notes' | 'followUpAt' | 'followUpNotes'>>
): Promise<void> => {
  const current = readLocalArray<Lead>('leads', []);
  writeLocalArray(
    'leads',
    current.map((l) => (l.id === leadId ? { ...l, ...patch } : l))
  );
  if (!supabase) return;
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
  const { error } = await supabase.from('leads').update(payload).eq('id', leadId);
  if (error && !isSchemaError(error)) throw new Error(msg(error) || 'Failed to update lead.');
};

export const fetchInvoices = async (user: SystemUser, canViewAll: boolean): Promise<Invoice[]> => {
  const local = readLocalArray<Invoice>('invoices', []);
  if (!supabase) return canViewAll ? local : local.filter((i) => i.userId === user.id);

  const q = supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(300);
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
  const local: Invoice = { id: `local-${Date.now()}`, userId: targetUserId, createdAt: nowIso(), ...input };
  const current = readLocalArray<Invoice>('invoices', []);
  writeLocalArray('invoices', [local, ...current].slice(0, 500));
  if (!supabase) return local;

  const payload = {
    user_id: targetUserId,
    invoice_no: input.invoiceNo,
    client: input.client,
    amount: input.amount,
    status: input.status,
    due_date: input.dueDate || null,
    created_at: nowIso(),
  };
  const { data, error } = await supabase.from('invoices').insert(payload).select('*').single();
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
  if (!supabase) return;
  const { error } = await supabase.from('invoices').update({ status }).eq('id', invoiceId);
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
  if (!supabase) return;
  const payload: any = {};
  if (patch.invoiceNo != null) payload.invoice_no = patch.invoiceNo;
  if (patch.client != null) payload.client = patch.client;
  if (patch.amount != null) payload.amount = patch.amount;
  if (patch.status != null) payload.status = patch.status;
  if (patch.dueDate !== undefined) payload.due_date = patch.dueDate || null;
  const { error } = await supabase.from('invoices').update(payload).eq('id', invoiceId);
  if (error && !isSchemaError(error)) throw new Error(msg(error) || 'Failed to update invoice.');
};

export const fetchSalesTargets = async (user: SystemUser, canViewAll: boolean): Promise<SalesTarget[]> => {
  const local = readLocalArray<SalesTarget>('targets', []);
  if (!supabase) return canViewAll ? local : local.filter((t) => t.userId === user.id);

  const q = supabase.from('sales_targets').select('*').order('created_at', { ascending: false }).limit(300);
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
  if (!supabase) return local;

  const payload = {
    user_id: targetUserId,
    month: input.month,
    year: input.year,
    leads_target: input.leadsTarget,
    revenue_target: input.revenueTarget,
    created_at: nowIso(),
  };
  const attempt = await supabase.from('sales_targets').upsert(payload as any, { onConflict: 'user_id,month,year' }).select('*').single();
  if (attempt.error || !attempt.data) {
    if (isSchemaError(attempt.error)) return local;
    throw new Error(msg(attempt.error) || 'Failed to save targets.');
  }
  const created = toTarget(attempt.data);
  writeLocalArray('targets', [created, ...next.filter((t) => t.id !== created.id)].slice(0, 500));
  return created;
};
