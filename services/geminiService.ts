import { GoogleGenAI } from '@google/genai';
import { SystemUser, UserRole } from '../types';

type ChatRole = 'user' | 'ai';

interface ChatMessage {
  role: ChatRole;
  text: string;
}

interface AskAIOptions {
  query: string;
  user: SystemUser;
  conversationHistory?: ChatMessage[];
  moduleContext?: string;
}

interface PersonalityProfile {
  tone: 'executive' | 'coach' | 'technical' | 'direct' | 'playful';
  verbosity: 'short' | 'balanced' | 'detailed';
  style: string;
}

interface PersonalityMemory {
  preferredTone?: PersonalityProfile['tone'];
  preferredVerbosity?: PersonalityProfile['verbosity'];
  interests?: string[];
  lastUpdatedAt?: string;
}

const RAW_API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
const API_KEY = RAW_API_KEY.trim();
const MODEL_NAME = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;
const MEMORY_KEY_PREFIX = 'zaya_personality_';

const BASE_SYSTEM_INSTRUCTION = `You are ZAYA AI — the cheerful, smart, and trustworthy assistant inside the Zaya Group Portal.

CORE BEHAVIOUR:
- Be accurate, actionable, and concise by default.
- Never invent data. If unsure, say what is unknown and provide the safest next step.
- If the user asks to navigate, name the target module and give a one-step action.
- If the user asks to print/export/share/preview/download, respond with explicit immediate execution wording.
- If the user asks for workflow help, provide short numbered steps and end with a recommended next action.
- You can answer general questions outside the portal, then optionally offer a portal-related follow-up if relevant.
- Prioritize security, operational clarity, and auditability.

ROLE + MODULE AWARENESS (IMPORTANT):
- Use "User role", "User department", and "Current module context" to tailor your answer.
- Employees: focus on Daily Reports, Attendance/Clocking, Tasks/Notices consumption, and Team Chat.
- Sales users: focus on Sales Dashboard, Leads, Targets/KPIs, Invoices, and lead-based Broadcast workflows.
- Admins: focus on publishing Notices, assigning Tasks, approvals, governance, and operational oversight.
- Super Admin: include system-level controls (System Recovery, Machine Authentication, access governance).

SYSTEM CAPABILITIES YOU KNOW:
1) Dashboard: KPIs, recruitment funnel, department performance, and (for admins) sales progress widgets.
2) Daily Reports: employees create write-once daily reports (no editing after submit).
3) Attendance: clock in/out, attendance logs, midday checkout request/approval.
4) Team Chat: organization chat + department chats; admins/super admins can view all departments.
5) Notices: admins publish; everyone views published notices.
6) Tasks: admins assign; employees see their tasks; admins update status (pending/completed/due).
7) Payroll (admins/super admins only): process payroll and generate payslips (PDF download).
8) Sales: sales dashboard, leads, targets/KPIs, invoices, and mass broadcast based on leads.
9) Employment Management (admins/super admins): employee directory and management tools.
10) Machine Authentication (super admin): live session/machine controls and device governance.
11) Admin Console: role/access controls, governance toggles, and migration helpers.
12) System Recovery (super admin): safe/recovery modes and maintenance utilities.

SECURITY + DATA HYGIENE:
- Never ask for or request secret keys/tokens/passwords in chat.
- If a user shares secrets, advise rotating them and moving them to environment variables.`;

const IDENTITY_RULE =
  'If asked who made you/system or whether AI made it, respond exactly: "You\'ll have to ask my dad about that! 😄 Reach him at it@zayagroupltd.com"';

const identityTriggers = [
  'who made you',
  'ai made',
  'made by ai',
  'creator',
  'developed by',
  'who built you',
  'who created you',
  'who made this system',
  'who built this system',
  'who is your dad',
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('AI request timed out')), ms);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const inferPersonality = (
  user: SystemUser,
  query: string,
  history: ChatMessage[] = [],
  memory?: PersonalityMemory
): PersonalityProfile => {
  const text = `${query} ${history.slice(-4).map((m) => m.text).join(' ')}`.toLowerCase();
  const isTechnical = /(error|bug|api|config|deploy|code|integrat|sync|issue|stack)/.test(text);
  const isHelpSeeking = /(how|help|guide|explain|what should|teach)/.test(text);
  const isConversational = /(joke|fun|chat|convers|friendly|playful|casual)/.test(text);
  const wantsShort = /(quick|short|brief|tldr|just answer)/.test(text) || query.length < 45;
  const executiveRole = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;

  if (memory?.preferredTone && memory?.preferredVerbosity) {
    return {
      tone: memory.preferredTone,
      verbosity: memory.preferredVerbosity,
      style: `Honor previous user preference. ${memory.interests?.length ? `Interests: ${memory.interests.join(', ')}` : ''}`,
    };
  }

  if (isTechnical) {
    return {
      tone: 'technical',
      verbosity: wantsShort ? 'short' : 'detailed',
      style: 'Use precise troubleshooting language and concrete steps.',
    };
  }

  if (isHelpSeeking) {
    return {
      tone: 'coach',
      verbosity: wantsShort ? 'balanced' : 'detailed',
      style: 'Use supportive guidance and sequence tasks clearly.',
    };
  }

  if (isConversational) {
    return {
      tone: 'playful',
      verbosity: wantsShort ? 'short' : 'balanced',
      style: 'Keep it warm and playful while still being accurate and actionable.',
    };
  }

  if (executiveRole) {
    return {
      tone: 'executive',
      verbosity: wantsShort ? 'short' : 'balanced',
      style: 'Use decision-oriented summaries and highlight impact/risk.',
    };
  }

  return {
    tone: 'direct',
    verbosity: wantsShort ? 'short' : 'balanced',
    style: 'Be clear, practical, and plain-language.',
  };
};

const readMemory = (userId: string): PersonalityMemory | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(`${MEMORY_KEY_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as PersonalityMemory) : undefined;
  } catch {
    return undefined;
  }
};

const writeMemory = (userId: string, profile: PersonalityProfile, query: string) => {
  if (typeof window === 'undefined') return;
  const previous = readMemory(userId);
  const keywords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length >= 5)
    .slice(0, 3);
  const mergedInterests = Array.from(new Set([...(previous?.interests || []), ...keywords])).slice(0, 10);
  const memory: PersonalityMemory = {
    preferredTone: previous?.preferredTone || profile.tone,
    preferredVerbosity: previous?.preferredVerbosity || profile.verbosity,
    interests: mergedInterests,
    lastUpdatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(`${MEMORY_KEY_PREFIX}${userId}`, JSON.stringify(memory));
};

const buildSystemInstruction = (profile: PersonalityProfile, user: SystemUser, moduleContext?: string) => {
  return `${BASE_SYSTEM_INSTRUCTION}
${IDENTITY_RULE}
User role: ${user.role}
User department: ${user.department}
Preferred tone: ${profile.tone}
Preferred verbosity: ${profile.verbosity}
Style guidance: ${profile.style}
Current module context: ${moduleContext || 'general navigation'}`;
};

const formatHistory = (history: ChatMessage[] = []) =>
  history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n');

const localFallback = (query: string, user: SystemUser): string => {
  const q = query.toLowerCase();
  if (identityTriggers.some((t) => q.includes(t))) {
    return "You'll have to ask my dad about that! 😄 Reach him at it@zayagroupltd.com";
  }
  if (q.includes('dashboard')) return 'Opening Dashboard context. Ask for KPIs, funnel status, or alerts.';
  if (q.includes('candidate')) return 'Use Candidate Registry to add, edit, and track document compliance records.';
  if (q.includes('admin')) return 'Admin Console handles user add/ban/delete/password reset and branding controls.';
  if (q.includes('recruit')) return 'Recruitment Hub gives hiring trends, source breakdowns, and funnel visibility.';
  if (q.includes('daily report') || q.includes('reporting')) return 'Daily Reports: submit a write-once report with title/description/date, then view it in your report list.';
  if (q.includes('attendance') || q.includes('clock in') || q.includes('clock out')) return 'Attendance: clock in/out from the dashboard and review your attendance logs.';
  if (q.includes('task')) return 'Tasks: admins assign tasks; you only see tasks assigned to you, and admins can mark them completed or due.';
  if (q.includes('notice')) return 'Notices: admins publish notices; all users can view published notices.';
  if (q.includes('chat')) return 'Team Chat: use Org chat for everyone and Department chat for your team; admins/super admins can view all departments.';
  if (q.includes('lead')) return 'Leads: create, view, edit, print, and download lead records (sales + admins).';
  if (q.includes('invoice')) return 'Invoices: create, view/edit, print, and download invoices (sales + admins).';
  if (q.includes('target') || q.includes('kpi') || q.includes('quota')) return 'Targets/KPIs: set quotas and track progress; admins/sales managers can manage targets, and everyone can view assigned targets.';
  if (q.includes('payroll') || q.includes('payslip')) return 'Payroll: admins/super admins process payroll and generate payslips with PDF download.';
  if (q.includes('employment') || q.includes('employee management')) return 'Employment Management: admins/super admins manage employee profiles, titles, departments, and access.';
  if (q.includes('broadcast')) return 'Broadcast: send campaigns via Email/SMS/WhatsApp; sales broadcast is lead-based.';
  if (q.includes('machine')) return 'Machine Authentication: super admin can view and revoke sessions/devices.';
  if (q.includes('recovery')) return 'System Recovery: super admin can enter safe/recovery modes and run maintenance actions.';
  if (/(how are you|who are you|what do you like|tell me about yourself|your personality)/.test(q)) {
    return `I am Zaya AI. I adapt to your style, keep responses practical, and I can switch from formal mode to playful mode when you want.`;
  }
  if (/(joke|funny|laugh)/.test(q)) {
    return 'Here is one: I run on clean data and strong coffee, but only one of us gets jittery.';
  }

  const firstName = user.name.split(' ')[0];
  const options = [
    `${firstName}, I can help with reports, bookings, admin controls, live sync, and general questions outside the portal.`,
    `Ready when you are, ${firstName}. I can handle navigation, exports, admin actions, and broader chatbot requests.`,
    `Let us do it. Give me the exact outcome you want and I will drive it step by step.`,
  ];
  const index = Math.abs([...q].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % options.length;
  return options[index];
};

export async function askAI(options: AskAIOptions): Promise<string> {
  const { query, user, conversationHistory = [], moduleContext } = options;
  const normalizedQuery = query.trim();

  if (!normalizedQuery) return 'Please enter a question or command.';
  if (identityTriggers.some((t) => normalizedQuery.toLowerCase().includes(t))) {
    return "You'll have to ask my dad about that! 😄 Reach him at it@zayagroupltd.com";
  }
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (!online) {
    return `${localFallback(normalizedQuery, user)} (Offline mode: system knowledge only.)`;
  }
  if (!API_KEY) return localFallback(normalizedQuery, user);

  const memory = readMemory(user.id);
  const profile = inferPersonality(user, normalizedQuery, conversationHistory, memory);
  const systemInstruction = buildSystemInstruction(profile, user, moduleContext);
  const historyBlock = formatHistory(conversationHistory);
  const composedPrompt = `Conversation history:\n${historyBlock || 'None'}\n\nUser request:\n${normalizedQuery}`;

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: composedPrompt,
          config: {
            systemInstruction,
            temperature: profile.tone === 'technical' ? 0.25 : profile.tone === 'playful' ? 0.72 : 0.5,
            tools: [{ googleSearch: {} }],
          },
        }),
        REQUEST_TIMEOUT_MS
      );

      let text = (response.text || '').trim();
      if (!text) text = 'I could not generate a response. Please try a more specific prompt.';

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const links = chunks
        .map((c: { web?: { uri?: string; title?: string } }) => c.web)
        .filter((web): web is { uri: string; title?: string } => !!web?.uri)
        .slice(0, 4)
        .map((web) => `- [${web.title || web.uri}](${web.uri})`);

      if (links.length > 0) {
        const uniqueLinks = Array.from(new Set(links));
        text += `\n\n**Verified Sources:**\n${uniqueLinks.join('\n')}`;
      }

      writeMemory(user.id, profile, normalizedQuery);
      return text;
    } catch (error) {
      const isLast = attempt >= MAX_RETRIES;
      if (isLast) {
        console.error('AI Assistant Error:', error);
        return localFallback(normalizedQuery, user);
      }
      await wait(350 * (attempt + 1));
    }
  }

  return localFallback(normalizedQuery, user);
}
