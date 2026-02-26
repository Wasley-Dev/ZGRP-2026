import React, { useState, useEffect, useRef } from 'react';
// Types defined inline to avoid resolution conflict with duplicate types file
enum UserRole { SUPER_ADMIN = 'SUPER_ADMIN', ADMIN = 'ADMIN', USER = 'USER' }
type ThemeMode = 'light' | 'dark';
interface Notification { id: string; title: string; message: string; time: string; read: boolean; type: 'INFO' | 'WARNING' | 'SUCCESS'; origin?: string; createdAt?: string; }
interface SystemConfig { systemName: string; logoIcon: string; maintenanceMode?: boolean; maintenanceMessage?: string; maintenanceUpdatedBy?: string; maintenanceUpdatedAt?: string; backupHour?: number; }

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
  backgroundImageUrl?: string;
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
  isOnline,
  backgroundImageUrl,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [toastQueue, setToastQueue] = useState<Notification[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);
  const shownToastIdsRef = useRef<Set<string>>(new Set());
  const toastTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Close notif panel on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile sidebar on module change
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [activeModule]);

  // On small screens default sidebar to closed
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    if (mq.matches) setIsSidebarOpen(false);
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setIsSidebarOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Show incoming toasts — each one gets its own dismiss timer
  useEffect(() => {
    const incoming = notifications
      .filter((n) => !n.read)
      .filter((n) => !shownToastIdsRef.current.has(n.id))
      .slice(0, 5);
    if (incoming.length === 0) return;
    incoming.forEach((n) => {
      shownToastIdsRef.current.add(n.id);
      setToastQueue((prev) => [n, ...prev].slice(0, 4));

      // Login / machine-active toasts dismiss in 3s, others in 5s
      const isQuick = /login|signed in|machine.*active|active.*session/i.test(n.title + ' ' + n.message)
        || n.origin === 'machines-login'
        || n.origin === 'machines-active';
      const delay = isQuick ? 3000 : 5000;

      if (toastTimersRef.current[n.id]) clearTimeout(toastTimersRef.current[n.id]);
      toastTimersRef.current[n.id] = setTimeout(() => {
        setToastQueue((prev) => prev.filter((t) => t.id !== n.id));
        onMarkRead(n.id);
        delete toastTimersRef.current[n.id];
      }, delay);
    });
  }, [notifications]);

  // Cleanup toast timers on unmount
  useEffect(() => {
    return () => { Object.values(toastTimersRef.current).forEach(clearTimeout); };
  }, []);

  const dismissToast = (id: string) => {
    if (toastTimersRef.current[id]) { clearTimeout(toastTimersRef.current[id]); delete toastTimersRef.current[id]; }
    onMarkRead(id);
    setToastQueue((prev) => prev.filter((t) => t.id !== id));
  };

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
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (n: Notification) => {
    onMarkRead(n.id);
    const validModules = new Set(['dashboard','candidates','database','recruitment','booking','broadcast','settings','admin','machines','recovery','reports']);
    if (n.origin && validModules.has(n.origin)) onModuleChange(n.origin);
    setIsNotifOpen(false);
  };

  const notifTypeStyle = (type: Notification['type']) => {
    if (type === 'SUCCESS') return { bg: 'bg-green-900/40 border border-green-500/30', icon: 'fa-check', text: 'text-green-400' };
    if (type === 'WARNING') return { bg: 'bg-amber-900/40 border border-amber-500/30', icon: 'fa-exclamation', text: 'text-amber-400' };
    return { bg: 'bg-blue-900/40 border border-blue-500/30', icon: 'fa-info', text: 'text-blue-400' };
  };

  // Shared sidebar nav content (used for both desktop and mobile)
  const SidebarContent = () => (
    <>
      {/* Logo / system name */}
      <div className="p-4 flex items-center gap-3 border-b border-white/10 h-16 md:h-20 shrink-0">
        <div className="w-10 h-10 shrink-0 bg-white rounded-full flex items-center justify-center border-2 border-gold overflow-hidden shadow-inner">
          <i className={`fas ${systemConfig.logoIcon} text-gold text-lg`}></i>
        </div>
        {(isSidebarOpen || isMobileSidebarOpen) && (
          <div className="overflow-hidden whitespace-nowrap">
            <h1 className="font-black text-[10px] tracking-tight uppercase truncate text-white">{systemConfig.systemName}</h1>
            <p className="text-[10px] text-gold font-bold tracking-widest uppercase">PORTAL CORE</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto p-2 pb-24 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onModuleChange(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
              activeModule === item.id
                ? 'bg-white/15 border-l-4 border-gold'
                : 'hover:bg-white/5 opacity-70 hover:opacity-100'
            }`}
          >
            <i className={`fas ${item.icon} w-5 text-center text-sm ${activeModule === item.id ? 'text-gold' : 'text-white'}`}></i>
            {(isSidebarOpen || isMobileSidebarOpen) && (
              <span className="text-sm font-medium text-white">{item.label}</span>
            )}
          </button>
        ))}

        {isAdmin && (
          <>
            <div className="mt-6 mb-2 px-3">
              {(isSidebarOpen || isMobileSidebarOpen)
                ? <span className="text-[9px] uppercase font-black text-white/30 tracking-[0.3em]">Administrator</span>
                : <hr className="border-white/5" />}
            </div>
            {adminItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onModuleChange(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  activeModule === item.id
                    ? 'bg-gold/20 border-l-4 border-gold'
                    : 'hover:bg-white/5 opacity-70 hover:opacity-100'
                }`}
              >
                <i className={`fas ${item.icon} w-5 text-center text-sm ${activeModule === item.id ? 'text-gold' : 'text-white'}`}></i>
                {(isSidebarOpen || isMobileSidebarOpen) && (
                  <span className="text-sm font-medium text-white">{item.label}</span>
                )}
              </button>
            ))}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="sticky bottom-0 p-3 border-t border-white/5 bg-[#003366]/95 backdrop-blur-sm shrink-0">
        <button
          onClick={onLogout}
          className="w-full py-3 text-[10px] font-black text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors tracking-[0.2em] border border-red-400/40"
        >
          {(isSidebarOpen || isMobileSidebarOpen) ? 'LOGOUT' : <i className="fas fa-sign-out-alt"></i>}
        </button>
      </div>
    </>
  );

  return (
    <div
      className={`app-shell app-full-height flex overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}
    >
      {/* ── Mobile sidebar overlay ─────────────────────────────────────── */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* ── Mobile sidebar drawer ──────────────────────────────────────── */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 enterprise-blue text-white flex flex-col z-50 shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center z-10"
          aria-label="Close menu"
        >
          <i className="fas fa-times text-xs"></i>
        </button>
        <SidebarContent />
      </aside>

      {/* ── Desktop sidebar ────────────────────────────────────────────── */}
      <aside
        className={`hidden md:flex ${isSidebarOpen ? 'w-64' : 'w-20'} enterprise-blue text-white flex-col transition-all duration-300 ease-in-out z-30 shadow-2xl shadow-black/50 shrink-0`}
      >
        <SidebarContent />
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main
        className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-colors duration-200 ${
          backgroundImageUrl ? 'main-bg-overlay' : 'bg-[radial-gradient(circle_at_15%_10%,#1a2a5a_0%,#0b1431_35%,#081024_100%)]'
        }`}
        {...(backgroundImageUrl ? { 'data-bg': backgroundImageUrl } as any : {})}
        ref={(el) => {
          if (el && backgroundImageUrl) {
            el.style.backgroundImage = `linear-gradient(rgba(8,14,35,0.78), rgba(8,14,35,0.86)), url(${backgroundImageUrl})`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            el.style.backgroundAttachment = 'fixed';
          } else if (el) {
            el.style.backgroundImage = '';
          }
        }}
      >
        {/* ── Header ── */}
        <header className="h-14 md:h-16 bg-[#0f1b40]/95 border-b border-blue-400/20 flex items-center justify-between px-3 md:px-6 shrink-0 z-20 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile hamburger */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-blue-300 hover:bg-white/10 transition-colors"
              aria-label="Open menu"
            >
              <i className="fas fa-bars text-base"></i>
            </button>
            {/* Desktop sidebar toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex p-2 hover:bg-white/10 rounded-lg text-blue-300 transition-colors"
              aria-label="Toggle sidebar"
            >
              <i className="fas fa-bars"></i>
            </button>

            <div className="flex flex-col">
              <h2 className="text-sm md:text-lg font-black uppercase tracking-tight text-white leading-none truncate max-w-[140px] md:max-w-none">
                {activeModule.replace(/-/g, ' ')}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span className={`text-[8px] font-black uppercase tracking-widest ${isOnline ? 'text-green-400' : 'text-amber-400'}`}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-3">
            {/* Theme toggle */}
            <button
              onClick={onThemeToggle}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-blue-300 hover:text-gold hover:bg-white/10 transition-colors"
            >
              <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-sm`}></i>
            </button>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg text-blue-300 hover:text-gold hover:bg-white/10 transition-colors"
              >
                <i className="fas fa-bell text-sm"></i>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-gold text-enterprise-blue text-[9px] font-black flex items-center justify-center rounded-full border border-[#0f1b40]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification panel — blue-hue theme */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-72 md:w-80 bg-[#0f1a2e] border border-[#1e3a5f] rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-[#1e3a5f] flex justify-between items-center bg-[#0a1628]">
                    <h3 className="font-black text-sm text-blue-400 uppercase tracking-widest">Notifications</h3>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { onClearNotifications(); setIsNotifOpen(false); }}
                        className="text-[9px] text-blue-300/50 font-bold hover:text-red-400 transition-colors uppercase tracking-widest"
                      >
                        Clear All
                      </button>
                      {unreadCount > 0 && (
                        <span className="text-[9px] text-gold font-black uppercase tracking-widest bg-gold/10 px-2 py-0.5 rounded-full">
                          {unreadCount} New
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 md:max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <i className="fas fa-bell-slash text-2xl text-blue-300/20 mb-2 block"></i>
                        <p className="text-blue-300/40 text-xs font-bold uppercase tracking-widest">All clear!</p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const style = notifTypeStyle(n.type);
                        return (
                          <div
                            key={n.id}
                            className={`p-3 border-b border-[#1e3a5f] hover:bg-[#0a1628] transition-colors cursor-pointer ${!n.read ? 'bg-blue-900/10' : ''}`}
                            onClick={() => handleNotificationClick(n)}
                          >
                            <div className="flex gap-3">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${style.bg}`}>
                                <i className={`fas ${style.icon} text-[10px] ${style.text}`}></i>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-black truncate ${!n.read ? 'text-white' : 'text-blue-300/60'}`}>{n.title}</p>
                                <p className="text-[10px] text-blue-300/50 mt-0.5 line-clamp-2">{n.message}</p>
                                <p className="text-[8px] text-blue-300/30 uppercase font-black mt-1 tracking-widest">{n.time}</p>
                              </div>
                              {!n.read && (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-1.5"></div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User avatar */}
            <button
              onClick={() => onModuleChange('settings')}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/10 transition-colors border border-blue-400/20"
              title={user.name}
            >
              <img
                src={user.avatar}
                className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-gold/40 bg-white/10 object-cover"
                alt="Avatar"
              />
              <div className="hidden md:block text-left">
                <p className="text-[10px] font-black truncate text-white uppercase max-w-[100px]">{user.name}</p>
                <p className="text-[8px] text-gold font-bold truncate tracking-widest uppercase max-w-[100px]">{user.role}</p>
              </div>
            </button>
          </div>
        </header>

        {/* ── Page content ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 relative">
          {children}
        </div>

        {/* ── Mobile bottom nav bar ──────────────────────────────────────── */}
        <nav className="md:hidden shrink-0 bg-[#0f1b40] border-t border-blue-400/20 flex items-center justify-around px-2 py-2 z-20">
          {[
            { id: 'dashboard', icon: 'fa-chart-line' },
            { id: 'candidates', icon: 'fa-users' },
            { id: 'booking', icon: 'fa-calendar-alt' },
            { id: 'recruitment', icon: 'fa-briefcase' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all ${
                activeModule === item.id ? 'text-gold' : 'text-blue-300/50'
              }`}
            >
              <i className={`fas ${item.icon} text-base`}></i>
              <span className="text-[8px] font-black uppercase tracking-widest capitalize">{item.id}</span>
            </button>
          ))}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-blue-300/50"
          >
            <i className="fas fa-th-large text-base"></i>
            <span className="text-[8px] font-black uppercase tracking-widest">More</span>
          </button>
        </nav>
      </main>

      {/* ── Toast notifications ───────────────────────────────────────────── */}
      <div className="fixed top-16 md:top-20 right-3 md:right-6 z-[120] space-y-2 pointer-events-none w-72 md:w-80">
        {toastQueue.map((n) => {
          const style = notifTypeStyle(n.type);
          return (
            <div
              key={`toast-${n.id}`}
              className="pointer-events-auto bg-[#0f1a2e] border border-[#1e3a5f] rounded-xl shadow-2xl p-3 animate-in slide-in-from-right-6 duration-300"
            >
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${style.bg}`}>
                  <i className={`fas ${style.icon} text-[10px] ${style.text}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white truncate">{n.title}</p>
                  <p className="text-[10px] text-blue-300/60 line-clamp-2">{n.message}</p>
                </div>
                <button
                  onClick={() => dismissToast(n.id)}
                  className="text-blue-300/40 hover:text-white transition-colors shrink-0"
                  aria-label="Dismiss notification"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Layout;