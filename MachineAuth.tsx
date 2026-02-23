
import React, { useState } from 'react';
import { MOCK_MACHINES } from '../constants';
import { AuthorizedMachine } from '../types';

const MachineAuth: React.FC = () => {
  const [machines, setMachines] = useState<AuthorizedMachine[]>(MOCK_MACHINES);

  const handleAction = (id: string, newStatus: AuthorizedMachine['status']) => {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
    alert(`Machine security status updated to: ${newStatus}`);
  };

  const handleEmergencyLogout = () => {
    if (confirm("URGENT: This will terminate ALL sessions enterprise-wide. Proceed?")) {
      setMachines(prev => prev.map(m => ({ ...m, status: 'OFFLINE' })));
      alert("GLOBAL LOGOUT EXECUTED.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Active Machines', value: machines.filter(m => m.status === 'ONLINE').length.toString(), icon: 'fa-desktop', color: 'green' },
          { label: 'Revoked Access', value: machines.filter(m => m.status === 'REVOKED').length.toString(), icon: 'fa-ban', color: 'red' },
          { label: 'Total Managed', value: machines.length.toString(), icon: 'fa-shield-alt', color: 'blue' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm flex items-center justify-between transition-transform hover:scale-[1.02]">
            <div>
              <p className="text-xs text-slate-500 font-black uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white">{stat.value}</h3>
            </div>
            <div className={`w-12 h-12 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center text-${stat.color}-500 shadow-inner`}>
              <i className={`fas ${stat.icon} text-xl`}></i>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b dark:border-slate-700 flex justify-between items-center">
          <div>
            <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">Authorized Infrastructure</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Global device control panel</p>
          </div>
          <button className="px-6 py-2.5 bg-enterprise-blue text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:brightness-110 transition-all">
            <i className="fas fa-plus mr-2 text-gold"></i> Authorize New Device
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-black text-slate-500 tracking-widest">
              <tr>
                <th className="p-4">Device ID & Name</th>
                <th className="p-4">OS</th>
                <th className="p-4">IP Address</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Security Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700 text-sm">
              {machines.map(machine => (
                <tr key={machine.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 border border-slate-200 dark:border-slate-600">
                        <i className={`fas ${machine.os.includes('Windows') ? 'fa-windows' : machine.os.includes('macOS') ? 'fa-apple' : 'fa-mobile-alt'}`}></i>
                      </div>
                      <div>
                        <p className="font-black text-slate-800 dark:text-white uppercase text-xs">{machine.name}</p>
                        <p className="text-[10px] font-mono text-slate-400 font-bold">{machine.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase">{machine.os}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-xs">{machine.ip}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      machine.status === 'ONLINE' ? 'bg-green-100 text-green-600' : 
                      machine.status === 'REVOKED' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {machine.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-center">
                      {machine.status !== 'REVOKED' && (
                        <button 
                          onClick={() => handleAction(machine.id, 'REVOKED')}
                          className="px-3 py-1.5 text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white font-black uppercase tracking-widest transition-all"
                        >
                          Revoke Access
                        </button>
                      )}
                      <button 
                        onClick={() => handleAction(machine.id, 'OFFLINE')}
                        className="px-3 py-1.5 text-[9px] bg-slate-500/10 text-slate-500 border border-slate-500/20 rounded-lg hover:bg-slate-500 hover:text-white font-black uppercase tracking-widest transition-all"
                      >
                        Force Logout
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-red-600/5 dark:bg-red-600/10 border border-red-600/20 p-8 rounded-3xl relative overflow-hidden group transition-all hover:bg-red-600/10">
        <div className="flex items-start gap-6 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-red-600/20 text-red-600 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform">
            <i className="fas fa-exclamation-triangle text-2xl"></i>
          </div>
          <div className="flex-1">
            <h4 className="font-black text-red-600 uppercase tracking-[0.2em] text-sm">Emergency Override Zone</h4>
            <p className="text-sm text-red-800/70 dark:text-red-400/70 mt-2 leading-relaxed font-medium">As a privileged administrator, you have authority over the entire enterprise session pool. Initiating emergency protocols will instantly decouple all authorized machines and force mandatory re-authentication.</p>
            <button 
              onClick={handleEmergencyLogout}
              className="mt-6 px-8 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-600/20 hover:brightness-110 transition-all active:scale-95"
            >
              Execute Emergency Global Protocol
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/5 rounded-full -mr-24 -mt-24 blur-3xl"></div>
      </div>
    </div>
  );
};

export default MachineAuth;
