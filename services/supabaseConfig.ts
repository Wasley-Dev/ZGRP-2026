export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

const LS_URL = 'zaya_supabase_url_v1';
const LS_KEY = 'zaya_supabase_anon_key_v1';

// Production fallback so Vercel + desktop builds still sync even when env vars are not configured.
// This is the public Supabase "anon" key (not a secret), required for cross-device realtime sync.
const DEFAULT_SUPABASE_URL = 'https://qqhvqljyujfjgxwuqtii.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_53cO292WgCrpUyOKctmBLA_WyHC_EDa';

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
  const allowLocalOverride = (() => {
    try {
      return String((import.meta as any)?.env?.VITE_SUPABASE_ALLOW_LOCAL_OVERRIDE || '').trim() === '1';
    } catch {
      return false;
    }
  })();

  // Prefer build-time env (Vercel/desktop) + hard defaults so all clients point to the same Supabase.
  // LocalStorage overrides are disabled by default to prevent machines sticking to old/stale Supabase projects.
  const url = readEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL || (allowLocalOverride ? readLocal(LS_URL) : '');
  const anonKey =
    readEnv('VITE_SUPABASE_ANON_KEY') ||
    DEFAULT_SUPABASE_ANON_KEY ||
    (allowLocalOverride ? readLocal(LS_KEY) : '');
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
