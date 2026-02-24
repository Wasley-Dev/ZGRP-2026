
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MOCK_USER, MOCK_USERS } from './constants';
import {
  BookingEntry,
  Candidate,
  MachineSession,
  Notification,
  ThemeMode,
  SystemConfig,
  SystemUser,
  UserRole,
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
  deleteSession,
  enforceSingleSessionPerUser,
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

const INSTALL_ORIENTATION_KEY = 'zaya_install_orientation_seen_v1';
const ZANZIBAR_NAME_MAP_KEY = 'zaya_zanzibar_name_map_v1';
const ZANZIBAR_NAME_POOL = [
  'Ali Juma',
  'Asha Khamis',
  'Salma Mwinyi',
  'Omar Bakari',
  'Nassor Hamad',
  'Mariam Suleiman',
  'Hassan Kombo',
  'Zainab Abdalla',
  'Yahya Mussa',
  'Rukia Said',
  'Abdalla Hemed',
  'Saada Salim',
  'Khadija Ali',
  'Idd Seif',
  'Amina Rajab',
  'Jabir Nassor',
  'Shabaan Othman',
  'Habiba Omar',
  'Hemed Khamis',
  'Fatma Yahya',
  'Mwanaidi Ali',
  'Suleiman Juma',
  'Rashid Kombo',
  'Safiya Hamad',
] as const;
const MIN_CANDIDATE_COUNT = 20;
const POSITION_POOL = ['Driver', 'Logistics Officer', 'HR Assistant', 'Sales Agent', 'Account Officer', 'Storekeeper'] as const;
const SOURCE_POOL = ['LinkedIn', 'Website', 'Referral', 'Agencies'] as const;
const STATUS_POOL = ['PENDING', 'INTERVIEW', 'TRAINING', 'DEPLOYMENT'] as const;

const App: React.FC = () => {
  const isSame = <T,>(left: T, right: T) => JSON.stringify(left) === JSON.stringify(right);
  const buildZanzibarNameMap = (candidateIds: string[]) => {
    if (typeof window === 'undefined') return {} as Record<string, string>;
    let existing: Record<string, string> = {};
    try {
      const raw = window.localStorage.getItem(ZANZIBAR_NAME_MAP_KEY);
      existing = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      existing = {};
    }

    const used = new Set(Object.values(existing));
    let pointer = 0;
    const nextName = () => {
      while (pointer < ZANZIBAR_NAME_POOL.length && used.has(ZANZIBAR_NAME_POOL[pointer])) {
        pointer += 1;
      }
      const picked = ZANZIBAR_NAME_POOL[pointer % ZANZIBAR_NAME_POOL.length];
      pointer += 1;
      used.add(picked);
      return picked;
    };

    candidateIds.forEach((id) => {
      if (!existing[id]) existing[id] = nextName();
    });

    window.localStorage.setItem(ZANZIBAR_NAME_MAP_KEY, JSON.stringify(existing));
    return existing;
  };

  const normalizeCandidatesZanzibar = (input: Candidate[]): Candidate[] => {
    if (!input.length) return input;
    const nameMap = buildZanzibarNameMap(input.map((c) => c.id));
    return input.map((candidate) => {
      const name = nameMap[candidate.id] || candidate.fullName;
      const photoUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(`${name}-${candidate.id}`)}`;
      return {
        ...candidate,
        fullName: name,
        photoUrl,
      };
    });
  };
  const buildGeneratedCandidate = (index: number): Candidate => {
    const id = `ZGL-CN-2026-${String(index + 1).padStart(5, '0')}`;
    const baseName = ZANZIBAR_NAME_POOL[index % ZANZIBAR_NAME_POOL.length];
    const status = STATUS_POOL[index % STATUS_POOL.length] as Candidate['status'];
    const createdAt = new Date(Date.UTC(2026, (index % 12), ((index % 27) + 1), 9, 30, 0)).toISOString();
    const photoUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(`${baseName}-${id}`)}`;
    return {
      id,
      fullName: baseName,
      gender: index % 2 === 0 ? 'M' : 'F',
      phone: `+2557${String(10000000 + index * 371).slice(0, 8)}`,
      email: `${baseName.toLowerCase().replace(/\s+/g, '.')}@zayagroupltd.com`,
      dob: `199${index % 10}-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
      age: 24 + (index % 11),
      address: `Zanzibar ${index % 2 === 0 ? 'Urban' : 'North'} District`,
      occupation: POSITION_POOL[index % POSITION_POOL.length],
      experienceYears: 1 + (index % 9),
      positionApplied: POSITION_POOL[(index + 2) % POSITION_POOL.length],
      status,
      documents: {
        cv: 'COMPLETE',
        id: index % 3 === 0 ? 'INCOMPLETE' : 'COMPLETE',
        certificates: index % 4 === 0 ? 'INCOMPLETE' : 'COMPLETE',
        tin: index % 5 === 0 ? 'NONE' : 'COMPLETE',
      },
      skills: ['Communication', 'Teamwork', 'Scheduling', 'Reporting'].slice(0, 2 + (index % 3)),
      photoUrl,
      createdAt,
      source: SOURCE_POOL[index % SOURCE_POOL.length] as Candidate['source'],
      notes: `Autogenerated profile ${index + 1} for live registry baseline.`,
    };
  };

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
        bookings: [],
        candidates: [],
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
  const bookingsRef = useRef<BookingEntry[]>([]);
  const candidatesRef = useRef<Candidate[]>([]);
  const usersRef = useRef<SystemUser[]>([]);
  const configRef = useRef<SystemConfig | null>(null);
  const sessionsRef = useRef<MachineSession[]>([]);
  const lastSyncNoticeRef = useRef<Record<string, number>>({});
  const sessionIdRef = useRef<string>(createLocalSessionId());
  const applyingRemoteUpdateRef = useRef(false);
  const initializedSyncRef = useRef(false);
  const remoteHydratedRef = useRef(false);
  const isRevokedRef = useRef(false);
  const maintenanceNotifiedRef = useRef(false);
  const sessionDigestRef = useRef<Record<string, { status: string; isOnline: boolean; userName: string }>>({});
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
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return window.localStorage.getItem('zaya_background_image') || undefined;
  });
  const [hasSeenInstallOrientation, setHasSeenInstallOrientation] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(INSTALL_ORIENTATION_KEY) === '1';
  });

  const reportOptions = [
    'Monthly ROI',
    'Weekly Operations',
    'Weekly Recovery Report',
    'Candidate Performance',
    'Weekly Recruitment Snapshot',
    'Update Rollout Report',
    'Department Efficiency',
    'Global Logistics Dataset',
  ] as const;
  type ReportOption = (typeof reportOptions)[number];
  const [reportPopup, setReportPopup] = useState<ReportOption | null>(null);

  const handleDownloadReport = () => {
    if (!reportPopup) return;

    const now = new Date();
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weeklyBookings = bookings.filter((b) => {
      const d = new Date(`${b.date}T${b.time || '00:00'}`);
      return d >= weekStart && d <= weekEnd;
    });
    const weeklyCandidates = candidates.filter((c) => {
      const d = new Date(c.createdAt);
      return d >= weekStart && d <= weekEnd;
    });

    const deployedCount = candidates.filter((c) => c.status === 'DEPLOYMENT').length;
    const trainingCount = candidates.filter((c) => c.status === 'TRAINING').length;
    const interviewCount = candidates.filter((c) => c.status === 'INTERVIEW').length;
    const pendingCount = candidates.filter((c) => c.status === 'PENDING').length;

    import('jspdf').then(jsPDF => {
      const doc = new jsPDF.default();
      doc.setFontSize(22);
      doc.text(`ZAYA GROUP - ${reportPopup}`, 20, 20);
      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);
      doc.text(`User: ${currentUser.name}`, 20, 40);
      
      doc.setLineWidth(0.5);
      doc.line(20, 45, 190, 45);

      let y = 58;
      const write = (line: string) => {
        doc.text(line, 20, y);
        y += 8;
      };

      doc.setFontSize(12);
      write('Live Data Summary');
      doc.setFontSize(10);
      write(`Total candidates: ${candidates.length}`);
      write(`Total bookings: ${bookings.length}`);
      write(`Users in directory: ${allUsers.length}`);
      write(`Unread notifications: ${notifications.filter((n) => !n.read).length}`);
      y += 2;

      if (reportPopup === 'Monthly ROI') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthlyCandidates = candidates.filter((c) => {
          const d = new Date(c.createdAt);
          return d >= monthStart && d <= monthEnd;
        }).length;
        const monthlyBookings = bookings.filter((b) => {
          const d = new Date(`${b.date}T${b.time || '00:00'}`);
          return d >= monthStart && d <= monthEnd;
        }).length;
        const monthlyDeployed = candidates.filter((c) => {
          const d = new Date(c.createdAt);
          return d >= monthStart && d <= monthEnd && c.status === 'DEPLOYMENT';
        }).length;
        const conversion = monthlyCandidates ? ((monthlyDeployed / monthlyCandidates) * 100).toFixed(1) : '0.0';

        doc.setFontSize(12);
        write('Monthly ROI Metrics');
        doc.setFontSize(10);
        write(`Month: ${monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`);
        write(`Monthly candidates: ${monthlyCandidates}`);
        write(`Monthly bookings: ${monthlyBookings}`);
        write(`Monthly deployed: ${monthlyDeployed}`);
        write(`Deployment conversion: ${conversion}%`);
      } else if (reportPopup === 'Weekly Recovery Report') {
        doc.setFontSize(12);
        write('Weekly Recovery Metrics');
        doc.setFontSize(10);
        write(`Week range: ${weekStart.toLocaleDateString('en-GB')} - ${weekEnd.toLocaleDateString('en-GB')}`);
        write(`Maintenance mode: ${systemConfig.maintenanceMode ? 'ENABLED' : 'DISABLED'}`);
        write(`Backup hour: ${(systemConfig.backupHour ?? 15).toString().padStart(2, '0')}:00`);
        write(`Maintenance updated by: ${systemConfig.maintenanceUpdatedBy || 'N/A'}`);
        write(`Online sessions: ${activeSessions.filter((s) => s.isOnline).length}`);
        const weeklyRecoveryNotifications = notifications.filter((n) => {
          if (!n.createdAt || n.origin !== 'recovery') return false;
          const d = new Date(n.createdAt);
          return d >= weekStart && d <= weekEnd;
        });
        write(`Recovery notifications this week: ${weeklyRecoveryNotifications.length}`);
      } else if (reportPopup === 'Update Rollout Report') {
        doc.setFontSize(12);
        write('Update Rollout Snapshot');
        doc.setFontSize(10);
        write(`Maintenance mode: ${systemConfig.maintenanceMode ? 'ENABLED' : 'DISABLED'}`);
        write(`Policy last updated by: ${systemConfig.maintenanceUpdatedBy || 'N/A'}`);
        write(`Policy last updated at: ${systemConfig.maintenanceUpdatedAt || 'N/A'}`);
        const recoveryNotifs = notifications.filter((n) => n.origin === 'recovery');
        write(`Total recovery-related notifications: ${recoveryNotifs.length}`);
        recoveryNotifs.slice(0, 8).forEach((n) => write(`- ${n.title}: ${n.message}`));
      } else if (reportPopup.includes('Weekly')) {
        doc.setFontSize(12);
        write('Weekly Metrics');
        doc.setFontSize(10);
        write(`Week range: ${weekStart.toLocaleDateString('en-GB')} - ${weekEnd.toLocaleDateString('en-GB')}`);
        write(`Weekly bookings: ${weeklyBookings.length}`);
        write(`Weekly new candidates: ${weeklyCandidates.length}`);
        y += 2;

        doc.setFontSize(11);
        write('Upcoming Weekly Bookings');
        doc.setFontSize(9);
        const weeklyRows = weeklyBookings.slice(0, 10);
        if (weeklyRows.length === 0) {
          write('No bookings scheduled this week.');
        } else {
          weeklyRows.forEach((b) => write(`- ${b.date} ${b.time} | ${b.booker} | ${b.purpose}`));
        }
      } else if (reportPopup === 'Candidate Performance') {
        doc.setFontSize(12);
        write('Candidate Pipeline');
        doc.setFontSize(10);
        write(`Pending: ${pendingCount}`);
        write(`Interview: ${interviewCount}`);
        write(`Training: ${trainingCount}`);
        write(`Deployment: ${deployedCount}`);
      } else if (reportPopup === 'Department Efficiency') {
        doc.setFontSize(12);
        write('Department Snapshot');
        doc.setFontSize(10);
        const byDept = allUsers.reduce<Record<string, number>>((acc, u) => {
          acc[u.department] = (acc[u.department] || 0) + 1;
          return acc;
        }, {});
        Object.entries(byDept).forEach(([dept, count]) => write(`- ${dept}: ${count} users`));
      } else if (reportPopup === 'Global Logistics Dataset') {
        doc.setFontSize(12);
        write('Logistics Dataset Extract');
        doc.setFontSize(10);
        const rows = bookings.slice(0, 12);
        if (!rows.length) {
          write('No logistics bookings available.');
        } else {
          rows.forEach((b) => write(`- ${b.date} ${b.time} | ${b.booker} | ${b.purpose}`));
        }
      } else {
        doc.setFontSize(12);
        write('Operational Summary');
        doc.setFontSize(10);
        write(`Conversion estimate (deployed/candidates): ${candidates.length ? ((deployedCount / candidates.length) * 100).toFixed(1) : '0.0'}%`);
        write(`Average weekly bookings: ${Math.max(weeklyBookings.length, 0)}`);
      }

      doc.save(`${reportPopup.replace(/\s+/g, '_')}_Report.pdf`);
      setReportPopup(null);
    });
  };

  const openReportByName = (raw?: string) => {
    if (!raw) {
      setActiveModule('reports');
      return;
    }
    const normalized = raw.trim().toLowerCase();
    const found = reportOptions.find((option) => option.toLowerCase() === normalized);
    if (found) {
      setActiveModule('reports');
      setReportPopup(found);
      return;
    }
    setActiveModule('reports');
  };



  const pushNotification = (
    title: string,
    message: string,
    type: Notification['type'],
    origin?: string
  ) => {
    setNotifications((prev) => {
      const now = Date.now();
      const recentDuplicate = prev.find((n) => {
        if (n.title !== title || n.message !== message || n.origin !== origin) return false;
        if (!n.createdAt) return false;
        return now - new Date(n.createdAt).getTime() < 90000;
      });
      if (recentDuplicate) return prev;
      return [
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
      ];
    });
  };

  const pushNotificationDeduped = (
    key: string,
    title: string,
    message: string,
    type: Notification['type'],
    origin?: string,
    cooldownMs = 10000
  ) => {
    const now = Date.now();
    const last = lastSyncNoticeRef.current[key] || 0;
    if (now - last < cooldownMs) return;
    lastSyncNoticeRef.current[key] = now;
    pushNotification(title, message, type, origin);
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
    const handleOnline = () => {
      setIsOnline(true);
      flushOutbox(async (item) => {
        if (item.type === 'bookings') await syncRemoteBookings(JSON.parse(item.payload));
        if (item.type === 'candidates') await syncRemoteCandidates(JSON.parse(item.payload));
        if (item.type === 'users') await syncPortalUsers(JSON.parse(item.payload));
        if (item.type === 'systemConfig') await syncRemoteSystemConfig(JSON.parse(item.payload));
      }).then(() => {
        pushNotificationDeduped(
          'sync:reconnect',
          'Sync Complete',
          'Offline updates were synchronized after reconnect.',
          'SUCCESS',
          'dashboard',
          15000
        );
      }).catch(() => {
        pushNotificationDeduped(
          'sync:reconnect:error',
          'Sync Pending',
          'Reconnected, but some offline updates are still queued.',
          'WARNING',
          'dashboard',
          15000
        );
      });
    };
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
    if (typeof window === 'undefined') return;
    if (!backgroundImageUrl) {
      window.localStorage.removeItem('zaya_background_image');
      return;
    }
    window.localStorage.setItem('zaya_background_image', backgroundImageUrl);
  }, [backgroundImageUrl]);

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
    bookingsRef.current = bookings;
    candidatesRef.current = candidates;
    usersRef.current = allUsers;
    configRef.current = systemConfig;
    sessionsRef.current = activeSessions;
  }, [bookings, candidates, allUsers, systemConfig, activeSessions]);

  useEffect(() => {
    if (!candidates.length) return;
    const normalized = normalizeCandidatesZanzibar(candidates);
    if (!isSame(candidates, normalized)) {
      setCandidates(normalized);
      pushNotificationDeduped(
        'zanzibar-candidates-standardized',
        'Candidate Directory Standardized',
        'Applied Zanzibar names and profile photos to candidate records.',
        'INFO',
        'database',
        5000
      );
    }
  }, [candidates]);

  useEffect(() => {
    if (candidates.length >= MIN_CANDIDATE_COUNT) return;
    const required = MIN_CANDIDATE_COUNT - candidates.length;
    if (required <= 0) return;
    const existingIds = new Set(candidates.map((c) => c.id));
    const generated: Candidate[] = [];
    let cursor = candidates.length;
    while (generated.length < required) {
      const item = buildGeneratedCandidate(cursor);
      cursor += 1;
      if (existingIds.has(item.id)) continue;
      existingIds.add(item.id);
      generated.push(item);
    }
    setCandidates((prev) => [...prev, ...generated]);
    pushNotificationDeduped(
      'candidate-seed-minimum',
      'Candidate Baseline Applied',
      `Candidate registry expanded to ${MIN_CANDIDATE_COUNT} records for live operations.`,
      'INFO',
      'database',
      120000
    );
  }, [candidates]);

  useEffect(() => {
    const clearableIds = notifications
      .filter((n) => !n.read)
      .filter((n) => /sync/i.test(`${n.title} ${n.message}`))
      .filter((n) => n.title !== 'System Policy Sync')
      .map((n) => n.id);
    if (clearableIds.length === 0) return;
    const timer = window.setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => !clearableIds.includes(n.id)));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [notifications]);

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
      setBookings((prev) => (isSame(prev, remoteBookings) ? prev : remoteBookings));
      setCandidates((prev) => (isSame(prev, remoteCandidates) ? prev : remoteCandidates));
      if (remoteConfig) {
        setSystemConfig((prev) => (isSame(prev, remoteConfig) ? prev : remoteConfig));
      }
    };
    hydrateRemoteData();
    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  useEffect(() => {
    if (!isLoggedIn || !isOnline) return;
    if (!hasRemoteData()) return;

    let stopped = false;
    const syncFromRemote = async () => {
      const [remoteUsers, remoteBookings, remoteCandidates, remoteConfig, sessions] = await Promise.all([
        hasRemoteUserDirectory() ? fetchRemoteUsers() : Promise.resolve([]),
        fetchRemoteBookings(),
        fetchRemoteCandidates(),
        fetchRemoteSystemConfig(),
        hasRemoteSessionStore() ? fetchActiveSessions() : Promise.resolve([]),
      ]);
      if (stopped) return;

      const hadBookingChange = !isSame(bookingsRef.current, remoteBookings);
      const hadCandidateChange = !isSame(candidatesRef.current, remoteCandidates);
      setBookings((prev) => (isSame(prev, remoteBookings) ? prev : remoteBookings));
      setCandidates((prev) => (isSame(prev, remoteCandidates) ? prev : remoteCandidates));
      if (hadBookingChange) {
        pushNotificationDeduped(
          'sync-bookings',
          'Booking Sync',
          `Booking calendar updated from shared database (${remoteBookings.length} entries).`,
          'INFO',
          'booking'
          ,
          60000
        );
      }
      if (hadCandidateChange) {
        pushNotificationDeduped(
          'sync-candidates',
          'Candidate Sync',
          `Candidate data refreshed across devices (${remoteCandidates.length} records).`,
          'INFO',
          'database'
          ,
          120000
        );
      }
      if (remoteUsers.length > 0) {
        const normalized = normalizeUsers(remoteUsers);
        const hadUserChange = !isSame(usersRef.current, normalized);
        setAllUsers((prev) => (isSame(prev, normalized) ? prev : normalized));
        setCurrentUser((prev) => normalized.find((u) => u.id === prev.id) || prev);
        if (hadUserChange) {
          pushNotificationDeduped(
            'sync-users',
            'User Directory Sync',
            'User accounts/permissions were updated from another device.',
            'INFO',
            'admin'
            ,
            60000
          );
        }
      }
      if (remoteConfig) {
        const hadConfigChange = !isSame(configRef.current, remoteConfig);
        setSystemConfig((prev) => (isSame(prev, remoteConfig) ? prev : remoteConfig));
        if (hadConfigChange) {
          pushNotificationDeduped(
            'sync-config',
            'System Policy Sync',
            'Maintenance or recovery settings changed and were synced.',
            'WARNING',
            'recovery'
            ,
            120000
          );
        }
      }
      if (sessions.length) {
        const hadSessionChange = !isSame(sessionsRef.current, sessions);
        setActiveSessions((prev) => (isSame(prev, sessions) ? prev : sessions));
        if (hadSessionChange) {
          pushNotificationDeduped(
            'sync-sessions',
            'Machine Presence Updated',
            'Active machine/session list changed in real time.',
            'INFO',
            'machines'
            ,
            60000
          );
        }
      }
    };

    syncFromRemote();
    const id = window.setInterval(syncFromRemote, 12000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [isLoggedIn, isOnline]);

  useEffect(() => {
    // Force login on every app open. We intentionally do not restore previous session.
    setIsLoggedIn(false);
  }, []);

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
  }, [isOnline, bookings, candidates, allUsers, systemConfig]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!hasRemoteSessionStore()) return;

    let stopped = false;
    const heartbeat = async () => {
      if (stopped) return;
      await upsertSessionHeartbeat(sessionIdRef.current, currentUser);
      const sessions = await fetchActiveSessions();
      if (stopped) return;
      const prevDigest = sessionDigestRef.current;
      const nextDigest: Record<string, { status: string; isOnline: boolean; userName: string }> = {};
      sessions.forEach((session) => {
        nextDigest[session.id] = {
          status: session.status,
          isOnline: session.isOnline,
          userName: session.userName,
        };
        const prev = prevDigest[session.id];
        if (!prev) {
          if (session.id !== sessionIdRef.current) {
            pushNotificationDeduped(
              `session:new:${session.id}`,
              'New Session',
              `${session.userName} connected from ${session.machineName}.`,
              'INFO',
              'machines',
              15000
            );
          }
          return;
        }
        if (prev.status !== session.status || prev.isOnline !== session.isOnline) {
          pushNotificationDeduped(
            `session:update:${session.id}:${session.status}:${session.isOnline ? 'online' : 'offline'}`,
            'Session Updated',
            `${session.userName} is now ${session.status} ${session.isOnline ? '(ONLINE)' : '(OFFLINE)'}.`,
            session.status === 'ACTIVE' ? 'SUCCESS' : 'WARNING',
            'machines',
            10000
          );
        }
      });
      Object.keys(prevDigest).forEach((sessionId) => {
        if (!nextDigest[sessionId]) {
          pushNotificationDeduped(
            `session:removed:${sessionId}`,
            'Session Removed',
            `Machine session ${sessionId} was removed from active records.`,
            'INFO',
            'machines',
            15000
          );
        }
      });
      sessionDigestRef.current = nextDigest;
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
    const restrictedAccess = (systemConfig.maintenanceMessage || '').includes('[RESTRICTED_ACCESS]');
    const standbyMode = (systemConfig.maintenanceMessage || '').includes('[STANDBY_MODE]');
    if (restrictedAccess && matched.role === UserRole.USER) {
      return 'Restricted access mode is active. Contact admin.';
    }
    if (standbyMode && matched.role !== UserRole.SUPER_ADMIN) {
      return 'Standby mode is active. Only super admin has full access currently.';
    }

    const updatedUser = { ...matched, lastLogin: new Date().toISOString() };
    setAllUsers(userDirectory.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    setCurrentUser(updatedUser);
    isRevokedRef.current = false;
    setIsLoggedIn(true);
    setActiveModule('dashboard');
    const installSeenNow =
      typeof window !== 'undefined' && window.localStorage.getItem(INSTALL_ORIENTATION_KEY) === '1';
    setHasSeenInstallOrientation(installSeenNow);
    const shouldShowOrientation = !updatedUser.hasCompletedOrientation || !installSeenNow;
    setShowOrientation(shouldShowOrientation);
    pushNotification(
      'Login Success',
      `${updatedUser.name} signed in from this machine.`,
      'SUCCESS',
      'machines'
    );

    if (hasRemoteSessionStore()) {
      await upsertSessionHeartbeat(sessionIdRef.current, updatedUser);
      await enforceSingleSessionPerUser(updatedUser.id, sessionIdRef.current);
    }
    return null;
  };

  const [chatMessages, setChatMessages] = useState<{ role: string, text: string }[]>([]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    isRevokedRef.current = false;
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
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INSTALL_ORIENTATION_KEY, '1');
    }
    setHasSeenInstallOrientation(true);
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
            users={allUsers}
            currentUser={currentUser}
            onUpsertBooking={upsertBooking}
          />
        );
      case 'broadcast':
        return <BroadcastModule candidates={candidates} />;
      case 'settings':
        return (
          <Settings
            theme={theme}
            onThemeToggle={toggleTheme}
            user={currentUser}
            setUser={setCurrentUser}
            backgroundImageUrl={backgroundImageUrl}
            onBackgroundImageChange={setBackgroundImageUrl}
          />
        );
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
            onBan={async (sessionId) => {
              await updateSessionStatus(sessionId, 'REVOKED');
              pushNotification('Machine Banned', `Machine session ${sessionId} was banned.`, 'WARNING', 'machines');
              setActiveSessions(await fetchActiveSessions());
            }}
            onDelete={async (sessionId) => {
              await deleteSession(sessionId);
              pushNotification('Machine Deleted', `Machine session ${sessionId} was deleted from auth records.`, 'INFO', 'machines');
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
            onRestoreBackup={() => {
              pushNotification('Backup Restore Started', 'Restore sequence initiated from previous backup point.', 'WARNING', 'recovery');
            }}
            onSetRestrictedAccess={async (enabled) => {
              const taggedMessage = enabled
                ? `[RESTRICTED_ACCESS] ${systemConfig.maintenanceMessage || 'Restricted mode active.'}`
                : (systemConfig.maintenanceMessage || '').replace('[RESTRICTED_ACCESS]', '').trim();
              setSystemConfig((prev) => ({
                ...prev,
                maintenanceMode: enabled ? true : prev.maintenanceMode,
                maintenanceMessage: taggedMessage || prev.maintenanceMessage,
              }));
              if (enabled && hasRemoteSessionStore()) {
                const sessions = await fetchActiveSessions();
                const adminIds = new Set(allUsers.filter((u) => u.role !== UserRole.USER).map((u) => u.id));
                await Promise.all(
                  sessions
                    .filter((s) => s.id !== sessionIdRef.current)
                    .filter((s) => !adminIds.has(s.userId))
                    .map((s) => updateSessionStatus(s.id, 'FORCED_OUT'))
                );
              }
              pushNotification(
                enabled ? 'Restricted Access Enabled' : 'Restricted Access Disabled',
                enabled ? 'Non-admin sessions were forced out.' : 'Standard access policy restored.',
                enabled ? 'WARNING' : 'SUCCESS',
                'recovery'
              );
            }}
            onSetStandbyMode={async (enabled) => {
              const taggedMessage = enabled
                ? `[STANDBY_MODE] ${systemConfig.maintenanceMessage || 'Standby mode active.'}`
                : (systemConfig.maintenanceMessage || '').replace('[STANDBY_MODE]', '').trim();
              setSystemConfig((prev) => ({
                ...prev,
                maintenanceMode: enabled ? true : prev.maintenanceMode,
                maintenanceMessage: taggedMessage || prev.maintenanceMessage,
              }));
              if (enabled && hasRemoteSessionStore()) {
                const sessions = await fetchActiveSessions();
                const superAdminIds = new Set(allUsers.filter((u) => u.role === UserRole.SUPER_ADMIN).map((u) => u.id));
                await Promise.all(
                  sessions
                    .filter((s) => s.id !== sessionIdRef.current)
                    .filter((s) => !superAdminIds.has(s.userId))
                    .map((s) => updateSessionStatus(s.id, 'FORCED_OUT'))
                );
              }
              pushNotification(
                enabled ? 'Standby Mode Enabled' : 'Standby Mode Disabled',
                enabled ? 'Only super admin sessions remain active.' : 'Normal session policy restored.',
                enabled ? 'WARNING' : 'SUCCESS',
                'recovery'
              );
            }}
            onQueueUpdate={(version, channel, notes) => {
              pushNotification(
                'Update Rollout Queued',
                `${version} queued on ${channel.toUpperCase()} channel. ${notes}`,
                'INFO',
                'recovery'
              );
            }}
            onExportReports={() => {
              setActiveModule('reports');
              pushNotification('Report Export Console', 'Redirected to reports module for download.', 'INFO', 'reports');
            }}
          />
        );
      case 'reports':
        return (
          <div className="space-y-8">
             <div className="p-8 bg-white dark:bg-slate-800 rounded-3xl border dark:border-slate-700 min-h-[300px]">
                <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight mb-8">Reports & Dataset Export</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   {reportOptions.map(r => (
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
        backgroundImageUrl={backgroundImageUrl}
      >
        {renderModule()}
      </Layout>

      {showOrientation && (
        <OrientationAI 
          user={currentUser} 
          isFirstTime={!currentUser.hasCompletedOrientation || !hasSeenInstallOrientation}
          onComplete={handleOrientationComplete}
          messages={chatMessages}
          setMessages={setChatMessages}
          onNavigate={(module) => {
            handleOrientationComplete(module || 'dashboard');
          }}
          onAction={(action) => {
            if (action.type === 'DOWNLOAD_REPORT') {
              openReportByName(action.report);
              return;
            }
            if (action.type === 'EXPORT_REPORTS') {
              setActiveModule('reports');
              return;
            }
            if (action.type === 'EXPORT_DATABASE') {
              setActiveModule('database');
              pushNotification('AI Action', 'Opened database module for export.', 'INFO', 'database');
              return;
            }
            if (action.type === 'PRINT_PAGE') {
              window.print();
              return;
            }
            if (action.type === 'SHARE') {
              const url = typeof window !== 'undefined' ? window.location.origin : 'https://zgrp-portal-2026.vercel.app';
              const shareText = `ZAYA Recruitment Portal: ${url}`;
              if (navigator.share) {
                navigator
                  .share({ title: 'ZAYA Recruitment Portal', text: shareText, url })
                  .catch(() => {
                    navigator.clipboard?.writeText(shareText);
                  });
              } else {
                navigator.clipboard?.writeText(shareText);
              }
              pushNotification('AI Share Action', 'Portal link prepared for sharing.', 'SUCCESS', 'dashboard');
              return;
            }
            if (action.type === 'PREVIEW') {
              if (action.target) setActiveModule(action.target);
              pushNotification('AI Preview Action', 'Preview opened for requested module.', 'INFO', action.target || 'dashboard');
              return;
            }
            if (action.type === 'DOWNLOAD') {
              if (action.target === 'database' || action.target === 'candidates') {
                setActiveModule('database');
                pushNotification('AI Download Action', 'Opened database for export/download.', 'INFO', 'database');
                return;
              }
              setActiveModule('reports');
              pushNotification('AI Download Action', 'Opened reports to download requested data.', 'INFO', 'reports');
            }
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
              <button onClick={handleDownloadReport} className="w-full py-3 bg-enterprise-blue text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-900/20 hover:brightness-110">
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
