
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MOCK_USER, INITIAL_BOOKINGS, INITIAL_CANDIDATES, MOCK_USERS } from './constants';
import {
  BookingEntry,
  Candidate,
  MachineSession,
  Notification,
  ThemeMode,
  SystemConfig,
  SystemUser,
} from './types';
import { createSharedSnapshot, loadSharedState, RealtimeSyncClient } from './services/realtimeSync';
import { fetchRemoteUsers, hasRemoteUserDirectory, syncRemoteUsers } from './services/userDirectoryService';
import { loadLocalSnapshot, saveLocalSnapshot, queueOutbox, flushOutbox, getOnlineState } from './services/offlineStore';
import {
  fetchRemoteBookings,
  fetchRemoteCandidates,
  fetchRemoteSystemConfig,
  hasRemoteData,
  syncRemoteBookings,
  syncRemoteCandidates,
  syncRemoteSystemConfig,
  syncRemoteUsers as syncPortalUsers,
} from './services/remoteDataService';
import {
  createLocalSessionId,
  fetchActiveSessions,
  hasRemoteSessionStore,
  markSessionOffline,
  updateSessionStatus,
  upsertSessionHeartbeat,
} from './services/sessionService';
import Layout from './components/Layout';
import DashboardOverview from './components/DashboardOverview';
import CandidateRegistry from './components/CandidateRegistry';
import OrientationAI from './components/OrientationAI';
import MachineAuth from './components/MachineAuth';
import Login from './components/Login';
import Settings from './components/Settings';
import AdminConsole from './components/AdminConsole';
import RecruitmentHub from './components/RecruitmentHub';
import BookingModule from './components/BookingModule';
import BroadcastModule from './components/BroadcastModule';
import SystemRecovery from './components/SystemRecovery';

const App: React.FC = () => {
  const normalizeUsers = (inputUsers: SystemUser[]): SystemUser[] =>
    inputUsers.map((user) => {
      const fallback = MOCK_USERS.find((u) => u.email.toLowerCase() === user.email.toLowerCase());
      return {
        ...user,
        password: user.password || fallback?.password || '',
        lastLogin: user.lastLogin || 'Never',
        status: user.status || 'ACTIVE',
        hasCompletedOrientation: user.hasCompletedOrientation ?? false,
      };
    });

  const initialSharedState = useMemo(
    () =>
      loadSharedState({
        bookings: INITIAL_BOOKINGS,
        candidates: INITIAL_CANDIDATES,
        users: MOCK_USERS,
        notifications: [],
        systemConfig: {
          systemName: 'ZAYA Group Recruitment Portal',
          logoIcon: 'fa-z',
          maintenanceMode: false,
          backupHour: 15,
        },
      }),
    []
  );
  const clientIdRef = useRef(`client-${Math.random().toString(36).slice(2, 11)}`);
  const syncClientRef = useRef<RealtimeSyncClient | null>(null);
  const sessionIdRef = useRef<string>(createLocalSessionId());
  const applyingRemoteUpdateRef = useRef(false);
  const initializedSyncRef = useRef(false);
  const remoteHydratedRef = useRef(false);
  const sessionCheckedRef = useRef(false);
  const isRevokedRef = useRef(false);
  const maintenanceNotifiedRef = useRef(false);
  const initialUsers = useMemo(() => normalizeUsers(initialSharedState.users), [initialSharedState.users]);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [allUsers, setAllUsers] = useState<SystemUser[]>(initialUsers);
  const [currentUser, setCurrentUser] = useState<SystemUser>(
    initialUsers.find((u) => u.id === MOCK_USER.id) || initialUsers[0] || MOCK_USER
  );
  const [activeModule, setActiveModule] = useState('dashboard');
  const [showOrientation, setShowOrientation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [bookings, setBookings] = useState<BookingEntry[]>(initialSharedState.bookings);
  const [candidates, setCandidates] = useState<Candidate[]>(initialSharedState.candidates);
  const [notifications, setNotifications] = useState<Notification[]>(initialSharedState.notifications);
  const [activeSessions, setActiveSessions] = useState<MachineSession[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(initialSharedState.systemConfig);
  const [isOnline, setIsOnline] = useState(getOnlineState());
  const accessToken = (import.meta.env.VITE_APP_ACCESS_TOKEN as string | undefined)?.trim();
  const [isAccessGranted, setIsAccessGranted] = useState(() => {
    if (!accessToken) return true;
    const stored = localStorage.getItem('zaya_access_token');
    return stored === accessToken;
  });
  const [accessInput, setAccessInput] = useState('');

  const [reportPopup, setReportPopup] = useState<string | null>(null);

  const handleDownloadReport = () => {
    if (!reportPopup) return;
    
    // In a real app, this would fetch data and generate a specific report.
    // Here we simulate a generic report download using jsPDF.
    import('jspdf').then(jsPDF => {
      const doc = new jsPDF.default();
      doc.setFontSize(22);
      doc.text(`ZAYA GROUP - ${reportPopup}`, 20, 20);
      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);
      doc.text(`User: ${currentUser.name}`, 20, 40);
      
      doc.setLineWidth(0.5);
      doc.line(20, 45, 190, 45);
      
      doc.setFontSize(14);
      doc.text("Executive Summary", 20, 60);
      doc.setFontSize(11);
      doc.text("This document contains confidential enterprise data. Unauthorized distribution is prohibited.", 20, 70);
      doc.text("The requested analytics dataset has been compiled from the live database.", 20, 80);
      
      doc.save(`${reportPopup.replace(/\s+/g, '_')}_Report.pdf`);
      setReportPopup(null);
    });
  };

  const pushNotification = (
    title: string,
    message: string,
    type: Notification['type'],
    origin?: string
  ) => {
    setNotifications((prev) => [
      {
        id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        message,
        time: 'Just now',
        read: false,
        type,
        origin,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const validModules = useMemo(
    () =>
      new Set([
        'dashboard',
        'candidates',
        'database',
        'recruitment',
        'booking',
        'broadcast',
        'settings',
        'admin',
        'machines',
        'recovery',
        'reports',
      ]),
    []
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const savedTheme = localStorage.getItem('zaya_theme') as ThemeMode;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }

    if (accessToken) {
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get('access');
      if (tokenParam && tokenParam === accessToken) {
        localStorage.setItem('zaya_access_token', tokenParam);
        setIsAccessGranted(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(timer);
    };
  }, [accessToken]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasRemoteSessionStore() && isLoggedIn) {
        markSessionOffline(sessionIdRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLoggedIn]);

  useEffect(() => {
    let cancelled = false;
    const hydrateLocal = async () => {
      const snapshot = await loadLocalSnapshot();
      if (!snapshot || cancelled) return;
      if (snapshot.bookings?.length) setBookings(snapshot.bookings);
      if (snapshot.candidates?.length) setCandidates(snapshot.candidates);
      if (snapshot.users?.length) setAllUsers(normalizeUsers(snapshot.users));
      if (snapshot.systemConfig) setSystemConfig(snapshot.systemConfig);
    };
    hydrateLocal();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hydrateUsers = async () => {
      if (!hasRemoteUserDirectory()) {
        remoteHydratedRef.current = true;
        return;
      }

      const remoteUsers = normalizeUsers(await fetchRemoteUsers());
      if (cancelled) return;

      if (remoteUsers.length > 0) {
        setAllUsers(remoteUsers);
        setCurrentUser((prev) => remoteUsers.find((u) => u.id === prev.id) || prev);
      } else {
        await syncRemoteUsers(initialUsers);
      }

      remoteHydratedRef.current = true;
    };

    hydrateUsers();
    return () => {
      cancelled = true;
    };
  }, [initialUsers]);

  useEffect(() => {
    if (!hasRemoteData()) return;
    if (!isOnline) return;

    let cancelled = false;
    const hydrateRemoteData = async () => {
      const [remoteBookings, remoteCandidates, remoteConfig] = await Promise.all([
        fetchRemoteBookings(),
        fetchRemoteCandidates(),
        fetchRemoteSystemConfig(),
      ]);
      if (cancelled) return;
      if (remoteBookings.length) setBookings(remoteBookings);
      if (remoteCandidates.length) setCandidates(remoteCandidates);
      if (remoteConfig) setSystemConfig(remoteConfig);
    };
    hydrateRemoteData();
    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  useEffect(() => {
    if (sessionCheckedRef.current) return;
    if (!remoteHydratedRef.current) return;

    sessionCheckedRef.current = true;
    const session = localStorage.getItem('zaya_session');
    const sessionUserId = localStorage.getItem('zaya_session_user');
    if (session && sessionUserId) {
      const sessionUser = allUsers.find((u) => u.id === sessionUserId);
      if (sessionUser && sessionUser.status === 'ACTIVE') {
        setCurrentUser(sessionUser);
        setIsLoggedIn(true);
        setActiveModule('dashboard');
        setShowOrientation(!sessionUser.hasCompletedOrientation);
      }
    }
  }, [allUsers]);

  useEffect(() => {
    const syncClient = new RealtimeSyncClient({
      clientId: clientIdRef.current,
      onSnapshot: (snapshot) => {
        applyingRemoteUpdateRef.current = true;
        setBookings(snapshot.bookings);
        setCandidates(snapshot.candidates);
        setAllUsers(normalizeUsers(snapshot.users));
        setNotifications(snapshot.notifications);
        setSystemConfig(snapshot.systemConfig);
        setCurrentUser((prev) => normalizeUsers(snapshot.users).find((u) => u.id === prev.id) || prev);
      },
    });
    syncClient.start();
    syncClientRef.current = syncClient;
    return () => syncClient.stop();
  }, []);

  useEffect(() => {
    if (!syncClientRef.current) return;
    if (!initializedSyncRef.current) {
      initializedSyncRef.current = true;
      return;
    }
    if (applyingRemoteUpdateRef.current) {
      applyingRemoteUpdateRef.current = false;
      return;
    }

    const snapshot = createSharedSnapshot(
      {
        bookings,
        candidates,
        users: allUsers,
        notifications,
        systemConfig,
      },
      currentUser.id || clientIdRef.current
    );
    syncClientRef.current.publish(snapshot);
  }, [bookings, candidates, allUsers, notifications, systemConfig, currentUser.id]);

  useEffect(() => {
    if (!remoteHydratedRef.current) return;
    if (!hasRemoteUserDirectory()) return;

    const timer = setTimeout(() => {
      syncRemoteUsers(allUsers);
    }, 200);
    return () => clearTimeout(timer);
  }, [allUsers]);

  useEffect(() => {
    const persist = async () => {
      await saveLocalSnapshot({
        bookings,
        candidates,
        users: allUsers,
        systemConfig,
      });
      await queueOutbox('bookings', bookings);
      await queueOutbox('candidates', candidates);
      await queueOutbox('users', allUsers);
      await queueOutbox('systemConfig', systemConfig);
    };
    persist();
  }, [bookings, candidates, allUsers, systemConfig]);

  useEffect(() => {
    if (!isOnline || !hasRemoteData()) return;
    const sync = async () => {
      await flushOutbox(async (item) => {
        if (item.type === 'bookings') await syncRemoteBookings(JSON.parse(item.payload));
        if (item.type === 'candidates') await syncRemoteCandidates(JSON.parse(item.payload));
        if (item.type === 'users') await syncPortalUsers(JSON.parse(item.payload));
        if (item.type === 'systemConfig') await syncRemoteSystemConfig(JSON.parse(item.payload));
      });
    };
    sync();
  }, [isOnline]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!hasRemoteSessionStore()) return;

    let stopped = false;
    const heartbeat = async () => {
      if (stopped) return;
      await upsertSessionHeartbeat(sessionIdRef.current, currentUser);
      const sessions = await fetchActiveSessions();
      if (stopped) return;
      setActiveSessions(sessions);
      const mine = sessions.find((s) => s.id === sessionIdRef.current);
      if (!mine) return;
      if ((mine.status === 'FORCED_OUT' || mine.status === 'REVOKED') && !isRevokedRef.current) {
        isRevokedRef.current = true;
        alert('Your session was revoked by an administrator.');
        handleLogout();
      }
    };

    heartbeat();
    const id = window.setInterval(heartbeat, 15000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [isLoggedIn, currentUser]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const backupHour = systemConfig.backupHour ?? 15;
    const timer = window.setInterval(() => {
      const now = new Date();
      if (now.getHours() !== backupHour || now.getMinutes() !== 0) return;
      const key = `zaya_backup_${now.toISOString().slice(0, 10)}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
      pushNotification(
        'Daily Backup',
        `Automatic backup completed at ${backupHour.toString().padStart(2, '0')}:00.`,
        'SUCCESS',
        'recovery'
      );
    }, 30000);
    return () => window.clearInterval(timer);
  }, [isLoggedIn, systemConfig.backupHour]);

  const handleLogin = async (email: string, password: string): Promise<string | null> => {
    const normalizedEmail = email.trim().toLowerCase();
    let userDirectory = allUsers;
    let matched = userDirectory.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!matched && hasRemoteUserDirectory()) {
      const remoteUsers = normalizeUsers(await fetchRemoteUsers());
      if (remoteUsers.length > 0) {
        userDirectory = remoteUsers;
        setAllUsers(remoteUsers);
        matched = remoteUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
      }
    }

    if (!matched) return 'Account not found. Contact admin.';
    if (matched.status === 'BANNED') return 'This account is banned. Contact administrator.';
    if (matched.password !== password) return 'Invalid enterprise credentials. Access denied.';

    const updatedUser = { ...matched, lastLogin: new Date().toISOString() };
    setAllUsers(userDirectory.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    setCurrentUser(updatedUser);
    isRevokedRef.current = false;
    setIsLoggedIn(true);
    setActiveModule('dashboard');
    localStorage.setItem('zaya_session', 'true');
    localStorage.setItem('zaya_session_user', updatedUser.id);
    setShowOrientation(!updatedUser.hasCompletedOrientation);
    pushNotification(
      'Login Success',
      `${updatedUser.name} signed in from this machine.`,
      'SUCCESS',
      'machines'
    );

    if (hasRemoteSessionStore()) {
      await upsertSessionHeartbeat(sessionIdRef.current, updatedUser);
    }
    return null;
  };

  const [chatMessages, setChatMessages] = useState<{ role: string, text: string }[]>([]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    isRevokedRef.current = false;
    localStorage.removeItem('zaya_session');
    localStorage.removeItem('zaya_session_user');
    setChatMessages([]); // Clear chat on logout
    if (hasRemoteSessionStore()) {
      markSessionOffline(sessionIdRef.current);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('zaya_theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const markNotifRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const addCandidate = (c: Candidate) => {
    setCandidates((prev) => [c, ...prev]);
    pushNotification('New Enrollment', `${c.fullName} successfully added.`, 'SUCCESS', 'database');
  };

  const deleteCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    pushNotification('Candidate Removed', `Candidate ${id} has been deleted.`, 'WARNING', 'database');
  };

  const updateCandidate = (updated: Candidate) => {
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    pushNotification(
      'Candidate Updated',
      `${updated.fullName} profile has been synchronized.`,
      'INFO',
      'database'
    );
  };

  const updateUsers = (updated: SystemUser[]) => {
    const normalized = normalizeUsers(updated);
    setAllUsers(normalized);
    // If current user was updated, reflect changes
    const updatedMe = normalized.find(u => u.id === currentUser.id);
    if (updatedMe) setCurrentUser(updatedMe);
    pushNotification('User Directory Updated', 'Admin changes were synced to all sessions.', 'INFO', 'admin');
  };

  const upsertBooking = (booking: BookingEntry) => {
    setBookings((prev) => {
      const exists = prev.some((b) => b.id === booking.id);
      if (exists) return prev.map((b) => (b.id === booking.id ? booking : b));
      return [booking, ...prev];
    });
    pushNotification(
      'Booking Updated',
      `${booking.booker} scheduled ${booking.purpose}.`,
      'SUCCESS',
      'booking'
    );
  };

  const handleOrientationComplete = (destinationModule: string = 'dashboard') => {
    const updatedCurrent = { ...currentUser, hasCompletedOrientation: true };
    setCurrentUser(updatedCurrent);
    setAllUsers((prev) =>
      prev.map((u) => (u.id === updatedCurrent.id ? { ...u, hasCompletedOrientation: true } : u))
    );
    setShowOrientation(false);
    setActiveModule(destinationModule);
  };

  useEffect(() => {
    setAllUsers((prev) => {
      const index = prev.findIndex((u) => u.id === currentUser.id);
      if (index === -1) return prev;
      const existing = prev[index];
      if (JSON.stringify(existing) === JSON.stringify(currentUser)) return prev;
      const next = [...prev];
      next[index] = currentUser;
      return next;
    });
  }, [currentUser]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (showOrientation) return;
    if (!validModules.has(activeModule)) {
      setActiveModule('dashboard');
    }
  }, [activeModule, isLoggedIn, showOrientation, validModules]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!systemConfig.maintenanceMode) {
      maintenanceNotifiedRef.current = false;
      return;
    }
    if (maintenanceNotifiedRef.current) return;
    maintenanceNotifiedRef.current = true;
    pushNotification(
      'Maintenance Mode',
      systemConfig.maintenanceMessage || 'System maintenance mode is active.',
      'WARNING',
      'recovery'
    );
  }, [isLoggedIn, systemConfig.maintenanceMode, systemConfig.maintenanceMessage]);

  if (isLoading) {
    return (
      <div
        className="app-shell w-full bg-[#003366] flex flex-col items-center justify-center text-white p-6 transition-all duration-500"
        style={{ minHeight: 'calc(var(--app-vh, 1vh) * 100)' }}
      >
        <div className="w-40 h-40 mb-12 shadow-2xl animate-pulse flex items-center justify-center bg-white rounded-full border-[6px] border-gold relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-100"></div>
          <span className="text-8xl font-serif text-gold font-bold relative z-10 drop-shadow-md" style={{ fontFamily: 'Times New Roman, serif' }}>Z</span>
          <div className="absolute inset-0 border-[3px] border-gold rounded-full m-1 opacity-50"></div>
        </div>
        <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mb-8 border border-white/5">
          <div className="h-full bg-gold animate-[loading_2s_ease-in-out_infinite] shadow-[0_0_15px_rgba(212,175,55,0.8)]"></div>
        </div>
        <p className="text-[10px] font-black tracking-[0.6em] uppercase text-gold">{systemConfig.systemName.toUpperCase()}</p>
      </div>
    );
  }

  if (!isAccessGranted) {
    return (
      <div
        className="app-shell w-full bg-[#0b1324] flex items-center justify-center text-white p-6 transition-all duration-500"
        style={{ minHeight: 'calc(var(--app-vh, 1vh) * 100)' }}
      >
        <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-200">
          <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Access Required</h2>
          <p className="text-sm text-slate-500 mb-6">Enter the portal access token to continue.</p>
          <input
            type="password"
            value={accessInput}
            onChange={(e) => setAccessInput(e.target.value)}
            placeholder="Access token"
            className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 font-bold outline-none focus:ring-4 focus:ring-gold/10"
          />
          <button
            onClick={() => {
              if (accessToken && accessInput.trim() === accessToken) {
                localStorage.setItem('zaya_access_token', accessToken);
                setIsAccessGranted(true);
              }
            }}
            className="w-full mt-4 py-4 bg-gold text-enterprise-blue rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-gold/20 active:scale-95 transition-all"
          >
            Unlock Portal
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) return <Login onLogin={handleLogin} systemConfig={systemConfig} />;

  const renderModule = () => {
    switch (activeModule) {
      // ... (other cases remain same)
      case 'dashboard':
        return (
          <DashboardOverview
            onNavigate={setActiveModule}
            candidatesCount={candidates.length}
            candidates={candidates}
            bookings={bookings}
            user={currentUser}
          />
        );
      case 'candidates':
      case 'database':
        return <CandidateRegistry candidates={candidates} onAdd={addCandidate} onDelete={deleteCandidate} onUpdate={updateCandidate} mode={activeModule as any} />;
      case 'recruitment':
        return <RecruitmentHub candidates={candidates} bookings={bookings} />;
      case 'booking':
        return (
          <BookingModule
            bookings={bookings}
            currentUser={currentUser}
            onUpsertBooking={upsertBooking}
          />
        );
      case 'broadcast':
        return <BroadcastModule candidates={candidates} />;
      case 'settings':
        return <Settings theme={theme} onThemeToggle={toggleTheme} user={currentUser} setUser={setCurrentUser} />;
      case 'admin':
        return <AdminConsole users={allUsers} currentUser={currentUser} onUpdateUsers={updateUsers} systemConfig={systemConfig} setSystemConfig={setSystemConfig} />;
      case 'machines':
        return (
          <MachineAuth
            sessions={activeSessions}
            currentSessionId={sessionIdRef.current}
            onForceOut={async (sessionId) => {
              await updateSessionStatus(sessionId, 'FORCED_OUT');
              pushNotification('Machine Session Forced Out', `Session ${sessionId} was forced out.`, 'WARNING', 'machines');
              setActiveSessions(await fetchActiveSessions());
            }}
            onRevoke={async (sessionId) => {
              await updateSessionStatus(sessionId, 'REVOKED');
              pushNotification('Machine Access Revoked', `Session ${sessionId} was revoked.`, 'WARNING', 'machines');
              setActiveSessions(await fetchActiveSessions());
            }}
          />
        );
      case 'recovery':
        return (
          <SystemRecovery
            systemConfig={systemConfig}
            currentUser={currentUser}
            onSaveConfig={(nextConfig) => {
              setSystemConfig(nextConfig);
              pushNotification('System Recovery Updated', 'Maintenance settings were synchronized.', 'INFO', 'recovery');
            }}
            onTriggerBackup={() => {
              pushNotification('Backup Triggered', 'Manual backup initiated by admin.', 'SUCCESS', 'recovery');
            }}
          />
        );
      case 'reports':
        return (
          <div className="space-y-8">
             <div className="p-8 bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 min-h-[300px]">
                <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight mb-8">Reports & Dataset Export</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   {['Monthly ROI', 'Candidate Performance', 'Department Efficiency', 'Global Logistics Dataset'].map(r => (
                     <div key={r} className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 hover:border-gold transition-all">
                        <i className="fas fa-file-pdf text-3xl text-gold mb-4"></i>
                        <h4 className="text-xs font-black dark:text-white uppercase tracking-widest">{r}</h4>
                        <button 
                          onClick={() => setReportPopup(r)}
                          className="mt-4 text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-600"
                        >
                          Generate PDF Report
                        </button>
                     </div>
                   ))}
                </div>
             </div>

             <div className="p-8 bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700">
                <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight mb-8">Predictive Analytics</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Forecasted Hiring Needs (Next Qtr)</h4>
                      <p className="text-3xl font-black text-enterprise-blue dark:text-white">+145 <span className="text-sm text-slate-400">Positions</span></p>
                      <div className="mt-4 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                         <div className="h-full bg-enterprise-blue w-[75%]"></div>
                      </div>
                   </div>
                   <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Talent Shortage Alert</h4>
                      <p className="text-xl font-black text-red-500 uppercase">Logistics & Operations</p>
                      <p className="text-[10px] text-slate-500 mt-1">Critical gap in senior supervisors.</p>
                   </div>
                   <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Longest Hiring Delay</h4>
                      <p className="text-xl font-black text-amber-500 uppercase">Architecture Lead</p>
                      <p className="text-[10px] text-slate-500 mt-1">42 Days (Avg: 12 Days)</p>
                   </div>
                </div>
             </div>
          </div>
        );
      default:
        return <div className="p-20 text-center opacity-20 uppercase font-black text-4xl tracking-widest">{activeModule} MODULE</div>;
    }
  };

  return (
    <>
      <Layout 
        activeModule={activeModule} 
        onModuleChange={setActiveModule} 
        user={currentUser}
        onLogout={handleLogout}
        theme={theme}
        onThemeToggle={toggleTheme}
        notifications={notifications}
        onMarkRead={markNotifRead}
        onClearNotifications={clearNotifications}
        systemConfig={systemConfig}
        isOnline={isOnline}
      >
        {renderModule()}
      </Layout>

      {showOrientation && (
        <OrientationAI 
          user={currentUser} 
          isFirstTime={!currentUser.hasCompletedOrientation}
          onComplete={handleOrientationComplete}
          messages={chatMessages}
          setMessages={setChatMessages}
          onNavigate={(module) => {
            handleOrientationComplete(module || 'dashboard');
          }}
        />
      )}

      {reportPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setReportPopup(null)}>
           <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl border dark:border-slate-700" onClick={e => e.stopPropagation()}>
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
                 <i className="fas fa-check"></i>
              </div>
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight mb-2">Report Generated</h3>
              <p className="text-sm text-slate-500 mb-6">The <span className="font-bold text-slate-800 dark:text-white">{reportPopup}</span> has been successfully compiled and is ready for download.</p>
              <button onClick={() => setReportPopup(null)} className="w-full py-3 bg-enterprise-blue text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-900/20 hover:brightness-110">
                 Download & Close
              </button>
           </div>
        </div>
      )}
      
      <button 
        onClick={() => setShowOrientation(true)}
        className="fixed bottom-6 right-6 w-14 h-14 enterprise-blue text-white rounded-2xl shadow-2xl flex items-center justify-center group hover:scale-110 transition-all z-40 border-4 border-white dark:border-slate-800 animate-in zoom-in duration-500"
      >
        <i className="fas fa-robot text-xl group-hover:animate-bounce text-gold"></i>
      </button>
    </>
  );
};

export default App;
