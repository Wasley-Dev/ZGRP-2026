
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export enum RecruitmentStatus {
  PENDING = 'PENDING',
  INTERVIEW = 'INTERVIEW',
  TRAINING = 'TRAINING',
  DEPLOYMENT = 'DEPLOYMENT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface DocumentStatus {
  cv: 'COMPLETE' | 'INCOMPLETE' | 'NONE';
  id: 'COMPLETE' | 'INCOMPLETE' | 'NONE';
  certificates: 'COMPLETE' | 'INCOMPLETE' | 'NONE';
  tin: 'COMPLETE' | 'INCOMPLETE' | 'NONE';
}

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
  status: RecruitmentStatus;
  documents: DocumentStatus;
  skills?: string[];
  photoUrl?: string;
  createdAt: string;
  notes?: string;
  source?: 'LinkedIn' | 'Website' | 'Referral' | 'Agencies';
}

export interface AuthorizedMachine {
  id: string;
  name: string;
  os: string;
  ip: string;
  lastActive: string;
  status: 'ONLINE' | 'OFFLINE' | 'SUSPICIOUS' | 'REVOKED';
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
  hasCompletedOrientation?: boolean;
  role: UserRole;
  department: string;
  avatar?: string;
  lastLogin: string;
  status: 'ACTIVE' | 'BANNED';
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'INFO' | 'WARNING' | 'SUCCESS';
  origin?: string;
  createdAt?: string;
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

export interface BookingEntry {
  id: string;
  booker: string;
  date: string;
  time: string;
  purpose: string;
  remarks: string;
  createdAt: string;
  createdByUserId: string;
}

export interface MachineSession {
  id: string;
  userId: string;
  userName: string;
  email: string;
  machineName: string;
  os: string;
  ip: string;
  lastSeenAt: string;
  isOnline: boolean;
  status: 'ACTIVE' | 'FORCED_OUT' | 'REVOKED';
}

export type ThemeMode = 'light' | 'dark';
