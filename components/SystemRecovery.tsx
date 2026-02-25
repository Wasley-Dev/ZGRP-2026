import React, { useMemo, useState } from 'react';
import { SystemConfig, SystemUser, UserRole } from '../types';

interface SystemRecoveryProps {
  systemConfig: SystemConfig;
  currentUser: SystemUser;
  onSaveConfig: (config: SystemConfig) => void;
  onTriggerBackup: () => void;
  onRestoreBackup?: () => void;
  onSetRestrictedAccess?: (enabled: boolean) => void;
  onSetStandbyMode?: (enabled: boolean) => void;
  onQueueUpdate?: (version: string, channel: 'stable' | 'beta', notes: string) => void;
  onExportReports?: () => void;
}

const SystemRecovery: React.FC<SystemRecoveryProps> = ({
  systemConfig,
  currentUser,
  onSaveConfig,
  onTriggerBackup,
  onRestoreBackup,
  onSetRestrictedAccess,
  onSetStandbyMode,
  onQueueUpdate,
  onExportReports,
}) => {
  const parseMode = (message?: string) => {
    if ((message || '').includes('[MODE:RECOVERY]')) return 'RECOVERY';
    if ((message || '').includes('[MODE:SAFE]')) return 'SAFE';
    return 'STANDARD';
  };
  const [maintenanceMode, setMaintenanceMode] = useState(Boolean(systemConfig.maintenanceMode));
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    systemConfig.maintenanceMessage || 'Scheduled maintenance in progress.'
  );
  const [backupHour, setBackupHour] = useState(systemConfig.backupHour ?? 15);
  const [updateChannel, setUpdateChannel] = useState<'stable' | 'beta'>('stable');
  const [nextVersion, setNextVersion] = useState('');
  const [rolloutNotes, setRolloutNotes] = useState('Core stability improvements and sync optimization.');
  const [restrictedMode, setRestrictedMode] = useState(false);
  const [standbyMode, setStandbyMode] = useState(false);
  const [systemMode, setSystemMode] = useState<'STANDARD' | 'SAFE' | 'RECOVERY'>(
    parseMode(systemConfig.maintenanceMessage)
  );

  useMemo(() => {
    const parsed = parseMode(systemConfig.maintenanceMessage);
    setSystemMode(parsed);
    setRestrictedMode(parsed === 'SAFE');
    setStandbyMode(parsed === 'RECOVERY');
    setMaintenanceMode(parsed !== 'STANDARD' || Boolean(systemConfig.maintenanceMode));
    return parsed;
  }, [systemConfig.maintenanceMessage, systemConfig.maintenanceMode]);

  const isSuperAdmin = useMemo(
    () => currentUser.role === UserRole.SUPER_ADMIN,
    [currentUser.role]
  );
  const isAdmin = useMemo(
    () => currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN,
    [currentUser.role]
  );

  const saveMaintenance = () => {
    if (!isSuperAdmin) return;
    onSaveConfig({
      ...systemConfig,
      maintenanceMode,
      maintenanceMessage,
      backupHour,
      maintenanceUpdatedBy: currentUser.name,
      maintenanceUpdatedAt: new Date().toISOString(),
    });
    alert('Maintenance settings synced to all systems.');
  };

  const queueUpdate = () => {
    if (!isSuperAdmin) return;
    if (!nextVersion.trim()) {
      alert('Enter a target version before rollout.');
      return;
    }
    if (onQueueUpdate) onQueueUpdate(nextVersion.trim(), updateChannel, rolloutNotes.trim());
    alert(`Update ${nextVersion.trim()} queued.`);
  };

  const restorePoints = [
    {
      id: 'rp-auto',
      title: 'Automated Global Sync',
      time: systemConfig.maintenanceUpdatedAt || new Date().toISOString(),
      kind: 'SYSTEM',
      size: '2.84 GB',
    },
    {
      id: 'rp-admin',
      title: 'Manual Admin Snapshot',
      time: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      kind: 'MANUAL',
      size: '2.12 GB',
    },
    {
      id: 'rp-update',
      title: 'Post-Update Recovery Point',
      time: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      kind: 'AUTO',
      size: '1.95 GB',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-slate-900 dark:text-slate-100">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white/90 dark:bg-[linear-gradient(180deg,#132248_0%,#0b1431_100%)] p-8 rounded-3xl border border-slate-200/80 dark:border-blue-400/20 shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] space-y-6 backdrop-blur">
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Enterprise Resilience Dashboard</h2>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">
              High-Availability failover & state restore
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              disabled={!isSuperAdmin}
              onClick={() => {
                setSystemMode('STANDARD');
                setMaintenanceMode(false);
                setRestrictedMode(false);
                setStandbyMode(false);
                if (onSetRestrictedAccess) onSetRestrictedAccess(false);
                if (onSetStandbyMode) onSetStandbyMode(false);
              }}
              className={`p-6 rounded-3xl border text-left ${systemMode === 'STANDARD' ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-300/40 dark:border-blue-400/20'} disabled:opacity-60`}
            >
              <p className="text-xs font-black uppercase tracking-widest">Standard Mode</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Full Enterprise Ops</p>
            </button>
            <button
              disabled={!isSuperAdmin}
              onClick={() => {
                setSystemMode('SAFE');
                setRestrictedMode(true);
                setStandbyMode(false);
                setMaintenanceMode(true);
                if (onSetRestrictedAccess) onSetRestrictedAccess(true);
              }}
              className={`p-6 rounded-3xl border text-left ${systemMode === 'SAFE' ? 'border-gold bg-gold/15' : 'border-slate-300/40 dark:border-blue-400/20'} disabled:opacity-60`}
            >
              <p className="text-xs font-black uppercase tracking-widest">Safe Mode</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Read-Only Protocol</p>
            </button>
            <button
              disabled={!isSuperAdmin}
              onClick={() => {
                setSystemMode('RECOVERY');
                setMaintenanceMode(true);
                setStandbyMode(true);
                setRestrictedMode(false);
                if (onSetStandbyMode) onSetStandbyMode(true);
              }}
              className={`p-6 rounded-3xl border text-left ${systemMode === 'RECOVERY' ? 'border-red-400 bg-red-500/10' : 'border-slate-300/40 dark:border-blue-400/20'} disabled:opacity-60`}
            >
              <p className="text-xs font-black uppercase tracking-widest">Recovery Mode</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Restricted Root Access</p>
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Restore Points</p>
            {restorePoints.map((point) => (
              <div
                key={point.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-slate-50/80 dark:bg-slate-900/55 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-black uppercase">{point.title}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    {new Date(point.time).toLocaleString('en-GB')} • {point.kind}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black">{point.size}</span>
                  <button
                    onClick={onRestoreBackup}
                    disabled={!isSuperAdmin}
                    className="px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                  >
                    Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/90 dark:bg-[linear-gradient(180deg,#132248_0%,#0b1431_100%)] p-8 rounded-3xl border border-slate-200/80 dark:border-blue-400/20 shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] space-y-6 backdrop-blur">
          <div className="w-28 h-28 mx-auto rounded-full border border-slate-300 dark:border-blue-400/20 flex items-center justify-center text-4xl text-gold bg-slate-100/60 dark:bg-slate-900/60">
            <i className="fas fa-cloud-upload-alt"></i>
          </div>
          <div className="text-center">
            <h3 className="text-3xl font-black uppercase tracking-tight">Auto-Backup Engine</h3>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">
              Real-time mirroring protocol
            </p>
          </div>
          <button
            onClick={onTriggerBackup}
            disabled={!isAdmin}
            className="w-full py-4 bg-enterprise-blue text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl disabled:opacity-60"
          >
            Initiate Global Sync
          </button>
          <div className="border-t border-slate-300/60 dark:border-blue-400/20 pt-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Next Scheduled Sync</span>
              <span className="font-black text-gold">{(backupHour ?? 15).toString().padStart(2, '0')}:00</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Sync Status</span>
              <span className="font-black text-emerald-500">Healthy</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/90 dark:bg-[linear-gradient(180deg,#132248_0%,#0b1431_100%)] p-8 rounded-3xl border border-slate-200/80 dark:border-blue-400/20 shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] space-y-5 backdrop-blur">
          <h3 className="text-xl font-black uppercase tracking-tight">System Maintenance</h3>
          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-slate-50/80 dark:bg-slate-900/55">
            <span className="text-xs font-black uppercase tracking-widest">Maintenance Mode</span>
            <button
              disabled={!isSuperAdmin}
              onClick={() => setMaintenanceMode((prev) => !prev)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                maintenanceMode ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-700'
              } disabled:opacity-50`}
            >
              {maintenanceMode ? 'ON' : 'OFF'}
            </button>
          </div>
          <textarea
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            disabled={!isSuperAdmin}
            className="w-full h-24 p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none disabled:opacity-60"
          />
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-widest">Daily Backup Hour</span>
            <input
              type="number"
              min={0}
              max={23}
              value={backupHour}
              disabled={!isSuperAdmin}
              onChange={(e) => setBackupHour(Number(e.target.value))}
              className="w-24 p-2 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none disabled:opacity-60"
            />
          </div>
          <button
            disabled={!isSuperAdmin}
            onClick={saveMaintenance}
            className="w-full py-3 bg-gold text-enterprise-blue rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-60"
          >
            Save Maintenance Policy
          </button>
        </div>

        <div className="bg-white/90 dark:bg-[linear-gradient(180deg,#132248_0%,#0b1431_100%)] p-8 rounded-3xl border border-slate-200/80 dark:border-blue-400/20 shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] space-y-5 backdrop-blur">
          <h3 className="text-xl font-black uppercase tracking-tight">System Updates</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={nextVersion}
              onChange={(e) => setNextVersion(e.target.value)}
              disabled={!isSuperAdmin}
              placeholder="Target version"
              className="p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-slate-50 dark:bg-slate-950 font-bold outline-none disabled:opacity-60 md:col-span-1"
            />
            <select
              value={updateChannel}
              onChange={(e) => setUpdateChannel(e.target.value as 'stable' | 'beta')}
              disabled={!isSuperAdmin}
              className="p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-slate-50 dark:bg-slate-950 font-bold outline-none disabled:opacity-60 md:col-span-1"
            >
              <option value="stable">Stable</option>
              <option value="beta">Beta</option>
            </select>
            <button
              onClick={queueUpdate}
              disabled={!isSuperAdmin}
              className="md:col-span-2 py-3 bg-enterprise-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
            >
              Queue Update Rollout
            </button>
          </div>
          <textarea
            value={rolloutNotes}
            onChange={(e) => setRolloutNotes(e.target.value)}
            disabled={!isSuperAdmin}
            className="w-full h-20 p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none disabled:opacity-60"
            placeholder="Update notes"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              disabled={!isSuperAdmin}
              onClick={() => {
                const next = !restrictedMode;
                setRestrictedMode(next);
                setSystemMode(next ? 'SAFE' : 'STANDARD');
                if (next) {
                  setStandbyMode(false);
                  setMaintenanceMode(true);
                } else {
                  setMaintenanceMode(false);
                }
                if (onSetRestrictedAccess) onSetRestrictedAccess(next);
              }}
              className="py-3 rounded-xl border border-slate-200 dark:border-blue-400/20 text-xs font-black uppercase tracking-widest"
            >
              Restricted Access {restrictedMode ? 'ON' : 'OFF'}
            </button>
            <button
              disabled={!isSuperAdmin}
              onClick={() => {
                const next = !standbyMode;
                setStandbyMode(next);
                setSystemMode(next ? 'RECOVERY' : 'STANDARD');
                if (next) {
                  setRestrictedMode(false);
                  setMaintenanceMode(true);
                } else {
                  setMaintenanceMode(false);
                }
                if (onSetStandbyMode) onSetStandbyMode(next);
              }}
              className="py-3 rounded-xl border border-slate-200 dark:border-blue-400/20 text-xs font-black uppercase tracking-widest"
            >
              Standby Mode {standbyMode ? 'ON' : 'OFF'}
            </button>
          </div>
          <button
            onClick={onExportReports}
            className="w-full py-3 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-widest"
          >
            Export System Reports
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemRecovery;
