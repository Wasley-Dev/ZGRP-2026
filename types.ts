export enum RecruitmentStatus {
  PENDING = 'PENDING',
  INTERVIEW = 'INTERVIEW',
  TRAINING = 'TRAINING',
  DEPLOYMENT = 'DEPLOYMENT',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export type ThemeMode = 'light' | 'dark';

export type NotificationType = 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';

export type CandidateDocumentState = 'NONE' | 'INCOMPLETE' | 'COMPLETE';

export interface UploadedSupplementalDocument {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  dataUrl: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  time?: string;
  read?: boolean;
  createdAt: string;
  origin?: string;
}

export interface CandidateDocuments {
  cv: CandidateDocumentState;
  id: CandidateDocumentState;
  certificates: CandidateDocumentState;
  tin: CandidateDocumentState;
  supplemental?: CandidateDocumentState;
  supplementalFiles?: UploadedSupplementalDocument[];
}

export type DocumentStatus = CandidateDocuments;

export interface Candidate {
  id: string;
  fullName: string;
  gender: 'M' | 'F';
  phone: string;
  email: string;
  dob: string;
  age: number;
  address: string;
  occupation: string;
  experienceYears: number;
  positionApplied: string;
  status: RecruitmentStatus | 'PENDING' | 'INTERVIEW' | 'TRAINING' | 'DEPLOYMENT';
  documents: CandidateDocuments;
  skills?: string[];
  createdAt: string;
  source?: string;
  photoUrl?: string;
  notes?: string;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
  hasCompletedOrientation: boolean;
  role: UserRole;
  department: string;
  jobTitle?: string;
  lastLogin: string;
  avatar?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BANNED';
  baseSalary?: number;
  allowancesTotal?: number;
  deductionsTotal?: number;
  performanceScore?: number;
}

export interface DailyReport {
  id: string;
  userId: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  checkIn: string;
  checkOut?: string;
  segments?: Array<{ in: string; out?: string }>;
}

export type AttendanceApprovalStatus = 'pending' | 'approved' | 'denied';

export interface AttendanceCheckoutRequest {
  id: string;
  attendanceId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  reason?: string;
  status: AttendanceApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
}

export interface TeamMessage {
  id: string;
  senderId: string;
  message: string;
  channel?: 'general' | 'sales' | string;
  createdAt: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export type TaskStatus = 'pending' | 'completed';

export interface TaskItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost';

export interface Lead {
  id: string;
  userId: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  status: LeadStatus;
  estimatedValue?: number;
  notes?: string;
  createdAt: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';

export interface Invoice {
  id: string;
  userId: string;
  invoiceNo: string;
  client: string;
  amount: number;
  status: InvoiceStatus;
  dueDate?: string; // YYYY-MM-DD
  createdAt: string;
}

export interface SalesTarget {
  id: string;
  userId: string;
  month: number; // 1-12
  year: number;
  leadsTarget: number;
  revenueTarget: number;
  createdAt: string;
}

export interface PayrollRecord {
  id: string;
  userId: string;
  month: number;
  year: number;
  basicSalary: number;
  allowancesTotal: number;
  deductionsTotal: number;
  netSalary: number;
  createdAt: string;
}

export interface PayrollRunInput {
  month: number; // 1-12
  year: number;
  workingDays?: number;
  defaultBasicSalary?: number;
  defaultAllowancesTotal?: number;
  defaultDeductionsTotal?: number;
  defaultPerformanceScore?: number;
}

export interface PayslipRecord {
  id: string;
  payrollId: string;
  breakdown: any;
  createdAt: string;
}

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';
export type LeaveRequestType = 'leave' | 'sick';

export interface LeaveRequest {
  id: string;
  userId: string;
  type: LeaveRequestType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  status: LeaveRequestStatus;
  createdAt: string;
}

export interface AuthorizedMachine {
  id: string;
  name: string;
  os: string;
  ip: string;
  lastActive: string;
  status: 'ONLINE' | 'OFFLINE';
}

export interface BookingEntry {
  id: string;
  booker: string;
  date?: string;
  time: string;
  purpose: string;
  remarks?: string;
  createdAt: string;
  createdByUserId?: string;
}

export interface MachineSession {
  id: string;
  userId: string;
  userName: string;
  email: string;
  machineName: string;
  os: string;
  ip: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  isOnline: boolean;
  status: 'ACTIVE' | 'OFFLINE' | 'TERMINATED' | 'FORCED_OUT' | 'REVOKED';
  forceLogoutReason?: string;
  forcedOutAt?: string;
  startedAt?: string;
  lastSeenAt: string;
}

export interface SystemConfig {
  systemName: string;
  logoIcon: string;
  loginHeroImage?: string;
  loginHeroImages?: string[];
  loginShowcaseTitle?: string;
  loginShowcaseSummary?: string;
  loginQuote?: string;
  loginQuoteAuthor?: string;
  loginFacts?: string[];
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  maintenanceUpdatedBy?: string;
  maintenanceUpdatedAt?: string;
  backupHour?: number;
}
