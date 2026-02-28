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
  password: string;
  hasCompletedOrientation: boolean;
  role: UserRole;
  department: string;
  lastLogin: string;
  avatar?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'BANNED';
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
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  maintenanceUpdatedBy?: string;
  maintenanceUpdatedAt?: string;
  backupHour?: number;
}
