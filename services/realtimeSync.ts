import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { BookingEntry, Candidate, Notification, SystemConfig, SystemUser } from '../types';

const STORAGE_KEY = 'zaya_shared_state_v2';
const CHANNEL_NAME = (import.meta.env.VITE_SYNC_CHANNEL || 'zaya-portal-sync') as string;
const EVENT_NAME = 'state-update';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export interface SharedStateSnapshot {
  bookings: BookingEntry[];
  candidates: Candidate[];
  users: SystemUser[];
  notifications: Notification[];
  systemConfig: SystemConfig;
  updatedAt: number;
  updatedBy: string;
}

interface SyncClientOptions {
  clientId: string;
  onSnapshot: (snapshot: SharedStateSnapshot) => void;
}

const isSnapshot = (value: unknown): value is SharedStateSnapshot => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.bookings) &&
    Array.isArray(v.candidates) &&
    Array.isArray(v.users) &&
    Array.isArray(v.notifications) &&
    !!v.systemConfig &&
    typeof v.updatedAt === 'number'
  );
};

const parseSnapshot = (raw: string | null): SharedStateSnapshot | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const loadSharedState = (fallback: Omit<SharedStateSnapshot, 'updatedAt' | 'updatedBy'>): SharedStateSnapshot => {
  if (typeof window === 'undefined') {
    return { ...fallback, updatedAt: Date.now(), updatedBy: 'bootstrap' };
  }
  const existing = parseSnapshot(window.localStorage.getItem(STORAGE_KEY));
  if (existing) return existing;
  const initial = { ...fallback, updatedAt: Date.now(), updatedBy: 'bootstrap' };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

export const createSharedSnapshot = (
  payload: Omit<SharedStateSnapshot, 'updatedAt' | 'updatedBy'>,
  updatedBy: string
): SharedStateSnapshot => ({
  ...payload,
  updatedAt: Date.now(),
  updatedBy,
});

export class RealtimeSyncClient {
  private readonly clientId: string;
  private readonly onSnapshot: (snapshot: SharedStateSnapshot) => void;
  private readonly channelName: string;
  private broadcastChannel: BroadcastChannel | null = null;
  private supabase: SupabaseClient | null = null;
  private supabaseChannel: RealtimeChannel | null = null;
  private lastSeenUpdate = 0;
  private unsubscribeStorage: (() => void) | null = null;

  constructor(options: SyncClientOptions) {
    this.clientId = options.clientId;
    this.onSnapshot = options.onSnapshot;
    this.channelName = CHANNEL_NAME;
  }

  start() {
    if (typeof window === 'undefined') return;

    const current = parseSnapshot(window.localStorage.getItem(STORAGE_KEY));
    if (current) this.lastSeenUpdate = current.updatedAt;

    this.broadcastChannel = new BroadcastChannel(this.channelName);
    this.broadcastChannel.onmessage = (event) => this.applyIncoming(event.data);

    const storageHandler = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = parseSnapshot(event.newValue);
      if (next) this.applyIncoming(next);
    };
    window.addEventListener('storage', storageHandler);
    this.unsubscribeStorage = () => window.removeEventListener('storage', storageHandler);

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      this.supabaseChannel = this.supabase
        .channel(this.channelName, {
          config: {
            broadcast: { self: false },
          },
        })
        .on('broadcast', { event: EVENT_NAME }, ({ payload }) => {
          this.applyIncoming(payload);
        });
      this.supabaseChannel.subscribe();
    }
  }

  stop() {
    this.unsubscribeStorage?.();
    this.unsubscribeStorage = null;

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    if (this.supabase && this.supabaseChannel) {
      this.supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
      this.supabase = null;
    }
  }

  publish(snapshot: SharedStateSnapshot) {
    if (typeof window === 'undefined') return;
    this.lastSeenUpdate = Math.max(this.lastSeenUpdate, snapshot.updatedAt);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    this.broadcastChannel?.postMessage(snapshot);
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: EVENT_NAME,
        payload: snapshot,
      });
    }
  }

  private applyIncoming(candidate: unknown) {
    if (!isSnapshot(candidate)) return;
    if (candidate.updatedBy === this.clientId) return;
    if (candidate.updatedAt <= this.lastSeenUpdate) return;

    this.lastSeenUpdate = candidate.updatedAt;
    this.onSnapshot(candidate);
  }
}
