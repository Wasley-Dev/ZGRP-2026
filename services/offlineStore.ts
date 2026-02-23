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

export const saveLocalSnapshot = async (snapshot: {
  bookings: BookingEntry[];
  candidates: Candidate[];
  users: SystemUser[];
  systemConfig: SystemConfig;
}) => {
  if (!isOfflineStoreAvailable()) return;
  const now = Date.now();

  await db.transaction('rw', db.bookings, db.candidates, db.users, db.systemConfig, async () => {
    await db.bookings.clear();
    await db.candidates.clear();
    await db.users.clear();
    await db.systemConfig.clear();

    await db.bookings.bulkPut(snapshot.bookings.map((b) => ({ ...b, updatedAt: now })));
    await db.candidates.bulkPut(snapshot.candidates.map((c) => ({ ...c, updatedAt: now })));
    await db.users.bulkPut(snapshot.users.map((u) => ({ ...u, updatedAt: now })));
    await db.systemConfig.put({ id: 'config', ...snapshot.systemConfig, updatedAt: now });
  });
};

export const queueOutbox = async (type: OutboxItem['type'], payload: unknown) => {
  if (!isOfflineStoreAvailable()) return;
  const entry: OutboxItem = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    payload: JSON.stringify(payload),
    updatedAt: Date.now(),
  };
  await db.outbox.put(entry);
};

export const flushOutbox = async (
  handler: (item: OutboxItem) => Promise<void>
): Promise<void> => {
  if (!isOfflineStoreAvailable()) return;
  const pending = await db.outbox.toArray();
  for (const item of pending) {
    try {
      await handler(item);
      await db.outbox.delete(item.id);
    } catch {
      // Keep item for next retry
    }
  }
};

export const getOnlineState = () => typeof navigator !== 'undefined' && navigator.onLine;
