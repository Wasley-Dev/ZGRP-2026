import React, { useMemo, useState } from 'react';
import { SystemConfig, SystemUser, UserRole } from '../types';

interface SystemRecoveryProps {
  systemConfig: SystemConfig;
  currentUser: SystemUser;
  onSaveConfig: (config: SystemConfig) => void;
  onTriggerBackup: () => void;
}

const SystemRecovery: React.FC<SystemRecoveryProps> = ({
  systemConfig,
  currentUser,
  onSaveConfig,
  onTriggerBackup,
}) => {
  const [maintenanceMode, setMaintenanceMode] = useState(Boolean(systemConfig.maintenanceMode));
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    systemConfig.maintenanceMessage || 'Scheduled maintenance in progress.'
  );
  const [backupHour, setBackupHour] = useState(systemConfig.backupHour ?? 15);

  const isAdmin = useMemo(
    () => currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN,
    [currentUser.role]
  );

  const saveMaintenance = () => {
    if (!isAdmin) return;
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] border dark:border-slate-700 shadow-sm space-y-6">
          <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">System Maintenance</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Global maintenance controls applied to all online machines
          </p>

          <div className="flex items-center justify-between p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <span className="text-xs font-black uppercase tracking-widest dark:text-white">Maintenance Mode</span>
            <button
              disabled={!isAdmin}
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
            disabled={!isAdmin}
            className="w-full h-32 p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none disabled:opacity-70"
            placeholder="Maintenance message shown across systems"
          />

          <div className="flex items-center gap-4">
            <label className="text-xs font-black uppercase tracking-widest dark:text-white">Daily Backup Hour (24h)</label>
            <input
              type="number"
              min={0}
              max={23}
              disabled={!isAdmin}
              value={backupHour}
              onChange={(e) => setBackupHour(Number(e.target.value))}
              className="w-24 p-3 rounded-xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none disabled:opacity-70"
            />
          </div>

          <button
            disabled={!isAdmin}
            onClick={saveMaintenance}
            className="w-full py-4 bg-gold text-enterprise-blue rounded-2xl font-black uppercase tracking-widest shadow-lg disabled:opacity-50"
          >
            Save Maintenance Policy
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] border dark:border-slate-700 shadow-sm flex flex-col justify-center space-y-6">
          <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">Backup Engine</h3>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Automatic backup is configured for {backupHour.toString().padStart(2, '0')}:00 daily.
          </p>
          <button
            onClick={onTriggerBackup}
            className="w-full py-5 bg-enterprise-blue text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl"
          >
            Initiate Global Sync
          </button>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Last policy update: {systemConfig.maintenanceUpdatedAt || 'Not set'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemRecovery;
