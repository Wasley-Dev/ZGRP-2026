import React, { useState } from 'react';
import { SystemUser, UserRole, SystemConfig } from '../types';

interface AdminProps {
  users: SystemUser[];
  onUpdateUsers: (updated: SystemUser[]) => void;
  systemConfig: SystemConfig;
  setSystemConfig: (config: SystemConfig) => void;
}

const AdminConsole: React.FC<AdminProps> = ({ users, onUpdateUsers, systemConfig, setSystemConfig }) => {
  const [localSystemName, setLocalSystemName] = useState(systemConfig.systemName);
  const [localLogoIcon, setLocalLogoIcon] = useState(systemConfig.logoIcon);

  // NEW USER STATES
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteDepartment, setInviteDepartment] = useState('');

  /* ================= ROLE TOGGLE ================= */
  const handleRoleToggle = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (user.email === 'it@zayagroupltd.com') {
      alert("SECURITY ALERT: Super Admin privileges cannot be modified.");
      return;
    }

    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          role: u.role === UserRole.USER ? UserRole.ADMIN : UserRole.USER
        };
      }
      return u;
    });

    onUpdateUsers(updatedUsers);
  };

  /* ================= LOGO UPLOAD ================= */
  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setLocalLogoIcon(result);
      // Auto-apply for instant preview
      setSystemConfig({
        ...systemConfig,
        logoIcon: result
      });
    };
    reader.readAsDataURL(file);
  };

  /* ================= APPLY BRANDING ================= */
  const handleApplyBranding = () => {
    setSystemConfig({
      systemName: localSystemName,
      logoIcon: localLogoIcon
    });
    alert("GLOBAL SYNC: Enterprise branding updated system-wide.");
  };

  /* ================= INVITE USER ================= */
  const handleInviteUser = () => {
    if (!inviteName || !inviteEmail || !invitePassword) {
      alert("All invitation fields are required.");
      return;
    }

    const newUser: SystemUser = {
      id: Date.now().toString(),
      name: inviteName,
      email: inviteEmail,
      department: inviteDepartment || 'General',
      role: UserRole.USER,
      avatar: `https://ui-avatars.com/api/?name=${inviteName}`,
      password: invitePassword
    };

    onUpdateUsers([...users, newUser]);

    alert("Enterprise Access Granted: User invited successfully.");

    setInviteName('');
    setInviteEmail('');
    setInvitePassword('');
    setInviteDepartment('');
  };

  const logoOptions = ['fa-z', 'fa-crown', 'fa-building', 'fa-shield-alt', 'fa-globe', 'fa-rocket', 'fa-network-wired'];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ================= USER MANAGEMENT ================= */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border dark:border-slate-700 overflow-hidden">
          <div className="p-8 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
             <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">
               Privilege Protocol Center
             </h3>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
               Enterprise RBAC Sync
             </p>
          </div>

          <div className="p-8 space-y-4">

             {/* EXISTING USERS */}
             {users.map(u => (
               <div key={u.id} className="p-5 flex items-center gap-5 bg-slate-50 dark:bg-slate-900/50 border dark:border-slate-700 rounded-2xl hover:border-gold transition-all">
                  <img src={u.avatar} className="w-12 h-12 rounded-full border-2 border-gold shadow-md" alt="" />
                  <div className="flex-1">
                    <p className="text-sm font-black dark:text-white uppercase leading-tight">{u.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                      {u.role} • {u.department}
                    </p>
                  </div>

                  {u.email !== 'it@zayagroupltd.com' ? (
                    <button 
                      onClick={() => handleRoleToggle(u.id)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm transition-all ${
                        u.role === UserRole.USER
                        ? 'bg-gold/10 text-gold border border-gold/20 hover:bg-gold hover:text-white'
                        : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white'
                      }`}
                    >
                      {u.role === UserRole.USER ? 'Promote' : 'Demote'}
                    </button>
                  ) : (
                    <span className="px-4 py-2 bg-slate-800 text-gold rounded-xl text-[9px] font-black uppercase tracking-widest border border-gold/40">
                      Super Admin
                    </span>
                  )}
               </div>
             ))}

             {/* ================= INVITE SECTION ================= */}
             <div className="pt-8 mt-8 border-t dark:border-slate-700">
                <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  Invite Enterprise User
                </h4>

                <div className="space-y-4 mt-6">
                  <input
                    placeholder="Full Name"
                    value={inviteName}
                    onChange={e => setInviteName(e.target.value)}
                    className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                  />
                  <input
                    placeholder="Email Address"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                  />
                  <input
                    type="password"
                    placeholder="Temporary Password"
                    value={invitePassword}
                    onChange={e => setInvitePassword(e.target.value)}
                    className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                  />
                  <input
                    placeholder="Department"
                    value={inviteDepartment}
                    onChange={e => setInviteDepartment(e.target.value)}
                    className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                  />

                  <button 
                    onClick={handleInviteUser}
                    className="w-full py-4 bg-gold text-enterprise-blue rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-gold/20 active:scale-95 transition-all"
                  >
                    <i className="fas fa-user-plus mr-2"></i> Grant Access
                  </button>
                </div>
             </div>

          </div>
        </div>

        {/* ================= BRANDING CONTROL ================= */}
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

              {/* SYSTEM NAME */}
              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                   Enterprise System Name
                 </label>
                 <input 
                   className="w-full p-5 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none focus:ring-4 focus:ring-gold/10"
                   value={localSystemName}
                   onChange={e => setLocalSystemName(e.target.value)}
                 />
              </div>

              {/* ICON SELECTION + UPLOAD */}
              <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                   Core Visual Identity (Icon)
                 </label>

                 <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                    {logoOptions.map(icon => (
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

                 {/* PREVIEW IF IMAGE */}
                 {localLogoIcon && localLogoIcon.startsWith('data:image') && (
                   <div className="mt-6">
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                       Custom Logo Preview
                     </p>
                     <img 
                       src={localLogoIcon} 
                       alt="Uploaded Logo" 
                       className="w-20 h-20 object-contain" 
                     />
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
