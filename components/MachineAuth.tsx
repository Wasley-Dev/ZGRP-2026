import React from 'react';
import { MachineSession } from '../types';

interface MachineAuthProps {
  sessions: MachineSession[];
  currentSessionId: string;
  onForceOut: (sessionId: string) => Promise<void>;
  onRevoke: (sessionId: string) => Promise<void>;
  onBan: (sessionId: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<void>;
}

const MachineAuth: React.FC<MachineAuthProps> = ({
  sessions,
  currentSessionId,
  onForceOut,
  onRevoke,
  onBan,
  onDelete,
}) => {
  const activeCount = sessions.filter((m) => m.status === 'ACTIVE' && m.isOnline).length;
  const revokedCount = sessions.filter((m) => m.status === 'REVOKED').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Active Machines', value: activeCount.toString(), icon: 'fa-desktop', color: 'green' },
          { label: 'Revoked Access', value: revokedCount.toString(), icon: 'fa-ban', color: 'red' },
          { label: 'Total Managed', value: sessions.length.toString(), icon: 'fa-shield-alt', color: 'blue' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-slate-800 p-6 rounded-xl border dark:border-slate-700 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-xs text-slate-500 font-black uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-3xl font-black text-slate-800 dark:text-white">{stat.value}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-gold shadow-inner">
              <i className={`fas ${stat.icon} text-xl`}></i>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b dark:border-slate-700">
          <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight">
            Authorized Infrastructure
          </h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            Live machine sessions with user name and IP
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-black text-slate-500 tracking-widest">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Machine</th>
                <th className="p-4">OS</th>
                <th className="p-4">IP Address</th>
                <th className="p-4">Last Seen</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Security Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700 text-sm">
              {sessions.map((machine) => (
                <tr key={machine.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="p-4">
                    <p className="font-black text-slate-800 dark:text-white uppercase text-xs">{machine.userName}</p>
                    <p className="text-[10px] font-mono text-slate-400">{machine.email}</p>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase">
                    {machine.machineName}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase">{machine.os}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-xs">{machine.ip}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400 text-xs">
                    {new Date(machine.lastSeenAt).toLocaleString('en-GB')}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        machine.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-600'
                          : machine.status === 'REVOKED'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {machine.status} {machine.isOnline ? '(ONLINE)' : '(OFFLINE)'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-center">
                      <button
                        disabled={machine.id === currentSessionId}
                        onClick={() => onRevoke(machine.id)}
                        className="px-3 py-1.5 text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                      >
                        Revoke Access
                      </button>
                      <button
                        disabled={machine.id === currentSessionId}
                        onClick={() => onForceOut(machine.id)}
                        className="px-3 py-1.5 text-[9px] bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded-lg hover:bg-amber-500 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                      >
                        Force Logout
                      </button>
                      <button
                        disabled={machine.id === currentSessionId || machine.status === 'REVOKED'}
                        onClick={() => onBan(machine.id)}
                        className="px-3 py-1.5 text-[9px] bg-purple-500/10 text-purple-600 border border-purple-500/30 rounded-lg hover:bg-purple-500 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                      >
                        Ban Machine
                      </button>
                      <button
                        disabled={machine.id === currentSessionId}
                        onClick={() => onDelete(machine.id)}
                        className="px-3 py-1.5 text-[9px] bg-slate-500/10 text-slate-600 border border-slate-500/30 rounded-lg hover:bg-slate-600 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td className="p-6 text-slate-400 text-sm" colSpan={7}>
                    No remote session data yet. Sign in with internet enabled to register machine presence.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MachineAuth;
