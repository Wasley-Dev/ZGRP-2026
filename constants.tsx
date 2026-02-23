
import {
  Candidate,
  RecruitmentStatus,
  UserRole,
  SystemUser,
  AuthorizedMachine,
  BookingEntry,
} from './types';

export const INITIAL_CANDIDATES: Candidate[] = [
  {
    id: 'ZGL-CN-2024-00001',
    fullName: 'Amara Diop',
    gender: 'F',
    phone: '+255 779 630 201',
    email: 'amara.diop@example.com',
    dob: '1995-04-12',
    age: 29,
    address: 'Stone Town, Zanzibar',
    occupation: 'Software Engineer',
    experienceYears: 5,
    positionApplied: 'Senior Dev',
    status: RecruitmentStatus.INTERVIEW,
    documents: { cv: 'COMPLETE', id: 'COMPLETE', certificates: 'INCOMPLETE', tin: 'NONE' },
    createdAt: '2024-01-15T08:30:00Z',
    source: 'LinkedIn'
  },
  {
    id: 'ZGL-CN-2024-00002',
    fullName: 'Said Khamis',
    gender: 'M',
    phone: '+255 621 555 123',
    email: 'said.khamis@example.com',
    dob: '1992-08-20',
    age: 32,
    address: 'Dar es Salaam, Tanzania',
    occupation: 'Logistics Manager',
    experienceYears: 8,
    positionApplied: 'Operations Lead',
    status: RecruitmentStatus.DEPLOYMENT,
    documents: { cv: 'COMPLETE', id: 'COMPLETE', certificates: 'COMPLETE', tin: 'COMPLETE' },
    createdAt: '2024-01-16T10:45:00Z',
    source: 'Referral'
  },
  {
    id: 'ZGL-CN-2024-00003',
    fullName: 'Fatima Juma',
    gender: 'F',
    phone: '+255 713 444 999',
    email: 'fatima.j@example.com',
    dob: '1998-02-14',
    age: 26,
    address: 'Arusha, Tanzania',
    occupation: 'HR Assistant',
    experienceYears: 3,
    positionApplied: 'HR Coordinator',
    status: RecruitmentStatus.PENDING,
    documents: { cv: 'COMPLETE', id: 'INCOMPLETE', certificates: 'NONE', tin: 'NONE' },
    createdAt: '2024-01-18T09:15:00Z',
    source: 'Website'
  },
  {
    id: 'ZGL-CN-2024-00004',
    fullName: 'John Doe',
    gender: 'M',
    phone: '+255 755 123 456',
    email: 'john.doe@example.com',
    dob: '1990-11-05',
    age: 34,
    address: 'Mwanza, Tanzania',
    occupation: 'Accountant',
    experienceYears: 10,
    positionApplied: 'Finance Manager',
    status: RecruitmentStatus.TRAINING,
    documents: { cv: 'COMPLETE', id: 'COMPLETE', certificates: 'COMPLETE', tin: 'INCOMPLETE' },
    createdAt: '2024-01-20T14:20:00Z',
    source: 'LinkedIn'
  },
  {
    id: 'ZGL-CN-2024-00005',
    fullName: 'Grace Mushi',
    gender: 'F',
    phone: '+255 688 777 222',
    email: 'grace.m@example.com',
    dob: '1996-06-30',
    age: 28,
    address: 'Dodoma, Tanzania',
    occupation: 'Marketing Specialist',
    experienceYears: 4,
    positionApplied: 'Marketing Lead',
    status: RecruitmentStatus.INTERVIEW,
    documents: { cv: 'COMPLETE', id: 'COMPLETE', certificates: 'COMPLETE', tin: 'COMPLETE' },
    createdAt: '2024-01-22T11:00:00Z',
    source: 'Agency'
  },
  {
    id: 'ZGL-CN-2024-00006',
    fullName: 'Emmanuel Joseph',
    gender: 'M',
    phone: '+255 766 888 111',
    email: 'emmanuel.j@example.com',
    dob: '1993-03-25',
    age: 31,
    address: 'Tanga, Tanzania',
    occupation: 'Civil Engineer',
    experienceYears: 6,
    positionApplied: 'Site Engineer',
    status: RecruitmentStatus.PENDING,
    documents: { cv: 'INCOMPLETE', id: 'NONE', certificates: 'NONE', tin: 'NONE' },
    createdAt: '2024-01-25T16:45:00Z',
    source: 'Referral'
  }
];

export const MOCK_USER: SystemUser = {
  id: 'USR-001',
  name: 'George Wasley',
  email: 'it@zayagroupltd.com',
  password: 'Kingsley06#',
  hasCompletedOrientation: false,
  role: UserRole.SUPER_ADMIN,
  department: 'IT Department',
  lastLogin: new Date().toISOString(),
  avatar: 'https://picsum.photos/seed/alex/200/200',
  status: 'ACTIVE'
};

export const MOCK_USERS: SystemUser[] = [
  MOCK_USER,
  { id: 'USR-002', name: 'Sarah Miller', email: 's.miller@zayagroupltd.com', password: 'Sarah#2026', hasCompletedOrientation: false, role: UserRole.ADMIN, department: 'HR', lastLogin: '2024-05-10T09:00:00Z', avatar: 'https://picsum.photos/seed/sarah/200/200', status: 'ACTIVE' },
  { id: 'USR-003', name: 'James Wilson', email: 'j.wilson@zayagroupltd.com', password: 'James#2026', hasCompletedOrientation: false, role: UserRole.USER, department: 'IT', lastLogin: '2024-05-09T14:30:00Z', avatar: 'https://picsum.photos/seed/james/200/200', status: 'ACTIVE' },
];

export const MOCK_MACHINES: AuthorizedMachine[] = [
  { id: 'MAC-001', name: 'HQ-FINANCE-01', os: 'Windows 11', ip: '192.168.1.45', lastActive: '2 mins ago', status: 'ONLINE' },
  { id: 'MAC-002', name: 'ZAY-LAPTOP-PRO', os: 'macOS Sonoma', ip: '10.0.0.12', lastActive: '5 mins ago', status: 'ONLINE' },
  { id: 'MAC-003', name: 'REC-TAB-04', os: 'Android 14', ip: '172.16.0.8', lastActive: '2 days ago', status: 'OFFLINE' },
];

export const INITIAL_BOOKINGS: BookingEntry[] = [
  {
    id: 'BK-001',
    booker: 'John M. Admin',
    time: '10:30',
    purpose: 'Technical Interview',
    remarks: 'Candidate highly skilled in React.',
    createdAt: '2026-02-20T10:30:00Z',
    createdByUserId: 'USR-001',
  },
  {
    id: 'BK-002',
    booker: 'Sarah HR',
    time: '13:15',
    purpose: 'Culture Fit Vetting',
    remarks: 'Rescheduled from previous day.',
    createdAt: '2026-02-21T13:15:00Z',
    createdByUserId: 'USR-002',
  },
];

export const DEPARTMENTS = ['Executive', 'HR', 'Finance', 'Logistics', 'Operations', 'IT Support'];
