import React, { useState } from 'react';
import { SystemUser, UserRole, SystemConfig } from '../types';

interface AdminProps {
  users: SystemUser[];
  currentUser: SystemUser;
  onUpdateUsers: (updated: SystemUser[]) => void;
  systemConfig: SystemConfig;
  setSystemConfig: (config: SystemConfig) => void;
}

const SUPER_ADMIN_EMAIL = 'it@zayagroupltd.com';

const AdminConsole: React.FC<AdminProps> = ({
  users,
  currentUser,
  onUpdateUsers,
  systemConfig,
  setSystemConfig,
}) => {
  const [localSystemName, setLocalSystemName] = useState(systemConfig.systemName);
  const [localLogoIcon, setLocalLogoIcon] = useState(systemConfig.logoIcon);

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteDepartment, setInviteDepartment] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.USER);
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});

  const isSuperAdmin = (user: SystemUser) =>
    user.role === UserRole.SUPER_ADMIN || user.email.toLowerCase() === SUPER_ADMIN_EMAIL;

  const handleRoleToggle = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (isSuperAdmin(user) || user.id === currentUser.id) {
      alert('Action blocked for protected account.');
      return;
    }

    const updatedUsers = users.map((u) => {
      if (u.id !== userId) return u;
      return {
        ...u,
        role: u.role === UserRole.USER ? UserRole.ADMIN : UserRole.USER,
      };
    });

    onUpdateUsers(updatedUsers);
  };

  const handleToggleBan = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (isSuperAdmin(user) || user.id === currentUser.id) {
      alert('Action blocked for protected account.');
      return;
    }

    const updatedUsers = users.map((u) =>
      u.id === userId ? { ...u, status: u.status === 'ACTIVE' ? 'BANNED' : 'ACTIVE' } : u
    );
    onUpdateUsers(updatedUsers);
  };

  const handleDeleteUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    if (isSuperAdmin(user) || user.id === currentUser.id) {
      alert('Action blocked for protected account.');
      return;
    }

    const confirmed = window.confirm(`Delete user ${user.name}? This cannot be undone.`);
    if (!confirmed) return;
    onUpdateUsers(users.filter((u) => u.id !== userId));
  };

  const handleResetPassword = (userId: string) => {
    const nextPassword = (resetPasswords[userId] || '').trim();
    if (!nextPassword) {
      alert('Enter a new password first.');
      return;
    }

    const updatedUsers = users.map((u) =>
      u.id === userId ? { ...u, password: nextPassword } : u
    );
    onUpdateUsers(updatedUsers);
    setResetPasswords((prev) => ({ ...prev, [userId]: '' }));
    alert('Password reset complete.');
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setLocalLogoIcon(result);
      setSystemConfig({
        ...systemConfig,
        logoIcon: result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleApplyBranding = () => {
    setSystemConfig({
      ...systemConfig,
      systemName: localSystemName,
      logoIcon: localLogoIcon,
    });
    alert('Global branding updated.');
  };

  const handleInviteUser = () => {
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    const normalizedPhone = invitePhone.trim();
    if (!inviteName.trim() || !normalizedEmail || !invitePassword.trim() || !normalizedPhone) {
      alert('Name, email, phone, and password are required.');
      return;
    }
    const exists = users.some((u) => u.email.toLowerCase() === normalizedEmail);
    if (exists) {
      alert('A user with this email already exists.');
      return;
    }

    const newUser: SystemUser = {
      id: `USR-${Date.now()}`,
      name: inviteName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: invitePassword.trim(),
      hasCompletedOrientation: false,
      department: inviteDepartment.trim() || 'General',
      role: inviteRole,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(inviteName.trim())}`,
      lastLogin: 'Never',
      status: 'ACTIVE',
    };

    onUpdateUsers([...users, newUser]);
    setInviteName('');
    setInviteEmail('');
    setInvitePhone('');
    setInvitePassword('');
    setInviteDepartment('');
    setInviteRole(UserRole.USER);
    alert('User added. Share credentials with the user to sign in.');
  };

  const sendCredentialSms = (targetUser: SystemUser) => {
    if (!targetUser.phone) {
      alert('No phone number saved for this user.');
      return;
    }
    const message =
      `ZAYA Portal Credentials\n` +
      `Email: ${targetUser.email}\n` +
      `Password: ${targetUser.password}\n` +
      `Login: https://zgrp-portal-2026.vercel.app`;
    const smsUrl = `sms:${targetUser.phone}?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_self');
  };

  const logoOptions = [
    'fa-z',
    'fa-crown',
    'fa-building',
    'fa-shield-alt',
    'fa-globe',
    'fa-rocket',
    'fa-network-wired',
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border dark:border-slate-700 overflow-hidden">
          <div className="p-8 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
            <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">
              Privilege Protocol Center
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              User Access Control
            </p>
          </div>

          <div className="p-8 space-y-4">
            {users.map((u) => {
              const locked = isSuperAdmin(u) || u.id === currentUser.id;
              return (
                <div
                  key={u.id}
                  className="p-5 bg-slate-50 dark:bg-slate-900/50 border dark:border-slate-700 rounded-2xl space-y-4"
                >
                  <div className="flex items-center gap-5">
                    <img src={u.avatar} className="w-12 h-12 rounded-full border-2 border-gold shadow-md" alt="" />
                    <div className="flex-1">
                      <p className="text-sm font-black dark:text-white uppercase leading-tight">{u.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {u.role} • {u.department} • {u.status}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {u.email}
                      </p>
                      {u.phone && (
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                          {u.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <button
                      disabled={locked}
                      onClick={() => handleRoleToggle(u.id)}
                      className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-gold/30 text-gold disabled:opacity-40"
                    >
                      {u.role === UserRole.USER ? 'Promote to Admin' : 'Demote to User'}
                    </button>
                    <button
                      disabled={locked}
                      onClick={() => handleToggleBan(u.id)}
                      className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-amber-300 text-amber-600 disabled:opacity-40"
                    >
                      {u.status === 'BANNED' ? 'Unban User' : 'Ban User'}
                    </button>
                    <button
                      disabled={locked}
                      onClick={() => handleDeleteUser(u.id)}
                      className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-300 text-red-600 disabled:opacity-40"
                    >
                      Delete User
                    </button>
                    <button
                      onClick={() => sendCredentialSms(u)}
                      className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-300 text-emerald-600"
                    >
                      Send Credentials SMS
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={resetPasswords[u.id] || ''}
                      onChange={(e) =>
                        setResetPasswords((prev) => ({
                          ...prev,
                          [u.id]: e.target.value,
                        }))
                      }
                      placeholder="New password"
                      className="flex-1 p-3 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold dark:text-white outline-none"
                    />
                    <button
                      onClick={() => handleResetPassword(u.id)}
                      className="px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest bg-enterprise-blue text-white"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="pt-8 mt-8 border-t dark:border-slate-700">
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">
                Add User Account
              </h4>

              <div className="space-y-4 mt-6">
                <input
                  placeholder="Full Name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                />
                <input
                  placeholder="Email Address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                />
                <input
                  placeholder="Phone Number (SMS)"
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                />
                <input
                  type="password"
                  placeholder="Initial Password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                />
                <input
                  placeholder="Department"
                  value={inviteDepartment}
                  onChange={(e) => setInviteDepartment(e.target.value)}
                  className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                >
                  <option value={UserRole.USER}>USER</option>
                  <option value={UserRole.ADMIN}>ADMIN</option>
                </select>

                <button
                  onClick={handleInviteUser}
                  className="w-full py-4 bg-gold text-enterprise-blue rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-gold/20 active:scale-95 transition-all"
                >
                  <i className="fas fa-user-plus mr-2"></i> Add User
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border dark:border-slate-700 p-8 flex flex-col space-y-8">
          <div>
            <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">
              System White-Labeling
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Global Identity Control
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                Enterprise System Name
              </label>
              <input
                className="w-full p-5 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-4 focus:ring-gold/10"
                value={localSystemName}
                onChange={(e) => setLocalSystemName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                Core Visual Identity (Icon)
              </label>

              <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                {logoOptions.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setLocalLogoIcon(icon)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${
                      localLogoIcon === icon
                        ? 'bg-gold text-enterprise-blue shadow-lg border-2 border-white'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-400 hover:border-gold border border-transparent'
                    }`}
                  >
                    <i className={`fas ${icon}`}></i>
                  </button>
                ))}

                <label className="w-12 h-12 rounded-xl flex items-center justify-center text-xl cursor-pointer bg-slate-100 dark:bg-slate-900 text-slate-400 hover:border-gold border border-transparent transition-all relative">
                  <i className="fas fa-upload"></i>
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleLogoUpload}
                  />
                </label>
              </div>

              {localLogoIcon && localLogoIcon.startsWith('data:image') && (
                <div className="mt-6">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    Custom Logo Preview
                  </p>
                  <img src={localLogoIcon} alt="Uploaded Logo" className="w-20 h-20 object-contain" />
                </div>
              )}
            </div>

            <div className="pt-6">
              <button
                onClick={handleApplyBranding}
                className="w-full py-5 bg-gold text-enterprise-blue rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-gold/30 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <i className="fas fa-sync"></i> Deploy Global Identity
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminConsole;
