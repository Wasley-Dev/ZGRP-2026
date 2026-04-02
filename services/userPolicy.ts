import { type SystemUser } from '../types';

const FORBIDDEN_EMAILS = new Set(['s.miller@zayagroupltd.com', 'j.wilson@zayagroupltd.com']);
const FORBIDDEN_NAMES = new Set(['sarah miller', 'james wilson']);

const normalizeName = (value: string) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizeEmail = (value: string) => String(value || '').trim().toLowerCase();

export const isForbiddenUser = (user: Pick<SystemUser, 'name' | 'email'>): boolean => {
  const email = normalizeEmail(user.email);
  const name = normalizeName(user.name);
  return FORBIDDEN_EMAILS.has(email) || FORBIDDEN_NAMES.has(name);
};

export const filterForbiddenUsers = (users: SystemUser[]): SystemUser[] =>
  users.filter((u) => !isForbiddenUser({ name: u.name, email: u.email }));

export const assertAllowedUser = (user: Pick<SystemUser, 'name' | 'email'>) => {
  if (isForbiddenUser(user)) {
    throw new Error('This account is permanently blocked and cannot be created or restored.');
  }
};

