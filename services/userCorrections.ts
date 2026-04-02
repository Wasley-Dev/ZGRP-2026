import { type SystemUser, UserRole } from '../types';

const normalizeText = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeEmail = (value: unknown) => normalizeText(value).toLowerCase();
const normalizeName = (value: unknown) => normalizeText(value).toLowerCase();

const applyPatch = (user: SystemUser, patch: Partial<SystemUser>) => {
  const next: SystemUser = { ...user };
  let changed = false;

  if (typeof patch.name === 'string' && patch.name !== user.name) {
    next.name = patch.name;
    changed = true;
  }
  if (typeof patch.role !== 'undefined' && patch.role !== user.role) {
    next.role = patch.role;
    changed = true;
  }
  if (typeof patch.jobTitle === 'string' && patch.jobTitle !== user.jobTitle) {
    next.jobTitle = patch.jobTitle;
    changed = true;
  }
  if (typeof patch.baseSalary === 'number' && patch.baseSalary !== user.baseSalary) {
    next.baseSalary = patch.baseSalary;
    changed = true;
  }
  if (typeof patch.phone === 'string' && patch.phone !== user.phone) {
    next.phone = patch.phone;
    changed = true;
  }

  return { user: next, changed };
};

const renameFirstName = (fullName: string, from: string, to: string): string => {
  const parts = normalizeText(fullName).split(' ');
  if (!parts.length) return fullName;
  if (parts[0].toLowerCase() !== from.toLowerCase()) return fullName;
  parts[0] = to;
  return parts.join(' ');
};

export const applyUserCorrections = (users: SystemUser[]): { users: SystemUser[]; changed: SystemUser[] } => {
  const changed: SystemUser[] = [];
  const updated = users.map((u) => {
    let current = u;
    let didChange = false;

    const email = normalizeEmail(u.email);
    const name = normalizeName(u.name);

    // Canonical salaries / titles
    if (email === 'it@zayagroupltd.com') {
      const res = applyPatch(current, {
        role: UserRole.SUPER_ADMIN,
        jobTitle: 'Head of Department',
        baseSalary: 500000,
        phone: '+255650787961',
      });
      current = res.user;
      didChange ||= res.changed;
    }
    if (email === 'zahra@zayagroupltd.com') {
      const res = applyPatch(current, { jobTitle: 'Receptionist', baseSalary: 300000 });
      current = res.user;
      didChange ||= res.changed;
    }
    if (email === 'fatma.mbarouk.khamis@zaya.local' || email === 'suhaib.abdallah.saleh@zaya.local') {
      const res = applyPatch(current, { jobTitle: 'Sales Executive', baseSalary: 200000 });
      current = res.user;
      didChange ||= res.changed;
    }

    // Abdulhamin → Abdulhamid (always rename if matched), plus job/salary if unset
    if (name.startsWith('abdulhamin')) {
      const renamed = renameFirstName(current.name, 'Abdulhamin', 'Abdulhamid');
      if (renamed !== current.name) {
        current = { ...current, name: renamed };
        didChange = true;
      }
      const res = applyPatch(current, { jobTitle: 'Gateman', baseSalary: 150000 });
      current = res.user;
      didChange ||= res.changed;
    }

    // Haulat job/salary if unset
    if (name.startsWith('haulat')) {
      const res = applyPatch(current, { jobTitle: 'Office Cleaner', baseSalary: 150000 });
      current = res.user;
      didChange ||= res.changed;
    }

    if (didChange) changed.push(current);
    return current;
  });

  return { users: updated, changed };
};
