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

  const cardClass = 'bg-[#0f1a2e] border border-[#1e3a5f] rounded-xl';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full overflow-x-hidden">

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Active Machines', value: activeCount.toString(), icon: 'fa-desktop', color: 'text-green-400' },
          { label: 'Revoked Access', value: revokedCount.toString(), icon: 'fa-ban', color: 'text-red-400' },
          { label: 'Total Managed', value: sessions.length.toString(), icon: 'fa-shield-alt', color: 'text-blue-400' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`${cardClass} p-6 flex items-center justify-between`}
          >
            <div>
              <p className="text-[10px] text-blue-300/60 font-black uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-3xl font-black text-white">{stat.value}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#0a1628] border border-[#1e3a5f] flex items-center justify-center">
              <i className={`fas ${stat.icon} text-xl text-gold`}></i>
            </div>
          </div>
        ))}
      </div>

      {/* Sessions Table */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="p-6 border-b border-[#1e3a5f]">
          <h3 className="font-black text-blue-400 uppercase tracking-tight">
            Authorized Infrastructure
          </h3>
          <p className="text-xs text-blue-300/50 font-bold uppercase tracking-widest mt-1">
            Live machine sessions with user name and IP
          </p>
        </div>

        {/* Mobile cards view (shown on small screens) */}
        <div className="block md:hidden divide-y divide-[#1e3a5f]">
          {sessions.length === 0 ? (
            <div className="p-6 text-blue-300/50 text-sm">
              No remote session data yet. Sign in with internet enabled to register machine presence.
            </div>
          ) : (
            sessions.map((machine) => (
              <div key={machine.id} className="p-4 space-y-3">
                {/* Name + machine name + tooltip */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-white uppercase text-xs">{machine.userName}</p>
                    <p className="text-[10px] font-mono text-blue-300/50">{machine.email}</p>
                    {/* Machine name with force logout tooltip */}
                    <div className="relative inline-block group mt-1">
                      <p className={`text-xs font-bold uppercase cursor-default ${
                        (machine as any).forceLogoutReason ? 'text-yellow-400 underline decoration-dotted' : 'text-blue-300'
                      }`}>
                        {machine.machineName}
                        {(machine as any).forceLogoutReason && (
                          <i className="fas fa-exclamation-circle ml-1 text-yellow-400 text-[10px]"></i>
                        )}
                      </p>
                      {(machine as any).forceLogoutReason && (
                        <div className="absolute bottom-full left-0 mb-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 pointer-events-none">
                          <div className="bg-yellow-400 text-black text-[10px] font-black rounded-lg px-3 py-2 whitespace-nowrap shadow-xl max-w-[240px] whitespace-normal">
                            <p className="font-black uppercase tracking-widest text-[9px] mb-0.5">⚠ Force Logout Reason</p>
                            <p className="font-medium">{(machine as any).forceLogoutReason}</p>
                          </div>
                          <div className="w-2 h-2 bg-yellow-400 rotate-45 ml-3 -mt-1"></div>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${
                    machine.status === 'ACTIVE'
                      ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                      : machine.status === 'REVOKED'
                      ? 'bg-red-900/40 text-red-400 border border-red-500/30'
                      : 'bg-amber-900/40 text-amber-400 border border-amber-500/30'
                  }`}>
                    {machine.status} {machine.isOnline ? '• Online' : '• Offline'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <p className="text-blue-300/40 uppercase font-black tracking-widest">OS</p>
                    <p className="text-blue-200 font-bold uppercase">{machine.os}</p>
                  </div>
                  <div>
                    <p className="text-blue-300/40 uppercase font-black tracking-widest">IP</p>
                    <p className="text-blue-200 font-mono">{machine.ip}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-blue-300/40 uppercase font-black tracking-widest">Last Seen</p>
                    <p className="text-blue-200">{new Date(machine.lastSeenAt).toLocaleString('en-GB')}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={machine.id === currentSessionId}
                    onClick={() => onRevoke(machine.id)}
                    className="px-3 py-1.5 text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                  >
                    Revoke
                  </button>
                  <button
                    disabled={machine.id === currentSessionId}
                    onClick={() => onForceOut(machine.id)}
                    className="px-3 py-1.5 text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                  >
                    Force Out
                  </button>
                  <button
                    disabled={machine.id === currentSessionId || machine.status === 'REVOKED'}
                    onClick={() => onBan(machine.id)}
                    className="px-3 py-1.5 text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                  >
                    Ban
                  </button>
                  <button
                    disabled={machine.id === currentSessionId}
                    onClick={() => onDelete(machine.id)}
                    className="px-3 py-1.5 text-[9px] bg-[#0a1628] text-blue-300 border border-[#1e3a5f] rounded-lg hover:bg-blue-600 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table view (hidden on small screens) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0a1628] text-[10px] uppercase font-black text-blue-400 tracking-widest border-b border-[#1e3a5f]">
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
            <tbody className="divide-y divide-[#1e3a5f] text-sm">
              {sessions.map((machine) => (
                <tr
                  key={machine.id}
                  className="hover:bg-[#0a1628]/60 transition-colors"
                >
                  <td className="p-4">
                    <p className="font-black text-white uppercase text-xs">{machine.userName}</p>
                    <p className="text-[10px] font-mono text-blue-300/50">{machine.email}</p>
                  </td>

                  {/* Machine name cell with force logout tooltip */}
                  <td className="p-4">
                    <div className="relative inline-block group">
                      <p className={`font-bold text-xs uppercase cursor-default ${
                        (machine as any).forceLogoutReason
                          ? 'text-yellow-400 underline decoration-dotted'
                          : 'text-blue-200'
                      }`}>
                        {machine.machineName}
                        {(machine as any).forceLogoutReason && (
                          <i className="fas fa-exclamation-circle ml-1 text-yellow-400 text-[10px]"></i>
                        )}
                      </p>
                      {/* Tooltip bubble */}
                      {(machine as any).forceLogoutReason && (
                        <div className="absolute bottom-full left-0 mb-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 pointer-events-none">
                          <div className="bg-yellow-400 text-black text-[10px] font-black rounded-lg px-3 py-2 shadow-xl w-48">
                            <p className="font-black uppercase tracking-widest text-[9px] mb-1">⚠ Force Logout Reason</p>
                            <p className="font-medium leading-snug">{(machine as any).forceLogoutReason}</p>
                          </div>
                          <div className="w-2 h-2 bg-yellow-400 rotate-45 ml-3 -mt-1"></div>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="p-4 text-blue-200 font-bold text-xs uppercase">{machine.os}</td>
                  <td className="p-4 text-blue-200 font-mono text-xs">{machine.ip}</td>
                  <td className="p-4 text-blue-300/60 text-xs">
                    {new Date(machine.lastSeenAt).toLocaleString('en-GB')}
                  </td>

                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1 ${
                      machine.status === 'ACTIVE'
                        ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                        : machine.status === 'REVOKED'
                        ? 'bg-red-900/40 text-red-400 border border-red-500/30'
                        : 'bg-amber-900/40 text-amber-400 border border-amber-500/30'
                    }`}>
                      <span>{machine.status}</span>
                      <span>{machine.isOnline ? '(ONLINE)' : '(OFFLINE)'}</span>
                    </span>
                  </td>

                  <td className="p-4">
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button
                        disabled={machine.id === currentSessionId}
                        onClick={() => onRevoke(machine.id)}
                        className="px-3 py-1.5 text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                      >
                        Revoke Access
                      </button>
                      <button
                        disabled={machine.id === currentSessionId}
                        onClick={() => onForceOut(machine.id)}
                        className="px-3 py-1.5 text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                      >
                        Force Logout
                      </button>
                      <button
                        disabled={machine.id === currentSessionId || machine.status === 'REVOKED'}
                        onClick={() => onBan(machine.id)}
                        className="px-3 py-1.5 text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                      >
                        Ban Machine
                      </button>
                      <button
                        disabled={machine.id === currentSessionId}
                        onClick={() => onDelete(machine.id)}
                        className="px-3 py-1.5 text-[9px] bg-[#0a1628] text-blue-300 border border-[#1e3a5f] rounded-lg hover:bg-blue-600 hover:text-white font-black uppercase tracking-widest transition-all disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td className="p-6 text-blue-300/40 text-sm" colSpan={7}>
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