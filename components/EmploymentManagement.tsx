import React, { useMemo, useState } from 'react';
import { SystemUser, UserRole } from '../types';

interface EmploymentManagementProps {
  users: SystemUser[];
  currentUser: SystemUser;
}

const EmploymentManagement: React.FC<EmploymentManagementProps> = ({ users, currentUser }) => {
  const isSuperAdminViewer = currentUser.role === UserRole.SUPER_ADMIN;
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(() => users[0]?.id || currentUser.id);

  const normalizedUsers = useMemo(
    () => users.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedUsers;
    return normalizedUsers.filter((u) => {
      const roleLabel = u.role;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (u.jobTitle || '').toLowerCase().includes(q) ||
        roleLabel.toLowerCase().includes(q)
      );
    });
  }, [normalizedUsers, query]);

  const selectedUser = useMemo(() => {
    const hit = users.find((u) => u.id === selectedId);
    return hit || users[0] || currentUser;
  }, [users, selectedId, currentUser]);

  const isProtectedTarget = selectedUser.role === UserRole.SUPER_ADMIN && !isSuperAdminViewer;
  const visibleRole = isProtectedTarget ? UserRole.USER : selectedUser.role;

  const toMoney = (n?: number) =>
    typeof n === 'number' ? `TZS ${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : '-';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="liquid-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Employment Management</h2>
            <p className="text-xs text-slate-500 dark:text-blue-300/60 mt-1">Employee directory and profile details (admin-only).</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gold">{users.length} employees</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="liquid-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Employees</h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{filteredUsers.length} shown</span>
          </div>
          <div className="mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full p-3 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
              placeholder="Search name, email, department, title…"
            />
          </div>
          <div className="mt-4 max-h-[520px] overflow-auto space-y-2 pr-1">
            {filteredUsers.map((u) => {
              const isSelected = u.id === selectedId;
              const maskedRole = !isSuperAdminViewer && u.role === UserRole.SUPER_ADMIN ? UserRole.USER : u.role;
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                    isSelected
                      ? 'border-gold bg-gold/10'
                      : 'border-slate-200 dark:border-blue-400/20 bg-white/50 dark:bg-slate-950/30 hover:border-gold'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">{u.name}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-300/60 truncate">
                        {u.jobTitle || maskedRole} • {u.department || '—'}
                      </p>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${u.status === 'ACTIVE' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {u.status}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredUsers.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300/70 dark:border-blue-400/20 p-8 text-center text-slate-500 dark:text-blue-300/60">
                No employees match this search.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 liquid-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-14 w-14 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 overflow-hidden">
                <img
                  src={selectedUser.avatar || '/apple-touch-icon.png'}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white truncate">{selectedUser.name}</h3>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gold">
                  {selectedUser.jobTitle || visibleRole}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Role</p>
              <p className="mt-1 text-xs font-black text-slate-900 dark:text-white">{visibleRole}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Department</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedUser.department || '-'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Job Title</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedUser.jobTitle || '-'}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Email</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white break-all">
                {isProtectedTarget ? 'Hidden' : selectedUser.email}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Phone</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{isProtectedTarget ? 'Hidden' : (selectedUser.phone || '-')}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Last Login</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString('en-GB') : '-'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Status</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedUser.status}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Base Salary</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{toMoney(selectedUser.baseSalary)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-blue-300/60">Performance Score</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {typeof selectedUser.performanceScore === 'number' ? `${Math.round(selectedUser.performanceScore)}/100` : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmploymentManagement;

