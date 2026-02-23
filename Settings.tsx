
import React, { useState, useRef } from 'react';
import { SystemUser } from '../types';

interface SettingsProps {
  theme: string;
  onThemeToggle: () => void;
  user: SystemUser;
  setUser: (u: SystemUser) => void;
}

const Settings: React.FC<SettingsProps> = ({ theme, onThemeToggle, user, setUser }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => setUser({ ...user, avatar: ev.target?.result as string });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const [newPassword, setNewPassword] = useState('');

  const handleSave = () => {
    if (newPassword) {
      setUser({ ...user, password: newPassword });
      setNewPassword('');
    }
    alert("SETTINGS SYNCED: Corporate profile updated.");
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[3rem] p-12 border dark:border-slate-700 shadow-sm space-y-12">
             <div>
                <h3 className="text-2xl font-black dark:text-white uppercase tracking-tight">Identity & Profiles</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Corporate identity management</p>
             </div>

             <div className="flex flex-col md:flex-row items-center md:items-start gap-12">
                <div className="relative group cursor-pointer overflow-hidden rounded-[2.5rem] border-4 border-gold shadow-2xl w-48 h-48">
                   <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                   <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                      <button onClick={() => setIsPreviewOpen(true)} className="px-4 py-2 bg-white text-enterprise-blue rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-gold hover:text-white transition-all">View Profile</button>
                      <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-white text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-enterprise-blue transition-all">Change Photo</button>
                   </div>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
                
                <div className="flex-1 w-full grid grid-cols-2 gap-8">
                   <div className="col-span-2 md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Display Identity</label>
                      <input className="w-full p-5 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold dark:text-white outline-none focus:ring-4 focus:ring-gold/10" value={user.name} onChange={e => setUser({...user, name: e.target.value})} />
                   </div>
                   <div className="col-span-2 md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Work Department</label>
                      <input className="w-full p-5 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold text-slate-400 uppercase text-xs" disabled value={user.department} />
                   </div>
                   <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">New Password (Optional)</label>
                      <input 
                        type="password" 
                        placeholder="Enter new password to change" 
                        className="w-full p-5 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold dark:text-white outline-none focus:ring-4 focus:ring-gold/10" 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                      />
                   </div>
                </div>
             </div>
             
             <button onClick={handleSave} className="px-12 py-5 bg-enterprise-blue text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-blue-900/30 active:scale-95 transition-all">
                Finalize Identity Changes
             </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[3rem] p-12 border dark:border-slate-700 shadow-sm space-y-10 flex flex-col items-center text-center">
             <div className="w-24 h-24 rounded-[2rem] bg-gold/10 text-gold flex items-center justify-center text-4xl shadow-inner border border-gold/20">
                <i className="fas fa-palette"></i>
             </div>
             <div>
                <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">UI Rendering</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Interface Appearance Sync</p>
             </div>
             <div className="w-full space-y-6">
                <button onClick={onThemeToggle} className="w-full p-5 rounded-2xl bg-enterprise-blue text-white flex items-center justify-between group overflow-hidden border-b-4 border-black/20 hover:brightness-110 transition-all">
                   <span className="font-black uppercase text-[10px] tracking-[0.2em]">Deploy {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
                   <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-gold text-lg group-hover:rotate-45 transition-transform`}></i>
                </button>
             </div>
             <div className="mt-auto pt-10 w-full text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] opacity-40">ZAYA GROUP PORTAL v4.2</div>
          </div>
       </div>

       {isPreviewOpen && (
         <div 
           className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-2xl"
           onClick={() => setIsPreviewOpen(false)}
         >
            <div className="relative group" onClick={e => e.stopPropagation()}>
               <button onClick={() => setIsPreviewOpen(false)} className="absolute -top-16 -right-16 text-white text-4xl hover:text-gold transition-colors">
                  <i className="fas fa-times"></i>
               </button>
               <img src={user.avatar} className="max-w-[85vw] max-h-[85vh] rounded-[3rem] border-8 border-gold shadow-[0_0_150px_rgba(212,175,55,0.4)] object-contain" alt="Identity Preview" />
            </div>
         </div>
       )}
    </div>
  );
};

export default Settings;
