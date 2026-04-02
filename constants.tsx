
import {
  Candidate,
  RecruitmentStatus,
  UserRole,
  SystemUser,
  AuthorizedMachine,
  BookingEntry,
} from './types';

export const INITIAL_CANDIDATES: Candidate[] = [
];

export const MOCK_USER: SystemUser = {
  id: 'USR-001',
  name: 'George Wasley',
  email: 'it@zayagroupltd.com',
  phone: '+255650787961',
  password: 'Kingsley06#',
  hasCompletedOrientation: false,
  role: UserRole.SUPER_ADMIN,
  department: 'IT Department',
  jobTitle: 'Head of Department',
  lastLogin: new Date().toISOString(),
  avatar: 'https://picsum.photos/seed/alex/200/200',
  status: 'ACTIVE',
  baseSalary: 500000,
};

export const MOCK_USERS: SystemUser[] = [
  MOCK_USER,
  { id: 'USR-004', name: 'Asya Afidh', email: 'gm@zayagroupltd.com', password: 'Zaya@123', hasCompletedOrientation: false, role: UserRole.ADMIN, department: 'Executive', jobTitle: 'General Manager', lastLogin: 'Never', avatar: 'https://ui-avatars.com/api/?name=Asya%20Afidh', status: 'ACTIVE' },
  { id: 'USR-002', name: 'Christopher Njoroge', email: 'christopher@zayagroupltd.com', password: 'Chris#2026', hasCompletedOrientation: false, role: UserRole.ADMIN, department: 'Operations', jobTitle: 'Operations Manager', lastLogin: 'Never', avatar: 'https://ui-avatars.com/api/?name=Christopher%20Njoroge', status: 'ACTIVE' },
  { id: 'USR-003', name: 'Zahra Mohamed', email: 'zahra@zayagroupltd.com', password: 'Zahra#2026', hasCompletedOrientation: false, role: UserRole.USER, department: 'HR', jobTitle: 'Receptionist', lastLogin: 'Never', avatar: 'https://ui-avatars.com/api/?name=Zahra%20Mohamed', status: 'ACTIVE', baseSalary: 300000 },
  { id: 'USR-005', name: 'Sales Manager', email: 'info@zayagroupltd.com', password: 'Zaya@123', hasCompletedOrientation: false, role: UserRole.USER, department: 'Sales', jobTitle: 'Sales Manager', lastLogin: 'Never', avatar: 'https://ui-avatars.com/api/?name=Sales%20Manager', status: 'ACTIVE' },
];

export const MOCK_MACHINES: AuthorizedMachine[] = [];

export const INITIAL_BOOKINGS: BookingEntry[] = [
];

export const DEPARTMENTS = ['Executive', 'HR', 'Finance', 'Logistics', 'Operations', 'IT Support'];
