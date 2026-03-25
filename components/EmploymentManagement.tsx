import React, { useMemo, useState } from 'react';
import { SystemUser, UserRole } from '../types';

interface EmploymentManagementProps {
  users: SystemUser[];
  currentUser: SystemUser;
  onUpdateUsers: (updated: SystemUser[]) => void;
}

const EmploymentManagement: React.FC<EmploymentManagementProps> = ({ users, currentUser, onUpdateUsers }) => {
  const isSuperAdminViewer = currentUser.role === UserRole.SUPER_ADMIN;
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(() => users[0]?.id || currentUser.id);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({
    department: '',
    jobTitle: '',
    phone: '',
    status: 'ACTIVE' as SystemUser['status'],
    baseSalary: '',
    allowancesTotal: '',
    deductionsTotal: '',
    performanceScore: '',
  });

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
  const canEditTarget = isSuperAdminViewer || selectedUser.role !== UserRole.SUPER_ADMIN;

  React.useEffect(() => {
    setIsEditing(false);
    setDraft({
      department: selectedUser.department || '',
      jobTitle: selectedUser.jobTitle || '',
      phone: selectedUser.phone || '',
      status: selectedUser.status,
      baseSalary: typeof selectedUser.baseSalary === 'number' ? String(selectedUser.baseSalary) : '',
      allowancesTotal: typeof selectedUser.allowancesTotal === 'number' ? String(selectedUser.allowancesTotal) : '',
      deductionsTotal: typeof selectedUser.deductionsTotal === 'number' ? String(selectedUser.deductionsTotal) : '',
      performanceScore: typeof selectedUser.performanceScore === 'number' ? String(selectedUser.performanceScore) : '',
    });
  }, [selectedUser.id]);

  const toMoney = (n?: number) =>
    typeof n === 'number' ? `TZS ${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}` : '-';

  const saveEdits = () => {
    if (!canEditTarget) return;
    const nextUsers = users.map((u) => {
      if (u.id !== selectedUser.id) return u;
      const baseSalary = draft.baseSalary.trim() ? Number(draft.baseSalary) : undefined;
      const allowancesTotal = draft.allowancesTotal.trim() ? Number(draft.allowancesTotal) : undefined;
      const deductionsTotal = draft.deductionsTotal.trim() ? Number(draft.deductionsTotal) : undefined;
      const performanceScore = draft.performanceScore.trim() ? Number(draft.performanceScore) : undefined;
      return {
        ...u,
        department: draft.department.trim() || u.department,
        jobTitle: draft.jobTitle.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        status: draft.status,
        baseSalary: Number.isFinite(baseSalary as any) ? baseSalary : u.baseSalary,
        allowancesTotal: Number.isFinite(allowancesTotal as any) ? allowancesTotal : u.allowancesTotal,
        deductionsTotal: Number.isFinite(deductionsTotal as any) ? deductionsTotal : u.deductionsTotal,
        performanceScore: Number.isFinite(performanceScore as any) ? performanceScore : u.performanceScore,
      };
    });
    onUpdateUsers(nextUsers);
    setIsEditing(false);
    alert('Employee profile updated.');
  };

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

          <div className="mt-4 flex flex-wrap items-center gap-2 justify-end">
            <button
              disabled={!canEditTarget}
              onClick={() => setIsEditing((v) => !v)}
              className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow disabled:opacity-60"
            >
              {isEditing ? 'Close Edit' : 'Edit Employee'}
            </button>
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

          {isEditing && (
            <div className="mt-6 rounded-3xl border border-slate-200 dark:border-blue-400/20 bg-white/60 dark:bg-slate-950/30 p-5">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Edit Details</h4>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={draft.department}
                  onChange={(e) => setDraft((p) => ({ ...p, department: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Department"
                />
                <input
                  value={draft.jobTitle}
                  onChange={(e) => setDraft((p) => ({ ...p, jobTitle: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Job title"
                />
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Phone"
                />
                <select
                  value={draft.status}
                  onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value as any }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="BANNED">BANNED</option>
                </select>
                <input
                  type="number"
                  value={draft.baseSalary}
                  onChange={(e) => setDraft((p) => ({ ...p, baseSalary: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Base salary (TZS)"
                />
                <input
                  type="number"
                  value={draft.allowancesTotal}
                  onChange={(e) => setDraft((p) => ({ ...p, allowancesTotal: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Allowances total"
                />
                <input
                  type="number"
                  value={draft.deductionsTotal}
                  onChange={(e) => setDraft((p) => ({ ...p, deductionsTotal: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Deductions total"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.performanceScore}
                  onChange={(e) => setDraft((p) => ({ ...p, performanceScore: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/70 dark:bg-slate-950/40 text-slate-900 dark:text-white font-semibold outline-none"
                  placeholder="Performance score (0-100)"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-blue-400/20 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  disabled={!canEditTarget}
                  onClick={saveEdits}
                  className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow disabled:opacity-60"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmploymentManagement;
