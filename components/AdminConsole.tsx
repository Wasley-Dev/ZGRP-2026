import React, { useEffect, useState } from 'react';
import { SystemUser, UserRole, SystemConfig } from '../types';
import { ZAYA_LOGO_SRC } from '../brand';

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
  const [localLoginHeroImage, setLocalLoginHeroImage] = useState(systemConfig.loginHeroImage || '');
  const [localLoginHeroImages, setLocalLoginHeroImages] = useState<string[]>(systemConfig.loginHeroImages || []);
  const [localLoginShowcaseTitle, setLocalLoginShowcaseTitle] = useState(systemConfig.loginShowcaseTitle || '');
  const [localLoginShowcaseSummary, setLocalLoginShowcaseSummary] = useState(systemConfig.loginShowcaseSummary || '');
  const [localLoginQuote, setLocalLoginQuote] = useState(systemConfig.loginQuote || '');
  const [localLoginQuoteAuthor, setLocalLoginQuoteAuthor] = useState(systemConfig.loginQuoteAuthor || '');
  const [localLoginFactsText, setLocalLoginFactsText] = useState((systemConfig.loginFacts || []).join('\n'));

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteDepartment, setInviteDepartment] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.USER);
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  const isSuperAdmin = (user: SystemUser) =>
    user.role === UserRole.SUPER_ADMIN || user.email.toLowerCase() === SUPER_ADMIN_EMAIL;
  const canManageLoginExperience = isSuperAdmin(currentUser);

  const getDisplayUser = (user: SystemUser): SystemUser => {
    if (!isSuperAdmin(user)) return user;
    return {
      ...user,
      name: 'Anonymous User',
      role: UserRole.USER,
      avatar: ZAYA_LOGO_SRC,
      email: '',
      phone: undefined,
      department: 'General',
    };
  };

  useEffect(() => {
    setLocalSystemName(systemConfig.systemName);
    setLocalLogoIcon(systemConfig.logoIcon);
    setLocalLoginHeroImage(systemConfig.loginHeroImage || '');
    setLocalLoginHeroImages(systemConfig.loginHeroImages || []);
    setLocalLoginShowcaseTitle(systemConfig.loginShowcaseTitle || '');
    setLocalLoginShowcaseSummary(systemConfig.loginShowcaseSummary || '');
    setLocalLoginQuote(systemConfig.loginQuote || '');
    setLocalLoginQuoteAuthor(systemConfig.loginQuoteAuthor || '');
    setLocalLoginFactsText((systemConfig.loginFacts || []).join('\n'));
  }, [systemConfig]);

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
    };
    reader.readAsDataURL(file);
  };

  const handleLoginHeroUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const nextImage = reader.result as string;
        setLocalLoginHeroImages((prev) => {
          const next = [...prev, nextImage].slice(0, 12);
          if (index === 0) setLocalLoginHeroImage(next[0] || nextImage);
          return next;
        });
      };
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const handleRemoveHeroImage = (imageIndex: number) => {
    setLocalLoginHeroImages((prev) => {
      const next = prev.filter((_, index) => index !== imageIndex);
      setLocalLoginHeroImage(next[0] || '');
      return next;
    });
  };

  const getSanitizedFacts = () =>
    localLoginFactsText
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 5);

  const handleApplyBranding = () => {
    setSystemConfig({
      ...systemConfig,
      systemName: localSystemName,
      logoIcon: localLogoIcon,
      loginHeroImage: localLoginHeroImages[0] || localLoginHeroImage || undefined,
      loginHeroImages: localLoginHeroImages,
      loginShowcaseTitle: localLoginShowcaseTitle.trim() || undefined,
      loginShowcaseSummary: localLoginShowcaseSummary.trim() || undefined,
      loginQuote: localLoginQuote.trim() || undefined,
      loginQuoteAuthor: localLoginQuoteAuthor.trim() || undefined,
      loginFacts: getSanitizedFacts(),
    });
    alert('Global branding and login experience updated.');
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
    setShowAddUserModal(false);
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
              const display = getDisplayUser(u);
              const protectedAccount = isSuperAdmin(u);
              return (
                <div
                  key={u.id}
                  className="p-5 bg-slate-50 dark:bg-slate-900/50 border dark:border-slate-700 rounded-2xl space-y-4"
                >
                  <div className="flex items-center gap-5">
                    <img src={display.avatar || ZAYA_LOGO_SRC} className="w-12 h-12 rounded-full border-2 border-gold shadow-md object-cover" alt="" />
                    <div className="flex-1">
                      <p className="text-sm font-black dark:text-white uppercase leading-tight">{display.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                        {display.role} • {display.department} • {display.status}{protectedAccount ? ' • PROTECTED' : ''}
                      </p>
                      {!protectedAccount && (
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                          {u.email}
                        </p>
                      )}
                      {!protectedAccount && u.phone && (
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
                      disabled={locked}
                      onClick={() => sendCredentialSms(u)}
                      className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-emerald-300 text-emerald-600 disabled:opacity-40"
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
              <div className="flex items-center justify-between gap-4">
                <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">Add User Account</h4>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="px-4 py-3 bg-gold text-enterprise-blue rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
                >
                  Open Add User Form
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

            <div className="border-t dark:border-slate-700 pt-6 space-y-6">
              <div>
                <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  Login Showcase
                </h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Super Admin Controlled
                </p>
              </div>

              {!canManageLoginExperience && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                  Only the super admin can change login quotes, facts, and hero images.
                </div>
              )}

              <div className={`space-y-6 ${canManageLoginExperience ? '' : 'opacity-60 pointer-events-none'}`}>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Rotating Login Images
                  </label>
                  <label className="flex min-h-40 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-gold dark:border-slate-600 dark:bg-slate-950">
                    {localLoginHeroImages[0] ? (
                      <img src={localLoginHeroImages[0]} alt="Login hero preview" className="h-40 w-full rounded-2xl object-cover" />
                    ) : (
                      <div className="text-center">
                        <i className="fas fa-image text-2xl"></i>
                        <p className="mt-3 text-[10px] font-black uppercase tracking-widest">Upload login images</p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleLoginHeroUpload}
                    />
                  </label>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    One image is shown globally for 24 hours, then the next image appears automatically.
                  </p>
                  {localLoginHeroImages.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                      {localLoginHeroImages.map((image, index) => (
                        <div key={`${image.slice(0, 32)}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                          <img src={image} alt={`Login rotation ${index + 1}`} className="h-24 w-full rounded-xl object-cover" />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              Day {index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveHeroImage(index)}
                              className="text-[9px] font-black uppercase tracking-widest text-red-500"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Showcase Headline
                  </label>
                  <input
                    className="w-full p-5 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-4 focus:ring-gold/10"
                    value={localLoginShowcaseTitle}
                    onChange={(e) => setLocalLoginShowcaseTitle(e.target.value)}
                    placeholder="Corporate intelligence for teams that build with discipline."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Showcase Summary
                  </label>
                  <textarea
                    className="w-full min-h-28 p-5 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-4 focus:ring-gold/10"
                    value={localLoginShowcaseSummary}
                    onChange={(e) => setLocalLoginShowcaseSummary(e.target.value)}
                    placeholder="Short corporate message shown on the login image panel."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Wise Quote
                  </label>
                  <textarea
                    className="w-full min-h-24 p-5 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-4 focus:ring-gold/10"
                    value={localLoginQuote}
                    onChange={(e) => setLocalLoginQuote(e.target.value)}
                    placeholder="Well-built systems reduce noise so teams can focus on decisions that matter."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Quote Author
                  </label>
                  <input
                    className="w-full p-5 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-4 focus:ring-gold/10"
                    value={localLoginQuoteAuthor}
                    onChange={(e) => setLocalLoginQuoteAuthor(e.target.value)}
                    placeholder="ZAYA Development Desk"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Fun Facts About Corporate Matters
                  </label>
                  <textarea
                    className="w-full min-h-32 p-5 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-4 focus:ring-gold/10"
                    value={localLoginFactsText}
                    onChange={(e) => setLocalLoginFactsText(e.target.value)}
                    placeholder={'One fact per line\nGood governance reduces confusion during audits.\nClear release rules protect system stability.'}
                  />
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={handleApplyBranding}
                disabled={!canManageLoginExperience}
                className="w-full py-5 bg-gold text-enterprise-blue rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-gold/30 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-sync"></i> Deploy Global Identity
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAddUserModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowAddUserModal(false)}>
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border dark:border-slate-700 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <h3 className="text-lg font-black dark:text-white uppercase tracking-tight">New User Enrollment</h3>
              <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-red-500">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 bg-slate-50 dark:bg-slate-900/40">
              <button
                onClick={() => setShowAddUserModal(false)}
                className="px-5 py-3 rounded-xl border dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteUser}
                className="px-5 py-3 bg-gold text-enterprise-blue rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
              >
                Add User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConsole;
