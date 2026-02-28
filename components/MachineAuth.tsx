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
  const geoPinnedCount = sessions.filter(
    (m) => typeof m.latitude === 'number' && typeof m.longitude === 'number'
  ).length;

  const cardClass = 'bg-[#0f1a2e] border border-[#1e3a5f] rounded-xl';

  const getGeoText = (machine: MachineSession) =>
    machine.locationLabel ||
    (typeof machine.latitude === 'number' && typeof machine.longitude === 'number'
      ? `${machine.latitude.toFixed(6)}, ${machine.longitude.toFixed(6)}`
      : 'Location unavailable');

  const getGeoUrl = (machine: MachineSession) =>
    typeof machine.latitude === 'number' && typeof machine.longitude === 'number'
      ? `https://maps.google.com/?q=${machine.latitude},${machine.longitude}`
      : undefined;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full overflow-x-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Machines', value: activeCount.toString(), icon: 'fa-desktop' },
          { label: 'Revoked Access', value: revokedCount.toString(), icon: 'fa-ban' },
          { label: 'Geo Pinned', value: geoPinnedCount.toString(), icon: 'fa-location-dot' },
          { label: 'Total Managed', value: sessions.length.toString(), icon: 'fa-shield-alt' },
        ].map((stat) => (
          <div key={stat.label} className={`${cardClass} p-6 flex items-center justify-between`}>
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

      <div className={`${cardClass} overflow-hidden`}>
        <div className="p-6 border-b border-[#1e3a5f]">
          <h3 className="font-black text-blue-400 uppercase tracking-tight">Authorized Infrastructure</h3>
          <p className="text-xs text-blue-300/50 font-bold uppercase tracking-widest mt-1">
            Live machine sessions, forced logout reasons, and geo pin coordinates
          </p>
        </div>

        <div className="block md:hidden divide-y divide-[#1e3a5f]">
          {sessions.length === 0 ? (
            <div className="p-6 text-blue-300/50 text-sm">
              No remote session data yet. Sign in with internet enabled to register machine presence.
            </div>
          ) : (
            sessions.map((machine) => (
              <div key={machine.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-white uppercase text-xs">{machine.userName}</p>
                    <p className="text-[10px] font-mono text-blue-300/50">{machine.email}</p>
                    <p className="text-xs font-bold uppercase text-blue-300 mt-1">{machine.machineName}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${
                      machine.status === 'ACTIVE'
                        ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                        : machine.status === 'REVOKED'
                        ? 'bg-red-900/40 text-red-400 border border-red-500/30'
                        : 'bg-amber-900/40 text-amber-400 border border-amber-500/30'
                    }`}
                  >
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
                    <p className="text-blue-300/40 uppercase font-black tracking-widest">Geo Pin</p>
                    {getGeoUrl(machine) ? (
                      <a href={getGeoUrl(machine)} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-gold font-mono">
                        {getGeoText(machine)}
                      </a>
                    ) : (
                      <p className="text-blue-200">{getGeoText(machine)}</p>
                    )}
                  </div>
                  {!!machine.forceLogoutReason && (
                    <div className="col-span-2 p-2 rounded-lg border border-yellow-500/30 bg-yellow-900/20">
                      <p className="text-yellow-300 text-[9px] font-black uppercase tracking-widest">Forced Logout Reason</p>
                      <p className="text-yellow-100 text-[10px] mt-1">{machine.forceLogoutReason}</p>
                    </div>
                  )}
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

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#0a1628] text-[10px] uppercase font-black text-blue-400 tracking-widest border-b border-[#1e3a5f]">
              <tr>
                <th className="p-4">User</th>
                <th className="p-4">Machine</th>
                <th className="p-4">OS</th>
                <th className="p-4">IP Address</th>
                <th className="p-4">Geo Pin</th>
                <th className="p-4">Last Seen</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Security Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e3a5f] text-sm">
              {sessions.map((machine) => (
                <tr key={machine.id} className="hover:bg-[#0a1628]/60 transition-colors">
                  <td className="p-4">
                    <p className="font-black text-white uppercase text-xs">{machine.userName}</p>
                    <p className="text-[10px] font-mono text-blue-300/50">{machine.email}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-xs uppercase text-blue-200">{machine.machineName}</p>
                    {!!machine.forceLogoutReason && (
                      <p className="text-[10px] text-yellow-300 mt-1">{machine.forceLogoutReason}</p>
                    )}
                  </td>
                  <td className="p-4 text-blue-200 font-bold text-xs uppercase">{machine.os}</td>
                  <td className="p-4 text-blue-200 font-mono text-xs">{machine.ip}</td>
                  <td className="p-4 text-xs">
                    {getGeoUrl(machine) ? (
                      <a href={getGeoUrl(machine)} target="_blank" rel="noreferrer" className="text-sky-300 hover:text-gold font-mono">
                        {getGeoText(machine)}
                      </a>
                    ) : (
                      <span className="text-blue-300/60">{getGeoText(machine)}</span>
                    )}
                  </td>
                  <td className="p-4 text-blue-300/60 text-xs">{new Date(machine.lastSeenAt).toLocaleString('en-GB')}</td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1 ${
                        machine.status === 'ACTIVE'
                          ? 'bg-green-900/40 text-green-400 border border-green-500/30'
                          : machine.status === 'REVOKED'
                          ? 'bg-red-900/40 text-red-400 border border-red-500/30'
                          : 'bg-amber-900/40 text-amber-400 border border-amber-500/30'
                      }`}
                    >
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
                  <td className="p-6 text-blue-300/40 text-sm" colSpan={8}>
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
