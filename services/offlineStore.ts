import Dexie, { Table } from 'dexie';
import { BookingEntry, Candidate, SystemConfig, SystemUser } from '../types';

type OfflineCandidate = Candidate & { updatedAt: number };
type OfflineUser = SystemUser & { updatedAt: number };
type OfflineConfig = SystemConfig & { id: string; updatedAt: number };
type OfflineBooking = BookingEntry & { updatedAt: number };
type OutboxItem = {
  id: string;
  type: 'candidates' | 'users' | 'systemConfig' | 'bookings';
  payload: string;
  updatedAt: number;
};

class OfflineDb extends Dexie {
  candidates!: Table<OfflineCandidate, string>;
  users!: Table<OfflineUser, string>;
  systemConfig!: Table<OfflineConfig, string>;
  bookings!: Table<OfflineBooking, string>;
  outbox!: Table<OutboxItem, string>;

  constructor() {
    super('zaya_offline');
    this.version(1).stores({
      candidates: 'id, updatedAt',
      users: 'id, updatedAt',
      systemConfig: 'id, updatedAt',
      bookings: 'id, updatedAt',
      outbox: 'id, updatedAt, type',
    });
  }
}

const db = new OfflineDb();

export const isOfflineStoreAvailable = () => typeof indexedDB !== 'undefined';

export const loadLocalSnapshot = async () => {
  if (!isOfflineStoreAvailable()) return null;

  const [bookings, candidates, users, config] = await Promise.all([
    db.bookings.toArray(),
    db.candidates.toArray(),
    db.users.toArray(),
    db.systemConfig.toArray(),
  ]);

  return {
    bookings: bookings.map(({ updatedAt, ...rest }) => rest),
    candidates: candidates.map(({ updatedAt, ...rest }) => rest),
    users: users.map(({ updatedAt, ...rest }) => rest),
    systemConfig: config[0] ? (({ id, updatedAt, ...rest }) => rest)(config[0]) : null,
  };
};

// Persist portal data for offline use.
// NOTE: user directory is persisted separately via `saveOfflineUsers()` to avoid double-writes.
export const saveLocalSnapshot = async (snapshot: {
  bookings: BookingEntry[];
  candidates: Candidate[];
  systemConfig: SystemConfig;
}) => {
  if (!isOfflineStoreAvailable()) return;
  const now = Date.now();

  await db.transaction('rw', db.bookings, db.candidates, db.systemConfig, async () => {
    await db.bookings.clear();
    await db.candidates.clear();
    await db.systemConfig.clear();

    await db.bookings.bulkPut(snapshot.bookings.map((b) => ({ ...b, updatedAt: now })));
    await db.candidates.bulkPut(snapshot.candidates.map((c) => ({ ...c, updatedAt: now })));
    await db.systemConfig.put({ id: 'config', ...snapshot.systemConfig, updatedAt: now });
  });
};

export const saveOfflineUsers = async (users: SystemUser[]) => {
  if (!isOfflineStoreAvailable()) return;
  const now = Date.now();
  await db.transaction('rw', db.users, async () => {
    await db.users.clear();
    await db.users.bulkPut(users.map((u) => ({ ...u, updatedAt: now })));
  });
};

export const queueOutbox = async (type: OutboxItem['type'], payload: unknown) => {
  if (!isOfflineStoreAvailable()) return;
  const now = Date.now();
  const entry: OutboxItem = {
    // Keep only the latest payload per type to avoid lag (and stale sync ordering).
    id: type,
    type,
    payload: JSON.stringify(payload),
    updatedAt: now,
  };
  await db.transaction('rw', db.outbox, async () => {
    await db.outbox.where('type').equals(type).delete();
    await db.outbox.put(entry);
  });
};

export const hasOutboxItems = async (): Promise<boolean> => {
  if (!isOfflineStoreAvailable()) return false;
  try {
    const count = await db.outbox.count();
    return count > 0;
  } catch {
    return false;
  }
};

export const flushOutbox = async (
  handler: (item: OutboxItem) => Promise<void>
): Promise<void> => {
  if (!isOfflineStoreAvailable()) return;
  const pending = await db.outbox.toArray();
  const latestByType = new Map<OutboxItem['type'], OutboxItem>();
  for (const item of pending) {
    const prev = latestByType.get(item.type);
    if (!prev || item.updatedAt > prev.updatedAt) latestByType.set(item.type, item);
  }
  const latest = Array.from(latestByType.values()).sort((a, b) => a.updatedAt - b.updatedAt);
  for (const item of latest) {
    try {
      await handler(item);
      await db.outbox.where('type').equals(item.type).delete();
    } catch {
      // Keep item for next retry
    }
  }
};

export const getOnlineState = () => typeof navigator !== 'undefined' && navigator.onLine;

export const purgeOfflinePortalDataExceptUsers = async (): Promise<void> => {
  if (!isOfflineStoreAvailable()) return;
  await db.transaction('rw', db.bookings, db.candidates, db.outbox, async () => {
    await db.bookings.clear();
    await db.candidates.clear();
    // Drop any pending portal sync payloads so they don't repopulate purged data.
    await db.outbox.where('type').anyOf(['bookings', 'candidates', 'systemConfig']).delete();
  });
};
