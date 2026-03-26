export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

const LS_URL = 'zaya_supabase_url_v1';
const LS_KEY = 'zaya_supabase_anon_key_v1';

const readEnv = (key: string): string => {
  try {
    const v = (import.meta as any)?.env?.[key];
    return typeof v === 'string' ? v.trim() : '';
  } catch {
    return '';
  }
};

const readLocal = (key: string): string => {
  if (typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem(key) || '').trim();
  } catch {
    return '';
  }
};

export const getSupabaseConfig = (): SupabaseConfig | null => {
  const url = readEnv('VITE_SUPABASE_URL') || readLocal(LS_URL);
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY') || readLocal(LS_KEY);
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

export const hasSupabaseConfig = (): boolean => Boolean(getSupabaseConfig());

export const setSupabaseConfig = (config: SupabaseConfig) => {
  if (typeof window === 'undefined') return;
  const url = String(config.url || '').trim();
  const anonKey = String(config.anonKey || '').trim();
  window.localStorage.setItem(LS_URL, url);
  window.localStorage.setItem(LS_KEY, anonKey);
};

