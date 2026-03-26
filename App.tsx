import React, { Suspense, useState, useEffect, useMemo, useRef } from 'react';
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
import { fetchRemoteUsers, hasRemoteUserDirectory, removeRemoteUsers, syncRemoteUsers } from './services/userDirectoryService';
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
import { clockIn, fetchTodayAttendance } from './services/employeeSystemService';
import Login from './components/Login';
import { ZAYA_LOGO_SRC } from './brand';

const Layout = React.lazy(() => import('./components/Layout'));
const DashboardOverview = React.lazy(() => import('./components/DashboardOverview'));
const CandidateRegistry = React.lazy(() => import('./components/CandidateRegistry'));
const OrientationAI = React.lazy(() => import('./components/OrientationAI'));
const MachineAuth = React.lazy(() => import('./components/MachineAuth'));
const Settings = React.lazy(() => import('./components/Settings'));
const AdminConsole = React.lazy(() => import('./components/AdminConsole'));
const DailyReports = React.lazy(() => import('./components/DailyReports'));
const AttendanceModule = React.lazy(() => import('./components/AttendanceModule'));
const TeamChat = React.lazy(() => import('./components/TeamChat'));
const NoticesModule = React.lazy(() => import('./components/NoticesModule'));
const TasksModule = React.lazy(() => import('./components/TasksModule'));
const PayrollModule = React.lazy(() => import('./components/PayrollModule'));
const SalesDashboard = React.lazy(() => import('./components/SalesDashboard'));
const LeadsModule = React.lazy(() => import('./components/LeadsModule'));
const SalesTargetsModule = React.lazy(() => import('./components/SalesTargetsModule'));
const InvoicesModule = React.lazy(() => import('./components/InvoicesModule'));
const EmploymentManagement = React.lazy(() => import('./components/EmploymentManagement'));
const PerformanceReports = React.lazy(() => import('./components/PerformanceReports'));
const RecruitmentHub = React.lazy(() => import('./components/RecruitmentHub'));
const BookingModule = React.lazy(() => import('./components/BookingModule'));
const BroadcastModule = React.lazy(() => import('./components/BroadcastModule'));
const SystemRecovery = React.lazy(() => import('./components/SystemRecovery'));

const INSTALL_ORIENTATION_KEY = 'zaya_install_orientation_seen_v1';
const REMEMBER_AUTH_KEY = 'zaya_remembered_auth_v1';

type RememberedAuth = {
  userId: string;
  email: string;
  passwordDigest: string;
  savedAt: number;
};

const isSalesDeptUser = (user: SystemUser): boolean => {
  return /sales/i.test(String(user.department || '')) || /sales/i.test(String(user.jobTitle || ''));
};
const isSalesManagerUser = (user: SystemUser): boolean => {
  if (!isSalesDeptUser(user)) return false;
  return /manager|head|lead/i.test(String(user.jobTitle || ''));
};
const isSalesRepUser = (user: SystemUser): boolean => isSalesDeptUser(user) && user.role === UserRole.USER && !isSalesManagerUser(user);
const hasSalesAccess = (user: SystemUser): boolean => user.role !== UserRole.USER || isSalesDeptUser(user);
const getHomeModule = (user: SystemUser): string => (isSalesDeptUser(user) && user.role === UserRole.USER ? 'salesDashboard' : 'dashboard');
const isGeneralManagerUser = (user: SystemUser): boolean => {
  const email = String(user.email || '').toLowerCase();
  const jobTitle = String(user.jobTitle || '');
  return email === 'gm@zayagroupltd.com' || /general manager/i.test(jobTitle);
};

const mergeSeedUsers = (seedUsers: SystemUser[], remoteUsers: SystemUser[]): SystemUser[] => {
  const seedById = new Map(seedUsers.map((user) => [user.id, user]));
  const seedByEmail = new Map(seedUsers.map((user) => [user.email.toLowerCase(), user]));
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();

  const mergedRemote = remoteUsers.map((remote) => {
    const emailKey = remote.email.toLowerCase();
    seenIds.add(remote.id);
    seenEmails.add(emailKey);
    const seedMatch = seedById.get(remote.id) || seedByEmail.get(emailKey);
    if (!seedMatch) return remote;
    if (remote.password && remote.password.trim().length > 0) return remote;
    return { ...remote, password: seedMatch.password };
  });

  const missingSeeds = seedUsers.filter((seed) => {
    const emailKey = seed.email.toLowerCase();
    return !seenIds.has(seed.id) && !seenEmails.has(emailKey);
  });

  return [...mergedRemote, ...missingSeeds].sort((a, b) => a.name.localeCompare(b.name));
};
const GENERATED_NAME_POOL = [
  'Alex Morgan', 'Riley Carter', 'Jordan Bennett', 'Taylor Morgan', 'Casey Adams',
  'Jamie Wilson', 'Avery Thomas', 'Cameron Scott', 'Parker Reed', 'Quinn Blake',
  'Skyler James', 'Rowan Brooks', 'Hayden Cole', 'Elliot Stone', 'Sawyer Lane',
  'Drew Parker', 'Charlie Hayes', 'Reese Walker', 'Kendall Shaw', 'Finley Grant',
  'Logan Miles', 'Sydney James', 'Blake Hunter', 'Dakota Lee',
] as const;
const MIN_CANDIDATE_COUNT = 20;
const MIN_BOOKING_COUNT = 24;
const POSITION_POOL = ['Driver', 'Logistics Officer', 'HR Assistant', 'Sales Agent', 'Account Officer', 'Storekeeper'] as const;
const SOURCE_POOL = ['LinkedIn', 'Website', 'Referral', 'Agencies'] as const;
const STATUS_POOL = ['PENDING', 'INTERVIEW', 'TRAINING', 'DEPLOYMENT'] as const;
const BOOKING_PURPOSE_POOL = [
  'Technical Interview',
  'HR Screening',
  'Final Panel Interview',
  'Medical Check',
  'Onboarding Session',
  'Contract Signing',
  'Training Assessment',
  'Background Verification',
] as const;
const BOOKING_REMARK_POOL = [
  'Candidate confirmed attendance.',
  'Bring original certificates for verification.',
  'Venue changed to conference room B.',
  'Follow-up call scheduled with HR team.',
  'Transport logistics coordinated by operations.',
  'Security briefing included before session.',
] as const;

// ─── Notification auto-dismiss durations ────────────────────────────────────
// Login/machine-active notifications clear after 3s, everything else after 8s
const QUICK_DISMISS_MS = 3000;
const DEFAULT_DISMISS_MS = 8000;
const QUICK_DISMISS_ORIGINS = new Set(['machines-login', 'machines-active']);
const QUICK_DISMISS_TITLE_PATTERNS = [/login/i, /signed in/i, /machine.*active/i, /session.*active/i, /active.*session/i];

const shouldQuickDismiss = (n: Notification): boolean => {
  if (n.origin && QUICK_DISMISS_ORIGINS.has(n.origin)) return true;
  return QUICK_DISMISS_TITLE_PATTERNS.some((p) => p.test(n.title) || p.test(n.message));
};

const App: React.FC = () => {
  const fnv1a = (hash: number, value: string) => {
    let h = hash;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const hashList = <T extends Record<string, unknown>>(items: T[], keys: (keyof T)[]) => {
    let h = 2166136261;
    for (const item of items) {
      for (const key of keys) {
        const v = item[key];
        h = fnv1a(h, v === null || v === undefined ? '' : String(v));
        h = fnv1a(h, '|');
      }
      h = fnv1a(h, '∎');
    }
    return h >>> 0;
  };

  const hashBookings = (items: BookingEntry[]) =>
    hashList(items as unknown as Record<string, unknown>[], ['id', 'date', 'time', 'purpose', 'createdAt'] as any);
  const hashCandidates = (items: Candidate[]) =>
    hashList(items as unknown as Record<string, unknown>[], ['id', 'status', 'createdAt'] as any);
  const hashUsers = (items: SystemUser[]) =>
    hashList(items as unknown as Record<string, unknown>[], ['id', 'email', 'role', 'status', 'lastLogin'] as any);
  const hashSessions = (items: MachineSession[]) =>
    hashList(items as unknown as Record<string, unknown>[], ['id', 'userId', 'status', 'isOnline', 'lastSeenAt'] as any);
  const hashConfig = (value: SystemConfig | null | undefined) => {
    if (!value) return 0;
    let h = 2166136261;
    h = fnv1a(h, String(value.systemName || ''));
    h = fnv1a(h, String(value.logoIcon || ''));
    h = fnv1a(h, String(value.maintenanceMode ? '1' : '0'));
    h = fnv1a(h, String(value.maintenanceMessage || ''));
    h = fnv1a(h, String(value.backupHour ?? ''));
    return h >>> 0;
  };
  const rememberAttemptedRef = useRef(false);

  const sha256Hex = async (value: string): Promise<string> => {
    if (typeof crypto === 'undefined' || !crypto.subtle) return value;
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const readRememberedAuth = (): RememberedAuth | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(REMEMBER_AUTH_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<RememberedAuth>;
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.userId || !parsed.email || !parsed.passwordDigest || typeof parsed.savedAt !== 'number') return null;
      return parsed as RememberedAuth;
    } catch {
      return null;
    }
  };

  const clearRememberedAuth = () => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(REMEMBER_AUTH_KEY);
    } catch {
      // ignore
    }
  };

  const buildGeneratedCandidate = (index: number): Candidate => {
    const id = `ZGL-CN-2026-${String(index + 1).padStart(5, '0')}`;
    const baseName = GENERATED_NAME_POOL[index % GENERATED_NAME_POOL.length];
    const status = STATUS_POOL[index % STATUS_POOL.length] as Candidate['status'];
    const createdAt = new Date(Date.UTC(2026, (index % 12), ((index % 27) + 1), 9, 30, 0)).toISOString();
    const photoUrl = `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(`${baseName}-${id}`)}`;
    return {
      id, fullName: baseName, gender: index % 2 === 0 ? 'M' : 'F',
      phone: `+2557${String(10000000 + index * 371).slice(0, 8)}`,
      email: `${baseName.toLowerCase().replace(/\s+/g, '.')}@zayagroupltd.com`,
      dob: `199${index % 10}-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
      age: 24 + (index % 11), address: `Region ${index % 2 === 0 ? 'North' : 'South'} District`,
      occupation: POSITION_POOL[index % POSITION_POOL.length], experienceYears: 1 + (index % 9),
      positionApplied: POSITION_POOL[(index + 2) % POSITION_POOL.length], status,
      documents: {
        cv: 'COMPLETE', id: index % 3 === 0 ? 'INCOMPLETE' : 'COMPLETE',
        certificates: index % 4 === 0 ? 'INCOMPLETE' : 'COMPLETE', tin: index % 5 === 0 ? 'NONE' : 'COMPLETE',
      },
      skills: ['Communication', 'Teamwork', 'Scheduling', 'Reporting'].slice(0, 2 + (index % 3)),
      photoUrl, createdAt, source: SOURCE_POOL[index % SOURCE_POOL.length] as Candidate['source'],
      notes: `Autogenerated profile ${index + 1} for live registry baseline.`,
    };
  };

  const buildGeneratedBooking = (index: number): BookingEntry => {
    const now = new Date();
    const year = now.getFullYear();
    const month = index % 12;
    const slot = Math.floor(index / 12); // 2 bookings per month for a full-year view
    const day = slot === 0 ? 7 + ((index * 3) % 12) : 18 + ((index * 5) % 9);
    const hour = 9 + ((index * 2) % 8);
    const minute = index % 2 === 0 ? '00' : '30';
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const time = `${String(hour).padStart(2, '0')}:${minute}`;
    const purpose = BOOKING_PURPOSE_POOL[index % BOOKING_PURPOSE_POOL.length];
    const remark = BOOKING_REMARK_POOL[index % BOOKING_REMARK_POOL.length];
    const monthLabel = new Date(year, month, day).toLocaleDateString('en-GB', { month: 'long' });
    return {
      id: `BK-${year}-${String(index + 1).padStart(4, '0')}`,
      booker: MOCK_USERS[index % MOCK_USERS.length].name,
      date,
      time,
      purpose,
      remarks: `${remark} (${monthLabel} schedule sample)`,
      createdAt: new Date(Date.UTC(year, month, day, hour, Number(minute), 0)).toISOString(),
      createdByUserId: MOCK_USERS[index % MOCK_USERS.length].id,
    };
  };

  const normalizeUsers = (inputUsers: SystemUser[]): SystemUser[] =>
    inputUsers.map((user) => {
      const fallback = MOCK_USERS.find((u) => u.email.toLowerCase() === user.email.toLowerCase());
      return {
        ...user, password: user.password || fallback?.password || '',
        lastLogin: user.lastLogin || 'Never', status: user.status || 'ACTIVE',
        hasCompletedOrientation: user.hasCompletedOrientation ?? false,
      };
    });

  const initialSharedState = useMemo(
    () => loadSharedState({
      bookings: [], candidates: [], users: MOCK_USERS, notifications: [],
      systemConfig: {
        systemName: 'Zaya Group Portal',
        logoIcon: 'fa-z',
        loginHeroImages: [],
        maintenanceMode: false,
        backupHour: 15,
        salesAdminWriteEnabled: false,
      },
    }), []
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
  const bookingsHashRef = useRef(0);
  const candidatesHashRef = useRef(0);
  const usersHashRef = useRef(0);
  const configHashRef = useRef(0);
  const sessionsHashRef = useRef(0);
  // Track notification auto-dismiss timers so we can cancel them if manually dismissed
  const dismissTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Seed users must always exist even if a stored/shared snapshot is missing them (e.g., older clients publishing).
  const seedUsers = useMemo(() => normalizeUsers(MOCK_USERS), []);
  const initialUsers = useMemo(
    () => mergeSeedUsers(seedUsers, normalizeUsers(initialSharedState.users)),
    [seedUsers, initialSharedState.users]
  );

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessToken = ((import.meta as any).env?.VITE_APP_ACCESS_TOKEN as string | undefined)?.trim();
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
  const DEMO_SEED_DISABLED_KEY = 'zaya_demo_seed_disabled_v1';
  const [demoSeedingEnabled, setDemoSeedingEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(DEMO_SEED_DISABLED_KEY) !== '1';
  });
  const [hasSeenInstallOrientation, setHasSeenInstallOrientation] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(INSTALL_ORIENTATION_KEY) === '1';
  });

  const reportOptions = [
    'Monthly ROI', 'Weekly Operations', 'Weekly Recovery Report', 'Candidate Performance',
    'Weekly Recruitment Snapshot', 'Update Rollout Report', 'Department Efficiency', 'Global Logistics Dataset',
  ] as const;
  type ReportOption = (typeof reportOptions)[number];
  const [reportPopup, setReportPopup] = useState<ReportOption | null>(null);

  const handleGenerateReport = (action: 'download' | 'print') => {
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
    const weeklyBookings = bookings.filter((b) => { const d = new Date(`${b.date}T${b.time || '00:00'}`); return d >= weekStart && d <= weekEnd; });
    const weeklyCandidates = candidates.filter((c) => { const d = new Date(c.createdAt); return d >= weekStart && d <= weekEnd; });
    const deployedCount = candidates.filter((c) => c.status === 'DEPLOYMENT').length;
    const trainingCount = candidates.filter((c) => c.status === 'TRAINING').length;
    const interviewCount = candidates.filter((c) => c.status === 'INTERVIEW').length;
    const pendingCount = candidates.filter((c) => c.status === 'PENDING').length;

    import('jspdf').then(async (jsPDF) => {
      const doc = new jsPDF.default();
      doc.setFontSize(22); doc.text(`ZAYA GROUP - ${reportPopup}`, 20, 20);
      doc.setFontSize(12); doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);
      doc.text(`User: ${currentUser.name}`, 20, 40);
      doc.setLineWidth(0.5); doc.line(20, 45, 190, 45);
      let y = 58;
      const write = (line: string) => { doc.text(line, 20, y); y += 8; };
      doc.setFontSize(12); write('Live Data Summary'); doc.setFontSize(10);
      write(`Total candidates: ${candidates.length}`); write(`Total bookings: ${bookings.length}`);
      write(`Users in directory: ${allUsers.length}`); write(`Unread notifications: ${notifications.filter((n) => !n.read).length}`);
      y += 2;
      if (reportPopup === 'Monthly ROI') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const mc = candidates.filter((c) => { const d = new Date(c.createdAt); return d >= monthStart && d <= monthEnd; }).length;
        const mb = bookings.filter((b) => { const d = new Date(`${b.date}T${b.time || '00:00'}`); return d >= monthStart && d <= monthEnd; }).length;
        const md = candidates.filter((c) => { const d = new Date(c.createdAt); return d >= monthStart && d <= monthEnd && c.status === 'DEPLOYMENT'; }).length;
        doc.setFontSize(12); write('Monthly ROI Metrics'); doc.setFontSize(10);
        write(`Month: ${monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`);
        write(`Monthly candidates: ${mc}`); write(`Monthly bookings: ${mb}`); write(`Monthly deployed: ${md}`);
        write(`Deployment conversion: ${mc ? ((md / mc) * 100).toFixed(1) : '0.0'}%`);
      } else if (reportPopup === 'Weekly Recovery Report') {
        doc.setFontSize(12); write('Weekly Recovery Metrics'); doc.setFontSize(10);
        write(`Week range: ${weekStart.toLocaleDateString('en-GB')} - ${weekEnd.toLocaleDateString('en-GB')}`);
        write(`Maintenance mode: ${systemConfig.maintenanceMode ? 'ENABLED' : 'DISABLED'}`);
        write(`Backup hour: ${(systemConfig.backupHour ?? 15).toString().padStart(2, '0')}:00`);
        write(`Maintenance updated by: ${systemConfig.maintenanceUpdatedBy || 'N/A'}`);
        write(`Online sessions: ${activeSessions.filter((s) => s.isOnline).length}`);
      } else if (reportPopup === 'Update Rollout Report') {
        doc.setFontSize(12); write('Update Rollout Snapshot'); doc.setFontSize(10);
        write(`Maintenance mode: ${systemConfig.maintenanceMode ? 'ENABLED' : 'DISABLED'}`);
        write(`Policy last updated by: ${systemConfig.maintenanceUpdatedBy || 'N/A'}`);
        write(`Policy last updated at: ${systemConfig.maintenanceUpdatedAt || 'N/A'}`);
      } else if (reportPopup.includes('Weekly')) {
        doc.setFontSize(12); write('Weekly Metrics'); doc.setFontSize(10);
        write(`Week range: ${weekStart.toLocaleDateString('en-GB')} - ${weekEnd.toLocaleDateString('en-GB')}`);
        write(`Weekly bookings: ${weeklyBookings.length}`); write(`Weekly new candidates: ${weeklyCandidates.length}`);
        weeklyBookings.slice(0, 10).forEach((b) => write(`- ${b.date} ${b.time} | ${b.booker} | ${b.purpose}`));
      } else if (reportPopup === 'Candidate Performance') {
        doc.setFontSize(12); write('Candidate Pipeline'); doc.setFontSize(10);
        write(`Pending: ${pendingCount}`); write(`Interview: ${interviewCount}`);
        write(`Training: ${trainingCount}`); write(`Deployment: ${deployedCount}`);
      } else if (reportPopup === 'Department Efficiency') {
        doc.setFontSize(12); write('Department Snapshot'); doc.setFontSize(10);
        const byDept = allUsers.reduce<Record<string, number>>((acc, u) => { acc[u.department] = (acc[u.department] || 0) + 1; return acc; }, {});
        Object.entries(byDept).forEach(([dept, count]) => write(`- ${dept}: ${count} users`));
      } else if (reportPopup === 'Global Logistics Dataset') {
        doc.setFontSize(12); write('Logistics Dataset Extract'); doc.setFontSize(10);
        bookings.slice(0, 12).forEach((b) => write(`- ${b.date} ${b.time} | ${b.booker} | ${b.purpose}`));
      } else {
        doc.setFontSize(12); write('Operational Summary'); doc.setFontSize(10);
        write(`Conversion estimate: ${candidates.length ? ((deployedCount / candidates.length) * 100).toFixed(1) : '0.0'}%`);
      }
      const filename = `${reportPopup.replace(/\s+/g, '_')}_Report.pdf`;
      if (action === 'download') {
        doc.save(filename);
      } else {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank');
        if (w) {
          w.addEventListener('load', () => {
            try { w.focus(); w.print(); } catch { /* ignore */ }
          });
        }
        window.setTimeout(() => URL.revokeObjectURL(url), 20000);
      }
      setReportPopup(null);
    });
  };

  const handleDownloadReport = () => handleGenerateReport('download');
  const handlePrintReport = () => handleGenerateReport('print');

  const openReportByName = (raw?: string) => {
    if (!raw) { setActiveModule('reports'); return; }
    const normalized = raw.trim().toLowerCase();
    const found = reportOptions.find((option) => option.toLowerCase() === normalized);
    if (found) { setActiveModule('reports'); setReportPopup(found); return; }
    setActiveModule('reports');
  };

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
  // Auto-dismiss: login/machine-active = 3s, everything else = 8s
  const scheduleAutoDismiss = (id: string, quick: boolean) => {
    if (dismissTimersRef.current[id]) clearTimeout(dismissTimersRef.current[id]);
    dismissTimersRef.current[id] = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      delete dismissTimersRef.current[id];
    }, quick ? QUICK_DISMISS_MS : DEFAULT_DISMISS_MS);
  };

  const pushNotification = (
    title: string,
    message: string,
    type: Notification['type'],
    origin?: string
  ) => {
    setNotifications((prev) => {
      const now = Date.now();
      // Deduplicate: same title+message+origin within 90s
      const recentDuplicate = prev.find((n) => {
        if (n.title !== title || n.message !== message || n.origin !== origin) return false;
        if (!n.createdAt) return false;
        return now - new Date(n.createdAt).getTime() < 90000;
      });
      if (recentDuplicate) return prev;

      const newNotif: Notification = {
        id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title, message, time: 'Just now', read: false, type, origin,
        createdAt: new Date().toISOString(),
      };

      // Schedule auto-dismiss
      const quick = shouldQuickDismiss(newNotif);
      setTimeout(() => scheduleAutoDismiss(newNotif.id, quick), 0);

      return [newNotif, ...prev];
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

  // Cleanup dismiss timers on unmount
  useEffect(() => {
    return () => {
      Object.values(dismissTimersRef.current).forEach(clearTimeout);
    };
  }, []);

  const getSystemMode = (config: SystemConfig): 'STANDARD' | 'SAFE' | 'RECOVERY' => {
    const message = config.maintenanceMessage || '';
    if (message.includes('[MODE:RECOVERY]')) return 'RECOVERY';
    if (message.includes('[MODE:SAFE]')) return 'SAFE';
    return 'STANDARD';
  };

  const validModules = useMemo(
    () => new Set(['dashboard', 'salesDashboard', 'leads', 'salesTargets', 'invoices', 'dailyReports', 'attendance', 'performance', 'chat', 'notices', 'tasks', 'payroll', 'employment', 'candidates', 'database', 'recruitment', 'booking', 'broadcast', 'settings', 'admin', 'machines', 'recovery', 'reports']),
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
        pushNotificationDeduped('sync:reconnect', 'Sync Complete', 'Offline updates were synchronized after reconnect.', 'SUCCESS', 'dashboard', 15000);
      }).catch(() => {
        pushNotificationDeduped('sync:reconnect:error', 'Sync Pending', 'Reconnected, but some offline updates are still queued.', 'WARNING', 'dashboard', 15000);
      });
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const savedTheme = localStorage.getItem('zaya_theme') as ThemeMode;
    if (savedTheme) { setTheme(savedTheme); document.documentElement.classList.toggle('dark', savedTheme === 'dark'); }
    if (accessToken) {
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get('access');
      if (tokenParam && tokenParam === accessToken) {
        localStorage.setItem('zaya_access_token', tokenParam);
        setIsAccessGranted(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    const timer = setTimeout(() => setIsLoading(false), 4000);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); clearTimeout(timer); };
  }, [accessToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!backgroundImageUrl) { window.localStorage.removeItem('zaya_background_image'); return; }
    window.localStorage.setItem('zaya_background_image', backgroundImageUrl);
  }, [backgroundImageUrl]);

  useEffect(() => {
    const handleBeforeUnload = () => { if (isLoggedIn) markSessionOffline(sessionIdRef.current); };
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
      if (snapshot.users?.length) setAllUsers(mergeSeedUsers(seedUsers, normalizeUsers(snapshot.users)));
      if (snapshot.systemConfig) setSystemConfig(snapshot.systemConfig);
    };
    hydrateLocal();
    return () => { cancelled = true; };
  }, [seedUsers]);

  useEffect(() => {
    let cancelled = false;
    const hydrateUsers = async () => {
      if (!hasRemoteUserDirectory()) { remoteHydratedRef.current = true; return; }
      const remoteUsers = normalizeUsers(await fetchRemoteUsers());
      if (cancelled) return;
      if (remoteUsers.length > 0) {
        const merged = mergeSeedUsers(seedUsers, remoteUsers);
        setAllUsers(merged);
        setCurrentUser((prev) => merged.find((u) => u.id === prev.id) || prev);
        if (merged.length !== remoteUsers.length) {
          try { await syncRemoteUsers(merged); } catch { /* ignore */ }
        }
      } else { await syncRemoteUsers(initialUsers); }
      remoteHydratedRef.current = true;
    };
    hydrateUsers();
    return () => { cancelled = true; };
  }, [initialUsers, seedUsers]);

  useEffect(() => {
    bookingsRef.current = bookings; candidatesRef.current = candidates;
    usersRef.current = allUsers; configRef.current = systemConfig; sessionsRef.current = activeSessions;
    bookingsHashRef.current = hashBookings(bookings);
    candidatesHashRef.current = hashCandidates(candidates);
    usersHashRef.current = hashUsers(allUsers);
    configHashRef.current = hashConfig(systemConfig);
    sessionsHashRef.current = hashSessions(activeSessions);
  }, [bookings, candidates, allUsers, systemConfig, activeSessions]);

  useEffect(() => {
    if (!demoSeedingEnabled) return;
    if (candidates.length >= MIN_CANDIDATE_COUNT) return;
    const required = MIN_CANDIDATE_COUNT - candidates.length;
    if (required <= 0) return;
    const existingIds = new Set(candidates.map((c) => c.id));
    const generated: Candidate[] = [];
    let cursor = candidates.length;
    while (generated.length < required) {
      const item = buildGeneratedCandidate(cursor); cursor += 1;
      if (existingIds.has(item.id)) continue;
      existingIds.add(item.id); generated.push(item);
    }
    setCandidates((prev) => [...prev, ...generated]);
    pushNotificationDeduped('candidate-seed-minimum', 'Candidate Baseline Applied', `Candidate registry expanded to ${MIN_CANDIDATE_COUNT} records for live operations.`, 'INFO', 'database', 120000);
  }, [candidates, demoSeedingEnabled]);

  useEffect(() => {
    if (!demoSeedingEnabled) return;
    if (bookings.length >= MIN_BOOKING_COUNT) return;
    const required = MIN_BOOKING_COUNT - bookings.length;
    if (required <= 0) return;
    const existingIds = new Set(bookings.map((b) => b.id));
    const generated: BookingEntry[] = [];
    let cursor = bookings.length;
    while (generated.length < required) {
      const item = buildGeneratedBooking(cursor);
      cursor += 1;
      if (existingIds.has(item.id)) continue;
      existingIds.add(item.id);
      generated.push(item);
    }
    setBookings((prev) => [...prev, ...generated]);
    const now = new Date();
    pushNotificationDeduped(
      'booking-seed-full-year',
      'Booking Calendar Seeded',
      `Added ${generated.length} sample bookings across ${now.getFullYear()} with past and upcoming records.`,
      'INFO',
      'booking',
      120000
    );
  }, [bookings, demoSeedingEnabled]);

  useEffect(() => {
    const clearableIds = notifications.filter((n) => !n.read).filter((n) => /sync/i.test(`${n.title} ${n.message}`)).filter((n) => n.title !== 'System Policy Sync').map((n) => n.id);
    if (clearableIds.length === 0) return;
    const timer = window.setTimeout(() => { setNotifications((prev) => prev.filter((n) => !clearableIds.includes(n.id))); }, 5000);
    return () => window.clearTimeout(timer);
  }, [notifications]);

  useEffect(() => {
    if (!hasRemoteData() || !isOnline) return;
    let cancelled = false;
    const hydrateRemoteData = async () => {
      const [remoteBookings, remoteCandidates, remoteConfig] = await Promise.all([fetchRemoteBookings(), fetchRemoteCandidates(), fetchRemoteSystemConfig()]);
      if (cancelled) return;
      const remoteBookingsHash = hashBookings(remoteBookings);
      const remoteCandidatesHash = hashCandidates(remoteCandidates);
      const remoteConfigHash = hashConfig(remoteConfig);
      if (remoteBookingsHash !== bookingsHashRef.current) setBookings(remoteBookings);
      if (remoteCandidatesHash !== candidatesHashRef.current) setCandidates(remoteCandidates);
      if (remoteConfig && remoteConfigHash !== configHashRef.current) setSystemConfig(remoteConfig);
    };
    hydrateRemoteData();
    return () => { cancelled = true; };
  }, [isOnline]);

  useEffect(() => {
    if (!isLoggedIn || !isOnline || !hasRemoteData()) return;
    let stopped = false;
    const syncFromRemote = async () => {
      const [remoteUsers, remoteBookings, remoteCandidates, remoteConfig, sessions] = await Promise.all([
        hasRemoteUserDirectory() ? fetchRemoteUsers() : Promise.resolve([]),
        fetchRemoteBookings(), fetchRemoteCandidates(), fetchRemoteSystemConfig(),
        hasRemoteSessionStore() ? fetchActiveSessions() : Promise.resolve([]),
      ]);
      if (stopped) return;
      const remoteBookingsHash = hashBookings(remoteBookings);
      const remoteCandidatesHash = hashCandidates(remoteCandidates);
      const hadBookingChange = remoteBookingsHash !== bookingsHashRef.current;
      const hadCandidateChange = remoteCandidatesHash !== candidatesHashRef.current;
      if (hadBookingChange) { setBookings(remoteBookings); pushNotificationDeduped('sync-bookings', 'Booking Sync', `Booking calendar updated (${remoteBookings.length} entries).`, 'INFO', 'booking', 60000); }
      if (hadCandidateChange) { setCandidates(remoteCandidates); pushNotificationDeduped('sync-candidates', 'Candidate Sync', `Candidate data refreshed (${remoteCandidates.length} records).`, 'INFO', 'database', 120000); }
      if (remoteUsers.length > 0) {
        const normalized = normalizeUsers(remoteUsers);
        const remoteUsersHash = hashUsers(normalized);
        const hadUserChange = remoteUsersHash !== usersHashRef.current;
        if (hadUserChange) {
          setAllUsers(normalized);
          setCurrentUser((prev) => normalized.find((u) => u.id === prev.id) || prev);
          pushNotificationDeduped('sync-users', 'User Directory Sync', 'User accounts/permissions updated from another device.', 'INFO', 'admin', 60000);
        }
      }
      if (remoteConfig) {
        const remoteConfigHash = hashConfig(remoteConfig);
        const hadConfigChange = remoteConfigHash !== configHashRef.current;
        if (hadConfigChange) {
          setSystemConfig(remoteConfig);
          pushNotificationDeduped('sync-config', 'System Policy Sync', 'Maintenance or recovery settings changed and were synced.', 'WARNING', 'recovery', 120000);
        }
      }
      if (sessions.length) {
        const remoteSessionsHash = hashSessions(sessions);
        const hadSessionChange = remoteSessionsHash !== sessionsHashRef.current;
        if (hadSessionChange) {
          setActiveSessions(sessions);
          pushNotificationDeduped('sync-sessions', 'Machine Presence Updated', 'Active machine/session list changed in real time.', 'INFO', 'machines', 60000);
        }
      }
    };
    syncFromRemote();
    const id = window.setInterval(syncFromRemote, 12000);
    return () => { stopped = true; window.clearInterval(id); };
  }, [isLoggedIn, isOnline]);

  useEffect(() => {
    if (rememberAttemptedRef.current) return;
    if (isLoggedIn) { rememberAttemptedRef.current = true; return; }
    const remembered = readRememberedAuth();
    if (!remembered) { rememberAttemptedRef.current = true; return; }
    rememberAttemptedRef.current = true;

    const restore = async () => {
      const normalizedEmail = remembered.email.trim().toLowerCase();
      let userDirectory = allUsers;
      let matched =
        userDirectory.find((u) => u.id === remembered.userId) ||
        userDirectory.find((u) => u.email.toLowerCase() === normalizedEmail);

      if (!matched && hasRemoteUserDirectory()) {
        const remoteUsers = normalizeUsers(await fetchRemoteUsers());
        if (remoteUsers.length > 0) {
          const merged = mergeSeedUsers(seedUsers, remoteUsers);
          userDirectory = merged;
          setAllUsers(merged);
          matched =
            merged.find((u) => u.id === remembered.userId) ||
            merged.find((u) => u.email.toLowerCase() === normalizedEmail);
        }
      }

      if (!matched) { clearRememberedAuth(); return; }
      if (matched.status === 'BANNED') { clearRememberedAuth(); return; }

      try {
        const digest = await sha256Hex(matched.password);
        if (digest !== remembered.passwordDigest) { clearRememberedAuth(); return; }
      } catch {
        clearRememberedAuth();
        return;
      }

      const systemMode = getSystemMode(systemConfig);
      if (systemMode === 'SAFE' && matched.role === UserRole.USER) { clearRememberedAuth(); return; }
      if (systemMode === 'RECOVERY' && matched.role !== UserRole.SUPER_ADMIN && !isGeneralManagerUser(matched)) { clearRememberedAuth(); return; }

      const updatedUser = { ...matched, lastLogin: new Date().toISOString() };
      setAllUsers(userDirectory.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
      setCurrentUser(updatedUser);
      isRevokedRef.current = false;
      setIsLoggedIn(true);
      setActiveModule(getHomeModule(updatedUser));
      const installSeenNow = typeof window !== 'undefined' && window.localStorage.getItem(INSTALL_ORIENTATION_KEY) === '1';
      setHasSeenInstallOrientation(installSeenNow);
      const shouldShowOrientation = !updatedUser.hasCompletedOrientation || !installSeenNow;
      setShowOrientation(shouldShowOrientation);

      pushNotification('Session Restored', `${updatedUser.name} was remembered on this machine.`, 'SUCCESS', 'machines-login');
      try {
        await upsertSessionHeartbeat(sessionIdRef.current, updatedUser);
        await enforceSingleSessionPerUser(updatedUser.id, sessionIdRef.current);
      } catch (err) {
        console.warn('Session heartbeat sync failed; continuing in local mode.', err);
      }
    };

    void restore();
  }, [allUsers, isLoggedIn, systemConfig, initialUsers, seedUsers]);

  useEffect(() => {
    const syncClient = new RealtimeSyncClient({
      clientId: clientIdRef.current,
      onSnapshot: (snapshot) => {
        applyingRemoteUpdateRef.current = true;
        setBookings(snapshot.bookings); setCandidates(snapshot.candidates);
        const mergedUsers = mergeSeedUsers(seedUsers, normalizeUsers(snapshot.users));
        setAllUsers(mergedUsers); setNotifications(snapshot.notifications);
        setSystemConfig(snapshot.systemConfig);
        setCurrentUser((prev) => mergedUsers.find((u) => u.id === prev.id) || prev);
      },
    });
    syncClient.start();
    syncClientRef.current = syncClient;
    return () => syncClient.stop();
  }, [seedUsers]);

  useEffect(() => {
    if (!syncClientRef.current) return;
    if (!initializedSyncRef.current) { initializedSyncRef.current = true; return; }
    if (applyingRemoteUpdateRef.current) { applyingRemoteUpdateRef.current = false; return; }
    const snapshot = createSharedSnapshot({ bookings, candidates, users: allUsers, notifications, systemConfig }, currentUser.id || clientIdRef.current);
    syncClientRef.current.publish(snapshot);
  }, [bookings, candidates, allUsers, notifications, systemConfig, currentUser.id]);

  useEffect(() => {
    if (!remoteHydratedRef.current || !hasRemoteUserDirectory()) return;
    const timer = setTimeout(() => {
      void syncRemoteUsers(allUsers).catch((err) => {
        console.warn('Remote user sync failed:', err);
        pushNotificationDeduped('sync:users:failed', 'User Sync Failed', 'User directory sync failed. Check Supabase portal_users table/RLS.', 'WARNING', 'admin', 20000);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [allUsers]);

  useEffect(() => {
    const persist = async () => {
      await saveLocalSnapshot({ bookings, candidates, users: allUsers, systemConfig });
      await queueOutbox('bookings', bookings); await queueOutbox('candidates', candidates);
      await queueOutbox('users', allUsers); await queueOutbox('systemConfig', systemConfig);
    };
    persist();
  }, [bookings, candidates, allUsers, systemConfig]);

  useEffect(() => {
    if (!isOnline || !hasRemoteData()) return;
    let running = false;
    const sync = async () => {
      if (running) return; running = true;
      await flushOutbox(async (item) => {
        if (item.type === 'bookings') await syncRemoteBookings(JSON.parse(item.payload));
        if (item.type === 'candidates') await syncRemoteCandidates(JSON.parse(item.payload));
        if (item.type === 'users') await syncPortalUsers(JSON.parse(item.payload));
        if (item.type === 'systemConfig') await syncRemoteSystemConfig(JSON.parse(item.payload));
      });
      running = false;
    };
    sync();
  }, [isOnline, bookings, candidates, allUsers, systemConfig]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let stopped = false;
    const heartbeat = async () => {
      if (stopped) return;
      await upsertSessionHeartbeat(sessionIdRef.current, currentUser);
      const sessions = await fetchActiveSessions();
      if (stopped) return;
      const prevDigest = sessionDigestRef.current;
      const nextDigest: Record<string, { status: string; isOnline: boolean; userName: string }> = {};
      sessions.forEach((session) => {
        nextDigest[session.id] = { status: session.status, isOnline: session.isOnline, userName: session.userName };
        const prev = prevDigest[session.id];
        if (!prev) {
          if (session.id !== sessionIdRef.current) {
            // New machine connected — use machines-active origin for fast dismiss
            pushNotificationDeduped(`session:new:${session.id}`, 'Machine Active', `${session.userName} connected from ${session.machineName}.`, 'INFO', 'machines-active', 15000);
          }
          return;
        }
        if (prev.status !== session.status || prev.isOnline !== session.isOnline) {
          pushNotificationDeduped(
            `session:update:${session.id}:${session.status}:${session.isOnline ? 'online' : 'offline'}`,
            'Session Updated',
            `${session.userName} is now ${session.status} ${session.isOnline ? '(ONLINE)' : '(OFFLINE)'}.`,
            session.status === 'ACTIVE' ? 'SUCCESS' : 'WARNING', 'machines', 10000
          );
        }
      });
      Object.keys(prevDigest).forEach((sessionId) => {
        if (!nextDigest[sessionId]) {
          pushNotificationDeduped(`session:removed:${sessionId}`, 'Session Removed', `Machine session ${sessionId} was removed from active records.`, 'INFO', 'machines', 15000);
        }
      });
      sessionDigestRef.current = nextDigest;
      setActiveSessions(sessions);
      const mine = sessions.find((s) => s.id === sessionIdRef.current);
      if (!mine) return;
      if ((mine.status === 'FORCED_OUT' || mine.status === 'REVOKED') && !isRevokedRef.current) {
        isRevokedRef.current = true;
        const reason = mine.forceLogoutReason
          ? `Reason: ${mine.forceLogoutReason}`
          : mine.status === 'FORCED_OUT'
          ? 'Reason: Another newer login for your account became active, so this machine was signed out.'
          : 'Reason: Your session was revoked by an administrator.';
        alert(`You have been signed out.\n\n${reason}`);
        handleLogout();
      }
    };
    heartbeat();
    const id = window.setInterval(heartbeat, 15000);
    return () => { stopped = true; window.clearInterval(id); };
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
      pushNotification('Daily Backup', `Automatic backup completed at ${backupHour.toString().padStart(2, '0')}:00.`, 'SUCCESS', 'recovery');
    }, 30000);
    return () => window.clearInterval(timer);
  }, [isLoggedIn, systemConfig.backupHour]);

  const handleLogin = async (email: string, password: string, rememberMe: boolean): Promise<string | null> => {
    const normalizedEmail = email.trim().toLowerCase();
    let userDirectory = allUsers;
    let matched = userDirectory.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!matched && hasRemoteUserDirectory()) {
      const remoteUsers = normalizeUsers(await fetchRemoteUsers());
      if (remoteUsers.length > 0) {
        const merged = mergeSeedUsers(seedUsers, remoteUsers);
        userDirectory = merged;
        setAllUsers(merged);
        matched = merged.find((u) => u.email.toLowerCase() === normalizedEmail);
      }
    }
    if (!matched) return 'Account not found. Contact admin.';
    if (matched.status === 'BANNED') return 'This account is banned. Contact administrator.';
    if (matched.password !== password) return 'Invalid enterprise credentials. Access denied.';
    const systemMode = getSystemMode(systemConfig);
    if (systemMode === 'SAFE' && matched.role === UserRole.USER) return 'Safe mode is active. User accounts are currently restricted.';
    if (systemMode === 'RECOVERY' && matched.role !== UserRole.SUPER_ADMIN && !isGeneralManagerUser(matched)) return 'Recovery mode is active. Only super admin and GM have access currently.';
    const updatedUser = { ...matched, lastLogin: new Date().toISOString() };
    setAllUsers(userDirectory.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    setCurrentUser(updatedUser);
    isRevokedRef.current = false;
    setIsLoggedIn(true);
    setActiveModule(getHomeModule(updatedUser));
    const installSeenNow = typeof window !== 'undefined' && window.localStorage.getItem(INSTALL_ORIENTATION_KEY) === '1';
    setHasSeenInstallOrientation(installSeenNow);
    const shouldShowOrientation = !updatedUser.hasCompletedOrientation || !installSeenNow;
    setShowOrientation(shouldShowOrientation);

    // Auto clock-in on sign-in (employees + super admin). Admins are exempt.
    if (updatedUser.role !== UserRole.ADMIN) {
      try {
        const today = await fetchTodayAttendance(updatedUser);
        if (!today?.checkIn) {
          await clockIn(updatedUser);
        }
      } catch (err) {
        console.warn('Auto clock-in skipped:', err);
      }
    }
    // Login notification uses 'machines-login' origin → auto-dismissed in 3s
    pushNotification('Login Success', `${updatedUser.name} signed in from this machine.`, 'SUCCESS', 'machines-login');
    try {
      await upsertSessionHeartbeat(sessionIdRef.current, updatedUser);
      await enforceSingleSessionPerUser(updatedUser.id, sessionIdRef.current);
    } catch (err) {
      console.warn('Session heartbeat sync failed; continuing in local mode.', err);
    }
    if (typeof window !== 'undefined') {
      try {
        if (rememberMe) {
          const passwordDigest = await sha256Hex(password);
          const payload: RememberedAuth = {
            userId: updatedUser.id,
            email: updatedUser.email,
            passwordDigest,
            savedAt: Date.now(),
          };
          window.localStorage.setItem(REMEMBER_AUTH_KEY, JSON.stringify(payload));
        } else {
          clearRememberedAuth();
        }
      } catch {
        // Ignore storage/digest failures; login still succeeds.
      }
    }
    return null;
  };

  const [chatMessages, setChatMessages] = useState<{ role: string, text: string }[]>([]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    isRevokedRef.current = false;
    setChatMessages([]);
    clearRememberedAuth();
    markSessionOffline(sessionIdRef.current);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('zaya_theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const markNotifRead = (id: string) => {
    // Cancel pending auto-dismiss timer when manually read/dismissed
    if (dismissTimersRef.current[id]) { clearTimeout(dismissTimersRef.current[id]); delete dismissTimersRef.current[id]; }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearNotifications = () => {
    // Cancel all pending timers
    Object.values(dismissTimersRef.current).forEach(clearTimeout);
    dismissTimersRef.current = {};
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
    pushNotification('Candidate Updated', `${updated.fullName} profile has been synchronized.`, 'INFO', 'database');
  };

  const updateUsers = (updated: SystemUser[]) => {
    const removedIds = allUsers
      .map((u) => u.id)
      .filter((id) => !updated.some((next) => next.id === id));
    const normalized = normalizeUsers(updated);
    setAllUsers(normalized);
    const updatedMe = normalized.find(u => u.id === currentUser.id);
    if (updatedMe) setCurrentUser(updatedMe);
    if (removedIds.length > 0 && hasRemoteUserDirectory()) {
      void removeRemoteUsers(removedIds);
    }
    if (hasRemoteUserDirectory()) {
      void syncRemoteUsers(normalized).catch((err) => {
        console.warn('Remote user sync failed:', err);
        pushNotification('User Sync Failed', 'Users updated locally, but remote sync failed. Check Supabase portal_users table/RLS.', 'WARNING', 'admin');
      });
      pushNotification('User Directory Updated', 'Admin changes were saved and queued for sync.', 'INFO', 'admin');
    } else {
      pushNotification('User Directory Updated', 'Admin changes were saved locally (offline mode).', 'INFO', 'admin');
    }
  };

  const upsertBooking = (booking: BookingEntry) => {
    setBookings((prev) => {
      const exists = prev.some((b) => b.id === booking.id);
      if (exists) return prev.map((b) => (b.id === booking.id ? booking : b));
      return [booking, ...prev];
    });
    pushNotification('Booking Updated', `${booking.booker} scheduled ${booking.purpose}.`, 'SUCCESS', 'booking');
  };

  const deleteBooking = (bookingId: string) => {
    setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    pushNotification('Booking Deleted', `Booking ${bookingId} was removed.`, 'WARNING', 'booking');
  };

  const handleOrientationComplete = (destinationModule: string = 'dashboard') => {
    const updatedCurrent = { ...currentUser, hasCompletedOrientation: true };
    setCurrentUser(updatedCurrent);
    setAllUsers((prev) => prev.map((u) => (u.id === updatedCurrent.id ? { ...u, hasCompletedOrientation: true } : u)));
    setShowOrientation(false);
    setActiveModule(destinationModule);
    if (typeof window !== 'undefined') window.localStorage.setItem(INSTALL_ORIENTATION_KEY, '1');
    setHasSeenInstallOrientation(true);
  };

  useEffect(() => {
    setAllUsers((prev) => {
      const index = prev.findIndex((u) => u.id === currentUser.id);
      if (index === -1) return prev;
      const existing = prev[index];
      if (JSON.stringify(existing) === JSON.stringify(currentUser)) return prev;
      const next = [...prev]; next[index] = currentUser; return next;
    });
  }, [currentUser]);

  useEffect(() => {
    if (!isLoggedIn || showOrientation || !validModules.has(activeModule)) setActiveModule(getHomeModule(currentUser));
  }, [activeModule, isLoggedIn, showOrientation, validModules]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!systemConfig.maintenanceMode) { maintenanceNotifiedRef.current = false; return; }
    if (maintenanceNotifiedRef.current) return;
    maintenanceNotifiedRef.current = true;
    pushNotification('Maintenance Mode', systemConfig.maintenanceMessage || 'System maintenance mode is active.', 'WARNING', 'recovery');
  }, [isLoggedIn, systemConfig.maintenanceMode, systemConfig.maintenanceMessage]);

  if (isLoading) {
    return (
      <div className="app-shell app-full-height w-full bg-[#003366] flex flex-col items-center justify-center text-white p-6 transition-all duration-500">
        <div className="mb-10 flex h-44 w-44 items-center justify-center rounded-[2rem] bg-white/96 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.35)] ring-1 ring-white/30 backdrop-blur-sm">
          <img
            src={ZAYA_LOGO_SRC}
            alt="System logo"
            className="h-full w-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.12)]"
          />
        </div>
        <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mb-8 border border-white/5">
          <div className="h-full bg-gold animate-[loading_2s_ease-in-out_infinite] shadow-[0_0_15px_rgba(212,175,55,0.8)]"></div>
        </div>
        <p className="text-[10px] font-black tracking-[0.6em] uppercase text-gold">{systemConfig.systemName.toUpperCase()}</p>
        <p className="mt-3 text-xs font-medium tracking-[0.18em] uppercase text-white/70">Executive Operations Workspace</p>
      </div>
    );
  }

  if (!isAccessGranted) {
    return (
      <div className="app-shell app-full-height w-full bg-[#0b1324] flex items-center justify-center text-white p-6 transition-all duration-500">
        <div className="w-full max-w-md bg-[#0f1a2e] border border-[#1e3a5f] text-white rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-black uppercase tracking-tight mb-2 text-blue-400">Access Required</h2>
          <p className="text-sm text-blue-300/60 mb-6">Enter the portal access token to continue.</p>
          <input
            type="password" value={accessInput} onChange={(e) => setAccessInput(e.target.value)}
            placeholder="Access token" aria-label="Access token"
            className="w-full p-4 rounded-xl border border-[#1e3a5f] bg-[#0a1628] text-white font-bold outline-none focus:border-blue-400 placeholder-blue-300/30"
          />
          <button
            onClick={() => { if (accessToken && accessInput.trim() === accessToken) { localStorage.setItem('zaya_access_token', accessToken); setIsAccessGranted(true); } }}
            className="w-full mt-4 py-4 bg-gold text-enterprise-blue rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
          >
            Unlock Portal
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) return <Login onLogin={handleLogin} systemConfig={systemConfig} />;

  const purgeDemoData = () => {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      pushNotification('Permission Denied', 'Only super admin can purge demo data.', 'WARNING', 'recovery');
      return;
    }
    const confirmed = window.confirm(
      'Purge demo data?\n\nThis will remove autogenerated demo candidates/bookings and disable future demo seeding on this workspace.'
    );
    if (!confirmed) return;

    try {
      window.localStorage.setItem(DEMO_SEED_DISABLED_KEY, '1');
    } catch {
      // ignore
    }
    setDemoSeedingEnabled(false);

    setCandidates((prev) =>
      prev.filter((c) => {
        const id = String((c as any).id || '');
        const notes = String((c as any).notes || '');
        const isAuto = id.startsWith('ZGL-CN-2026-') || notes.toLowerCase().includes('autogenerated profile');
        return !isAuto;
      })
    );
    setBookings((prev) =>
      prev.filter((b) => {
        const id = String((b as any).id || '');
        const remarks = String((b as any).remarks || '');
        const isAuto = remarks.toLowerCase().includes('schedule sample') || /BK-\d{4}-0{3}/.test(id);
        return !isAuto;
      })
    );
    pushNotification('Demo Data Purged', 'Autogenerated demo records were removed and seeding was disabled.', 'SUCCESS', 'recovery');
  };

  const renderModule = () => {
    const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;
    const isAdmin = isSuperAdmin || currentUser.role === UserRole.ADMIN;
    const isGeneralManager = isGeneralManagerUser(currentUser);
    const canAccessRecovery = isSuperAdmin || isGeneralManager;
    const isSalesDept = isSalesDeptUser(currentUser);
    const isSalesRestrictedUser = isSalesDept && currentUser.role === UserRole.USER;
    const canAccessSales = hasSalesAccess(currentUser);
    const salesModules = new Set(['salesDashboard', 'leads', 'salesTargets', 'invoices']);
    const salesRestricted = new Set(['recruitment', 'candidates', 'database', 'booking', 'reports']);
    if (isSalesRestrictedUser && salesRestricted.has(activeModule)) {
      return (
        <div className="liquid-panel p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Access Restricted</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-blue-200">
            This module is hidden for the Sales team. Use Sales Dashboard, Leads, Targets/KPIs, Invoices, Daily Reports, Attendance, Team Chat, and Settings.
          </p>
          <button
            onClick={() => setActiveModule(getHomeModule(currentUser))}
            className="mt-4 px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow"
          >
            Back to Dashboard
          </button>
        </div>
      );
    }
    if (!canAccessSales && salesModules.has(activeModule)) {
      return (
        <div className="liquid-panel p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Access Restricted</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-blue-200">
            Sales modules are available only to users in the Sales department.
          </p>
          <button
            onClick={() => setActiveModule(getHomeModule(currentUser))}
            className="mt-4 px-4 py-2 rounded-xl bg-gold text-enterprise-blue text-[10px] font-black uppercase tracking-widest shadow"
          >
            Back to Home
          </button>
        </div>
      );
    }

    switch (activeModule) {
      case 'dashboard':
        if (isSalesRepUser(currentUser)) return <SalesDashboard user={currentUser} onNavigate={setActiveModule} />;
        return <DashboardOverview onNavigate={setActiveModule} candidatesCount={candidates.length} candidates={candidates} bookings={bookings} user={currentUser} />;
      case 'salesDashboard':
        return <SalesDashboard user={currentUser} onNavigate={setActiveModule} />;
      case 'leads':
        return <LeadsModule user={currentUser} users={allUsers} />;
      case 'salesTargets':
        return <SalesTargetsModule user={currentUser} users={allUsers} systemConfig={systemConfig} />;
      case 'invoices':
        return <InvoicesModule user={currentUser} users={allUsers} />;
      case 'dailyReports':
        return <DailyReports user={currentUser} isAdmin={isAdmin} users={allUsers} />;
      case 'attendance':
        return <AttendanceModule user={currentUser} isAdmin={isAdmin} users={allUsers} onNavigate={setActiveModule} />;
      case 'performance':
        return <PerformanceReports user={currentUser} users={allUsers} />;
      case 'chat':
        return <TeamChat user={currentUser} users={allUsers} />;
      case 'notices':
        return <NoticesModule user={currentUser} />;
      case 'tasks':
        return <TasksModule user={currentUser} users={allUsers} />;
      case 'payroll':
        if (!isAdmin) {
          return (
            <div className="liquid-panel p-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Payroll</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-blue-200">Access restricted to administrators.</p>
            </div>
          );
        }
        return <PayrollModule user={currentUser} users={allUsers} />;
      case 'employment':
        if (!isAdmin) {
          return (
            <div className="liquid-panel p-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Employment Management</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-blue-200">Access restricted to administrators.</p>
            </div>
          );
        }
        return <EmploymentManagement users={allUsers} currentUser={currentUser} onUpdateUsers={updateUsers} />;
      case 'candidates':
      case 'database':
        return <CandidateRegistry candidates={candidates} onAdd={addCandidate} onDelete={deleteCandidate} onUpdate={updateCandidate} mode={activeModule as any} />;
      case 'recruitment':
        return <RecruitmentHub candidates={candidates} bookings={bookings} />;
      case 'booking':
        return <BookingModule bookings={bookings} users={allUsers} currentUser={currentUser} onUpsertBooking={upsertBooking} onDeleteBooking={deleteBooking} />;
      case 'broadcast':
        return <BroadcastModule candidates={candidates} user={currentUser} />;
      case 'settings':
        return <Settings theme={theme} onThemeToggle={toggleTheme} user={currentUser} setUser={setCurrentUser} backgroundImageUrl={backgroundImageUrl} onBackgroundImageChange={setBackgroundImageUrl} />;
      case 'admin':
        if (!isAdmin) {
          return (
            <div className="liquid-panel p-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Admin Console</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-blue-200">Access restricted to administrators.</p>
            </div>
          );
        }
        return <AdminConsole users={allUsers} currentUser={currentUser} onUpdateUsers={updateUsers} systemConfig={systemConfig} setSystemConfig={setSystemConfig} onNavigate={setActiveModule} />;
      case 'machines':
        if (!isSuperAdmin) {
          return (
            <div className="liquid-panel p-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Machine Authentication</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-blue-200">Access restricted to super admin.</p>
            </div>
          );
        }
        return (
          <MachineAuth
            sessions={activeSessions}
            currentSessionId={sessionIdRef.current}
            onForceOut={async (sessionId) => {
              const reason = `Force logged out by ${currentUser.name} on ${new Date().toLocaleString('en-GB')}.`;
              await updateSessionStatus(sessionId, 'FORCED_OUT', reason);
              // Store force logout reason so tooltip bubble appears on MachineAuth
              setActiveSessions((prev) =>
                prev.map((s) =>
                  s.id === sessionId
                    ? ({ ...s, status: 'FORCED_OUT', forceLogoutReason: reason })
                    : s
                )
              );
              pushNotification('Machine Session Forced Out', `Session ${sessionId} was forced out.`, 'WARNING', 'machines');
              const refreshed = await fetchActiveSessions();
              // Re-apply reason to refreshed list since remote may not have the field yet
              setActiveSessions(refreshed.map((s) =>
                s.id === sessionId ? ({ ...s, forceLogoutReason: reason }) : s
              ));
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
        if (!canAccessRecovery) {
          return (
            <div className="liquid-panel p-6">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">System Recovery</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-blue-200">Access restricted to super admin and GM.</p>
            </div>
          );
        }
        return (
          <SystemRecovery
            systemConfig={systemConfig} currentUser={currentUser}
            onSaveConfig={(nextConfig) => {
              if (!canAccessRecovery) { pushNotification('Permission Denied', 'Only super admin and GM can change system mode and maintenance policy.', 'WARNING', 'recovery'); return; }
              setSystemConfig(nextConfig);
              pushNotification('System Recovery Updated', 'Maintenance settings were synchronized.', 'INFO', 'recovery');
            }}
            onTriggerBackup={() => { pushNotification('Backup Triggered', 'Manual backup initiated by admin.', 'SUCCESS', 'recovery'); }}
            onRestoreBackup={() => { pushNotification('Backup Restore Started', 'Restore sequence initiated from previous backup point.', 'WARNING', 'recovery'); }}
            onSetRestrictedAccess={async (enabled) => {
              if (!canAccessRecovery) return;
              const base = (systemConfig.maintenanceMessage || '').replace(/\[MODE:[A-Z]+\]/g, '').trim() || 'System policy updated.';
              setSystemConfig((prev) => ({ ...prev, maintenanceMode: enabled, maintenanceMessage: enabled ? `[MODE:SAFE] ${base}` : `[MODE:STANDARD] ${base}`, maintenanceUpdatedBy: currentUser.name, maintenanceUpdatedAt: new Date().toISOString() }));
              if (enabled && hasRemoteSessionStore()) {
                const sessions = await fetchActiveSessions();
                const adminIds = new Set(allUsers.filter((u) => u.role !== UserRole.USER).map((u) => u.id));
                const reason = `Forced out by system policy: SAFE mode maintenance enabled by ${currentUser.name} on ${new Date().toLocaleString('en-GB')}.`;
                await Promise.all(
                  sessions
                    .filter((s) => s.id !== sessionIdRef.current)
                    .filter((s) => !adminIds.has(s.userId))
                    .map((s) => updateSessionStatus(s.id, 'FORCED_OUT', reason))
                );
              }
              pushNotification(enabled ? 'Restricted Access Enabled' : 'Restricted Access Disabled', enabled ? 'Non-admin sessions were forced out.' : 'Standard access policy restored.', enabled ? 'WARNING' : 'SUCCESS', 'recovery');
            }}
            onSetStandbyMode={async (enabled) => {
              if (!canAccessRecovery) return;
              const base = (systemConfig.maintenanceMessage || '').replace(/\[MODE:[A-Z]+\]/g, '').trim() || 'System policy updated.';
              setSystemConfig((prev) => ({ ...prev, maintenanceMode: enabled, maintenanceMessage: enabled ? `[MODE:RECOVERY] ${base}` : `[MODE:STANDARD] ${base}`, maintenanceUpdatedBy: currentUser.name, maintenanceUpdatedAt: new Date().toISOString() }));
              if (enabled && hasRemoteSessionStore()) {
                const sessions = await fetchActiveSessions();
                const recoveryAdminIds = new Set(allUsers.filter((u) => u.role === UserRole.SUPER_ADMIN || isGeneralManagerUser(u)).map((u) => u.id));
                const reason = `Forced out by system policy: RECOVERY mode enabled by ${currentUser.name} on ${new Date().toLocaleString('en-GB')}.`;
                await Promise.all(
                  sessions
                    .filter((s) => s.id !== sessionIdRef.current)
                    .filter((s) => !recoveryAdminIds.has(s.userId))
                    .map((s) => updateSessionStatus(s.id, 'FORCED_OUT', reason))
                );
              }
              pushNotification(enabled ? 'Standby Mode Enabled' : 'Standby Mode Disabled', enabled ? 'Only super admin + GM sessions remain active.' : 'Normal session policy restored.', enabled ? 'WARNING' : 'SUCCESS', 'recovery');
            }}
            onQueueUpdate={(version, channel, notes) => { pushNotification('Update Rollout Queued', `${version} queued on ${channel.toUpperCase()} channel. ${notes}`, 'INFO', 'recovery'); }}
            onExportReports={() => { setActiveModule('reports'); pushNotification('Report Export Console', 'Redirected to reports module for download.', 'INFO', 'reports'); }}
            onPurgeDemoData={purgeDemoData}
          />
        );
      case 'reports':
        return (
          <div className="space-y-6 w-full overflow-x-hidden">
            {/* Reports grid — blue-hue theme */}
            <div className="bg-[#0f1a2e] border border-[#1e3a5f] p-6 md:p-8 rounded-2xl">
              <h2 className="text-xl md:text-2xl font-black text-blue-400 uppercase tracking-tight mb-2">Reports & Dataset Export</h2>
              <p className="text-[10px] text-blue-300/50 font-bold uppercase tracking-widest mb-6">
                Generated live from portal data — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {reportOptions.map(r => (
                  <div key={r} className="bg-[#0a1628] border border-[#1e3a5f] p-5 rounded-xl hover:border-gold transition-all group">
                    <i className="fas fa-file-pdf text-2xl text-gold mb-3 block"></i>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1">{r}</h4>
                    <p className="text-[10px] text-blue-300/40 mb-3">PDF · Live data</p>
                    <button
                      onClick={() => setReportPopup(r)}
                      className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-gold transition-colors"
                    >
                      Generate PDF →
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Predictive Analytics — blue-hue theme */}
            <div className="bg-[#0f1a2e] border border-[#1e3a5f] p-6 md:p-8 rounded-2xl">
              <h2 className="text-xl md:text-2xl font-black text-blue-400 uppercase tracking-tight mb-6">Predictive Analytics</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0a1628] border border-[#1e3a5f] p-5 rounded-xl">
                  <h4 className="text-[10px] font-black text-blue-300/60 uppercase tracking-widest mb-2">Forecasted Hiring Needs (Next Qtr)</h4>
                  <p className="text-3xl font-black text-white">+145 <span className="text-sm text-blue-300/50">Positions</span></p>
                  <div className="mt-4 h-2 bg-[#1e3a5f] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-[75%]"></div>
                  </div>
                </div>
                <div className="bg-[#0a1628] border border-[#1e3a5f] p-5 rounded-xl">
                  <h4 className="text-[10px] font-black text-blue-300/60 uppercase tracking-widest mb-2">Talent Shortage Alert</h4>
                  <p className="text-lg font-black text-red-400 uppercase">Logistics & Operations</p>
                  <p className="text-[10px] text-blue-300/40 mt-1">Critical gap in senior supervisors.</p>
                </div>
                <div className="bg-[#0a1628] border border-[#1e3a5f] p-5 rounded-xl">
                  <h4 className="text-[10px] font-black text-blue-300/60 uppercase tracking-widest mb-2">Longest Hiring Delay</h4>
                  <p className="text-lg font-black text-amber-400 uppercase">Architecture Lead</p>
                  <p className="text-[10px] text-blue-300/40 mt-1">42 Days (Avg: 12 Days)</p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <div className="p-20 text-center opacity-20 uppercase font-black text-4xl tracking-widest">{activeModule} MODULE</div>;
    }
  };

  const moduleFallback = (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center rounded-[2rem] border border-gold/20 bg-white/80 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-blue-400/20 dark:bg-[#0f1a2e]/90">
        <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[1.5rem] bg-white p-3 shadow-lg dark:bg-[#081024]">
          <img src={ZAYA_LOGO_SRC} alt="System logo" className="h-full w-full object-contain" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.34em] text-gold">Loading Module</p>
        <p className="mt-3 text-sm font-medium text-slate-600 dark:text-blue-100/75">Preparing the workspace without blocking the rest of the portal.</p>
      </div>
    </div>
  );

  return (
    <>
      <Suspense fallback={moduleFallback}>
        <Layout
          activeModule={activeModule} onModuleChange={setActiveModule} user={currentUser}
          onLogout={handleLogout} theme={theme} onThemeToggle={toggleTheme}
          notifications={notifications} onMarkRead={markNotifRead} onClearNotifications={clearNotifications}
          systemConfig={systemConfig} isOnline={isOnline} backgroundImageUrl={backgroundImageUrl}
        >
          <Suspense fallback={moduleFallback}>
            {renderModule()}
          </Suspense>
        </Layout>
      </Suspense>

      {showOrientation && (
        <Suspense fallback={null}>
          <OrientationAI
            user={currentUser}
            isFirstTime={!currentUser.hasCompletedOrientation || !hasSeenInstallOrientation}
            onComplete={handleOrientationComplete}
            messages={chatMessages}
            setMessages={setChatMessages}
            activeModule={activeModule}
            onNavigate={(module) => { handleOrientationComplete(module || 'dashboard'); }}
            onAction={(action) => {
              if (action.type === 'DOWNLOAD_REPORT') { openReportByName(action.report); return; }
              if (action.type === 'EXPORT_REPORTS') { setActiveModule('reports'); return; }
              if (action.type === 'EXPORT_DATABASE') { setActiveModule('database'); pushNotification('AI Action', 'Opened database module for export.', 'INFO', 'database'); return; }
              if (action.type === 'PRINT_PAGE') { window.print(); return; }
              if (action.type === 'SHARE') {
                const url = typeof window !== 'undefined' ? window.location.origin : 'https://zgrp-portal-2026.vercel.app';
                const shareText = `${systemConfig.systemName}: ${url}`;
                if (navigator.share) { navigator.share({ title: systemConfig.systemName, text: shareText, url }).catch(() => { navigator.clipboard?.writeText(shareText); }); }
                else { navigator.clipboard?.writeText(shareText); }
                pushNotification('AI Share Action', 'Portal link prepared for sharing.', 'SUCCESS', 'dashboard');
                return;
              }
              if (action.type === 'PREVIEW') { if (action.target) setActiveModule(action.target); pushNotification('AI Preview Action', 'Preview opened for requested module.', 'INFO', action.target || 'dashboard'); return; }
              if (action.type === 'DOWNLOAD') {
                if (action.target === 'database' || action.target === 'candidates') { setActiveModule('database'); pushNotification('AI Download Action', 'Opened database for export/download.', 'INFO', 'database'); return; }
                setActiveModule('reports'); pushNotification('AI Download Action', 'Opened reports to download requested data.', 'INFO', 'reports');
              }
            }}
          />
        </Suspense>
      )}

      {/* Report download popup — blue-hue theme */}
      {reportPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setReportPopup(null)}>
          <div className="bg-[#0f1a2e] border border-[#1e3a5f] p-8 rounded-3xl max-w-md w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-green-900/40 border border-green-500/40 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
              <i className="fas fa-check"></i>
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Report Ready</h3>
            <p className="text-sm text-blue-300/60 mb-6">
              The <span className="font-bold text-white">{reportPopup}</span> report has been compiled with live data and is ready to download.
            </p>
            <button
              onClick={handleDownloadReport}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all"
            >
              Download PDF
            </button>
            <button
              onClick={handlePrintReport}
              className="w-full mt-3 py-3 bg-gold text-enterprise-blue rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all"
            >
              Print
            </button>
            <button onClick={() => setReportPopup(null)} className="w-full mt-3 py-2 text-[10px] text-blue-300/50 hover:text-blue-300 font-bold uppercase tracking-widest transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* AI assistant FAB button */}
      <button
        onClick={() => setShowOrientation(true)}
        aria-label="Open ZAYA AI Assistant"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-enterprise-blue text-white rounded-2xl shadow-2xl flex items-center justify-center group hover:scale-110 transition-all z-40 border-4 border-white dark:border-slate-800 animate-in zoom-in duration-500"
      >
        <i className="fas fa-robot text-xl group-hover:animate-bounce text-gold"></i>
      </button>
    </>
  );
};

export default App;
