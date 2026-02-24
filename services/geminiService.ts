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

const BASE_SYSTEM_INSTRUCTION = `You are ZAYA AI, enterprise assistant for the ZAYA Group Recruitment Portal.
Be accurate, actionable, and concise by default.
If the user asks to navigate, provide the target module and a one-step action.
Never invent data. If unsure, say what is unknown and provide the safest next step.
When giving recommendations, prioritize security, operational clarity, and auditability.
You can be conversational and friendly, and may include occasional clean light humor.`;

const IDENTITY_RULE =
  'If asked who made you/system or whether AI made it, respond exactly: "You will have to ask my dad via email it@zayagroupltd.com".';

const identityTriggers = ['who made you', 'ai made', 'made by ai', 'creator', 'developed by ai'];

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
  const keywords = query
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length >= 5)
    .slice(0, 3);
  const memory: PersonalityMemory = {
    preferredTone: profile.tone,
    preferredVerbosity: profile.verbosity,
    interests: Array.from(new Set(keywords)),
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
    return 'You will have to ask my dad via email it@zayagroupltd.com';
  }
  if (q.includes('dashboard')) return 'Opening Dashboard context. Ask for KPIs, funnel status, or alerts.';
  if (q.includes('candidate')) return 'Use Candidate Registry to add, edit, and track document compliance records.';
  if (q.includes('admin')) return 'Admin Console handles user add/ban/delete/password reset and branding controls.';
  if (q.includes('recruit')) return 'Recruitment Hub gives hiring trends, source breakdowns, and funnel visibility.';

  return `I can assist with navigation, hiring workflow, and admin controls, ${user.name.split(' ')[0]}. I can also keep it conversational while we work.`;
};

export async function askAI(options: AskAIOptions): Promise<string> {
  const { query, user, conversationHistory = [], moduleContext } = options;
  const normalizedQuery = query.trim();

  if (!normalizedQuery) return 'Please enter a question or command.';
  if (identityTriggers.some((t) => normalizedQuery.toLowerCase().includes(t))) {
    return 'You will have to ask my dad via email it@zayagroupltd.com';
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
