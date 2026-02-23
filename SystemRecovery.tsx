
import React, { useState } from 'react';

const SystemRecovery: React.FC = () => {
  const [activeMode, setActiveMode] = useState<'Standard' | 'Safe' | 'Recovery'>('Standard');
  const [isSyncing, setIsSyncing] = useState(false);

  const toggleMode = (mode: any) => {
    if (confirm(`ALERT: Initiate ${mode} Mode deployment? This will force-refresh all active sessions for security.`)) {
      setActiveMode(mode);
    }
  };

  const handleBackup = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      alert("GLOBAL SNAPSHOT: Real-time database backup successfully mirrored to secure cloud vault.");
    }, 2500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-10 rounded-[3rem] border dark:border-slate-700 shadow-sm space-y-12">
           <div>
              <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Enterprise Resilience Dashboard</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">High-Availability Failover & State Restore</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'Standard', icon: 'fa-check-double', color: 'green', desc: 'Full Enterprise Ops' },
                { name: 'Safe', icon: 'fa-shield-alt', color: 'amber', desc: 'Read-only Protocol' },
                { name: 'Recovery', icon: 'fa-user-ninja', color: 'red', desc: 'Restricted Root Access' },
              ].map(mode => (
                <button 
                  key={mode.name}
                  onClick={() => toggleMode(mode.name)}
                  className={`p-8 rounded-[2rem] border-2 flex flex-col items-center gap-4 transition-all hover:scale-105 ${activeMode === mode.name ? `border-${mode.color === 'green' ? 'green-500' : mode.color === 'amber' ? 'amber-500' : 'red-500'} bg-${mode.color === 'green' ? 'green-50' : mode.color === 'amber' ? 'amber-50' : 'red-50'} dark:bg-${mode.color === 'green' ? 'green-900/10' : mode.color === 'amber' ? 'amber-900/10' : 'red-900/10'}` : 'border-slate-100 dark:border-slate-700 hover:border-gold'}`}
                >
                   <i className={`fas ${mode.icon} text-4xl ${activeMode === mode.name ? `text-${mode.color === 'green' ? 'green-500' : mode.color === 'amber' ? 'amber-500' : 'red-500'}` : 'text-slate-300'}`}></i>
                   <div className="text-center">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] dark:text-white">{mode.name} Mode</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{mode.desc}</p>
                   </div>
                </button>
              ))}
           </div>

           <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest dark:text-white flex items-center gap-3">
                 <i className="fas fa-history text-gold"></i> Restore Points
              </h3>
              <div className="space-y-4">
                 {[
                   { date: '2026-05-24', time: '11:45 PM', label: 'Automated Global Sync', size: '2.84 GB', type: 'System' },
                   { date: '2026-05-20', time: '09:00 AM', label: 'Manual Admin Snapshot', size: '2.12 GB', type: 'Manual' },
                   { date: '2026-05-13', time: '11:59 PM', label: 'Post-Update Recovery Point', size: '1.95 GB', type: 'Auto' },
                 ].map((s, i) => (
                   <div key={i} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700 group hover:border-gold transition-all">
                      <div className="flex items-center gap-5">
                         <div className="w-12 h-12 rounded-xl bg-enterprise-blue flex items-center justify-center text-gold shadow-lg"><i className="fas fa-hdd"></i></div>
                         <div>
                            <p className="text-sm font-black dark:text-white uppercase tracking-tight">{s.label}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">{s.date} • {s.time} • {s.type}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-6">
                         <span className="text-[10px] font-black text-slate-500">{s.size}</span>
                         <button onClick={() => alert("RESTORE INITIATED: Mirroring state...")} className="px-4 py-2 bg-gold/10 text-gold hover:bg-gold hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">Restore</button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] border dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center space-y-8">
           <div className="relative">
              <div className={`w-40 h-40 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center border-4 border-slate-200 dark:border-slate-700 shadow-inner ${isSyncing ? 'animate-pulse' : ''}`}>
                 <i className={`fas fa-cloud-upload-alt text-5xl text-slate-300 ${isSyncing ? 'text-gold' : ''}`}></i>
              </div>
              {isSyncing && <div className="absolute inset-0 rounded-full border-4 border-gold border-t-transparent animate-spin"></div>}
           </div>
           
           <div>
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Auto-Backup Engine</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-3 leading-relaxed max-w-[200px] mx-auto">
                Real-time mirroring protocol active across 3 global nodes.
              </p>
           </div>

           <button 
             onClick={handleBackup}
             disabled={isSyncing}
             className="w-full py-5 bg-enterprise-blue text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-blue-900/30 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
           >
              {isSyncing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync"></i>}
              {isSyncing ? 'Mirroring State...' : 'Initiate Global Sync'}
           </button>

           <div className="w-full h-px bg-slate-100 dark:border-slate-700"></div>
           
           <div className="w-full space-y-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                 <span className="text-slate-400">Next Scheduled Sync</span>
                 <span className="text-gold">4h 12m</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                 <span className="text-slate-400">Sync Status</span>
                 <span className="text-green-500">HEALTHY</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SystemRecovery;
