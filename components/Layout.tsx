
import React, { useState, useEffect, useRef } from 'react';
import { UserRole, Notification, ThemeMode, SystemConfig } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeModule: string;
  onModuleChange: (module: string) => void;
  user: any;
  onLogout: () => void;
  theme: ThemeMode;
  onThemeToggle: () => void;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onClearNotifications: () => void;
  systemConfig: SystemConfig;
  isOnline: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeModule, 
  onModuleChange, 
  user, 
  onLogout,
  theme,
  onThemeToggle,
  notifications,
  onMarkRead,
  onClearNotifications,
  systemConfig,
  isOnline
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [toastQueue, setToastQueue] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const shownToastIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const incoming = notifications
      .filter((n) => !n.read)
      .filter((n) => !shownToastIdsRef.current.has(n.id))
      .slice(0, 5);
    if (incoming.length === 0) return;
    incoming.forEach((n) => shownToastIdsRef.current.add(n.id));
    setToastQueue((prev) => [...incoming.reverse(), ...prev].slice(0, 4));
  }, [notifications]);

  useEffect(() => {
    if (toastQueue.length === 0) return;
    const timer = window.setTimeout(() => {
      setToastQueue((prev) => {
        const next = prev.slice(0, -1);
        const removed = prev[prev.length - 1];
        if (removed) onMarkRead(removed.id);
        return next;
      });
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [toastQueue, onMarkRead]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
    { id: 'candidates', label: 'Candidates Registry', icon: 'fa-users' },
    { id: 'recruitment', label: 'Recruitment Hub', icon: 'fa-briefcase' },
    { id: 'booking', label: 'Booking & Scheduling', icon: 'fa-calendar-alt' },
    { id: 'broadcast', label: 'Broadcast & Comms', icon: 'fa-bullhorn' },
    { id: 'reports', label: 'Reports & Analytics', icon: 'fa-file-contract' },
    { id: 'database', label: 'Database Management', icon: 'fa-database' },
    { id: 'settings', label: 'Settings', icon: 'fa-cog' },
  ];

  const adminItems = [
    { id: 'admin', label: 'Admin Console', icon: 'fa-user-shield' },
    { id: 'machines', label: 'Machine Auth', icon: 'fa-laptop-code' },
    { id: 'recovery', label: 'System Recovery', icon: 'fa-undo-alt' },
  ];

  const isAdmin = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = (n: Notification) => {
    onMarkRead(n.id);
    if (n.origin) onModuleChange(n.origin);
    setIsNotifOpen(false);
  };

  return (
    <div
      className={`app-shell flex overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}
      style={{ minHeight: 'calc(var(--app-vh, 1vh) * 100)' }}
    >
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} enterprise-blue text-white flex flex-col transition-all duration-300 ease-in-out z-30 shadow-2xl shadow-black/50`}>
        <div className="p-4 flex items-center gap-3 border-b border-white/10 h-20 shrink-0">
          <div className="w-10 h-10 shrink-0 bg-white rounded-full flex items-center justify-center border-2 border-gold overflow-hidden shadow-inner">
             <i className={`fas ${systemConfig.logoIcon} text-gold text-lg`}></i>
          </div>
          {isSidebarOpen && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="font-black text-[10px] tracking-tight uppercase truncate">{systemConfig.systemName}</h1>
              <p className="text-[10px] text-gold font-bold tracking-widest uppercase">PORTAL CORE</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar p-2 pb-24 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeModule === item.id ? 'bg-white/15 border-l-4 border-gold' : 'hover:bg-white/5 opacity-70 hover:opacity-100'}`}
            >
              <i className={`fas ${item.icon} w-5 text-center ${activeModule === item.id ? 'text-gold' : ''}`}></i>
              {isSidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}

          {isAdmin && (
            <>
              <div className="mt-6 mb-2 px-3">
                {isSidebarOpen ? <span className="text-[9px] uppercase font-black text-white/30 tracking-[0.3em]">Administrator</span> : <hr className="border-white/5" />}
              </div>
              {adminItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => onModuleChange(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeModule === item.id ? 'bg-gold/20 border-l-4 border-gold' : 'hover:bg-white/5 opacity-70 hover:opacity-100'}`}
                >
                  <i className={`fas ${item.icon} w-5 text-center ${activeModule === item.id ? 'text-gold' : ''}`}></i>
                  {isSidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                </button>
              ))}
            </>
          )}
        </nav>

        <div className="sticky bottom-0 p-3 border-t border-white/5 bg-[#003366]/95 backdrop-blur-sm shrink-0">
          <button onClick={() => onModuleChange('settings')} className="flex items-center gap-3 hover:bg-white/5 p-2 rounded-2xl w-full transition-colors text-left">
            <img src={user.avatar} className="w-8 h-8 rounded-full border border-gold/30 bg-white/10 object-cover" alt="Avatar" />
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-[10px] font-black truncate text-white uppercase">{user.name}</p>
                <p className="text-[8px] text-gold font-bold truncate tracking-widest uppercase">{user.role}</p>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
        <header className="h-16 bg-white dark:bg-slate-800 border-b dark:border-slate-700 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 transition-colors">
              <i className="fas fa-bars"></i>
            </button>
            <div className="flex flex-col">
              <h2 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none">{activeModule.replace('-', ' ')}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                 <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
                 <span className={`text-[8px] font-black uppercase tracking-widest ${isOnline ? 'text-green-500' : 'text-amber-500'}`}>
                   {isOnline ? 'SYSTEM ONLINE' : 'OFFLINE MODE'}
                 </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={onThemeToggle} className="p-2 text-slate-500 dark:text-slate-400 hover:text-gold transition-colors">
              <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
            </button>

            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-gold transition-colors"
              >
                <i className="fas fa-bell"></i>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-gold text-enterprise-blue text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border dark:border-slate-700 z-50 overflow-hidden">
                  <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-sm dark:text-white uppercase tracking-widest">Notifications</h3>
                    <div className="flex items-center gap-2">
                       <button onClick={onClearNotifications} className="text-[9px] text-slate-400 font-bold hover:text-red-500 transition-colors uppercase">Clear All</button>
                       <span className="text-[9px] text-gold font-black uppercase tracking-widest">{unreadCount} Active</span>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 italic text-sm">Empty notification stack</div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-4 border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${!n.read ? 'bg-blue-50/10' : ''}`}
                          onClick={() => handleNotificationClick(n)}
                        >
                          <div className="flex gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              n.type === 'SUCCESS' ? 'bg-green-100 text-green-600' : 
                              n.type === 'WARNING' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                              <i className={`fas ${n.type === 'SUCCESS' ? 'fa-check' : n.type === 'WARNING' ? 'fa-exclamation' : 'fa-info'}`}></i>
                            </div>
                            <div className="flex-1">
                              <p className={`text-xs font-bold ${!n.read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{n.title}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-1">{n.message}</p>
                              <p className="text-[8px] text-slate-400 uppercase font-black mt-1 tracking-widest">{n.time}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
            
            <button 
              onClick={onLogout}
              className="px-4 py-2 text-[10px] font-black text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors tracking-[0.2em] border border-red-100/50"
            >
              LOGOUT
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
          {children}
        </div>
      </main>

      <div className="fixed top-20 right-6 z-[120] space-y-2 pointer-events-none">
        {toastQueue.map((n) => (
          <div
            key={`toast-${n.id}`}
            className="pointer-events-auto w-80 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl p-3 animate-in slide-in-from-right-6 duration-300"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  n.type === 'SUCCESS'
                    ? 'bg-green-100 text-green-600'
                    : n.type === 'WARNING'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                <i className={`fas ${n.type === 'SUCCESS' ? 'fa-check' : n.type === 'WARNING' ? 'fa-exclamation' : 'fa-info'}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-900 dark:text-white">{n.title}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">{n.message}</p>
              </div>
              <button
                onClick={() => {
                  onMarkRead(n.id);
                  setToastQueue((prev) => prev.filter((t) => t.id !== n.id));
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Layout;
