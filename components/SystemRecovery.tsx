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

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-slate-900 dark:text-slate-100">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/90 dark:bg-[linear-gradient(180deg,#131d49_0%,#0b1431_100%)] p-8 rounded-3xl border border-slate-200/80 dark:border-blue-400/20 shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] space-y-6 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">System Maintenance</h2>
            <span className="px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Operational</span>
          </div>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            Global maintenance controls applied to all online machines
          </p>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-slate-50 dark:bg-slate-900/50">
            <span className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">Maintenance Mode</span>
            <button
              disabled={!isSuperAdmin}
              onClick={() => setMaintenanceMode((prev) => !prev)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                maintenanceMode ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
              } disabled:opacity-40`}
            >
              {maintenanceMode ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <textarea
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            disabled={!isSuperAdmin}
            className="w-full h-32 p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-slate-50 dark:bg-slate-950/80 font-bold text-slate-800 dark:text-white outline-none disabled:opacity-70"
            placeholder="Maintenance message shown across systems"
          />

          <div className="flex items-center gap-4">
            <label className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">Daily Backup Hour (24h)</label>
            <input
              type="number"
              min={0}
              max={23}
              disabled={!isSuperAdmin}
              value={backupHour}
              onChange={(e) => setBackupHour(Number(e.target.value))}
              className="w-24 p-3 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-slate-50 dark:bg-slate-950 font-bold text-slate-900 dark:text-white outline-none disabled:opacity-70"
            />
          </div>

          <button
            disabled={!isSuperAdmin}
            onClick={saveMaintenance}
            className="w-full py-4 bg-gold text-enterprise-blue rounded-2xl font-black uppercase tracking-widest shadow-lg disabled:opacity-50"
          >
            Save Maintenance Policy
          </button>
        </div>

        <div className="bg-white/90 dark:bg-[linear-gradient(180deg,#131d49_0%,#0b1431_100%)] p-8 rounded-3xl border border-slate-200/80 dark:border-blue-400/20 shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] flex flex-col gap-6 backdrop-blur">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Backup Engine</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Automatic backup is configured for {backupHour.toString().padStart(2, '0')}:00 daily.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={onTriggerBackup}
              disabled={!isAdmin}
              className="w-full py-4 bg-enterprise-blue text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl disabled:opacity-50"
            >
              Initiate Global Sync
            </button>

            <button
              onClick={onRestoreBackup}
              disabled={!isSuperAdmin}
              className="w-full py-4 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest dark:text-white disabled:opacity-50"
            >
              Restore From Previous Backup
            </button>
          </div>

          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Last policy update: {systemConfig.maintenanceUpdatedAt || 'Not set'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/90 dark:bg-[linear-gradient(180deg,#131d49_0%,#0b1431_100%)] p-8 rounded-3xl border border-slate-200/80 dark:border-blue-400/20 shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] space-y-6 backdrop-blur">
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Live System Mode</h3>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            Restricted and standby controls
          </p>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-slate-50 dark:bg-slate-900/50">
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white uppercase">Restricted Access</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Force logout all users, admins only.</p>
            </div>
            <button
              disabled={!isSuperAdmin}
              onClick={() => {
                const next = !restrictedMode;
                setRestrictedMode(next);
                if (onSetRestrictedAccess) onSetRestrictedAccess(next);
              }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                restrictedMode ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-700'
              } disabled:opacity-40`}
            >
              {restrictedMode ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-blue-400/20 bg-slate-50 dark:bg-slate-900/50">
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white uppercase">Standby Mode</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Super admin full access, others read-only.</p>
            </div>
            <button
              disabled={!isSuperAdmin}
              onClick={() => {
                const next = !standbyMode;
                setStandbyMode(next);
                if (onSetStandbyMode) onSetStandbyMode(next);
              }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                standbyMode ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
              } disabled:opacity-40`}
            >
              {standbyMode ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        <div className="bg-white/90 dark:bg-[linear-gradient(180deg,#131d49_0%,#0b1431_100%)] p-8 rounded-3xl border border-slate-200/80 dark:border-blue-400/20 shadow-[0_10px_30px_rgba(15,23,42,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.35)] space-y-6 backdrop-blur">
          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">System Updates</h3>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            Controlled rollout configuration for all connected installations
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-stretch">
            <input
              value={nextVersion}
              onChange={(e) => setNextVersion(e.target.value)}
              disabled={!isSuperAdmin}
              placeholder="Target version e.g. 0.0.1"
              className="p-3 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none disabled:opacity-70 md:col-span-1"
            />
            <select
              value={updateChannel}
              onChange={(e) => setUpdateChannel(e.target.value as 'stable' | 'beta')}
              disabled={!isSuperAdmin}
              className="p-3 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none disabled:opacity-70 md:col-span-1"
            >
              <option value="stable">Stable</option>
              <option value="beta">Beta</option>
            </select>
            <button
              onClick={queueUpdate}
              disabled={!isSuperAdmin}
              className="py-3 bg-enterprise-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 md:col-span-2"
            >
              Queue Update Rollout
            </button>
          </div>
          <textarea
            value={rolloutNotes}
            onChange={(e) => setRolloutNotes(e.target.value)}
            disabled={!isSuperAdmin}
            className="w-full h-24 p-3 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none disabled:opacity-70"
            placeholder="Update notes"
          />
          <button
            onClick={onExportReports}
            className="w-full py-4 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest dark:text-white"
          >
            Export System Reports
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemRecovery;
