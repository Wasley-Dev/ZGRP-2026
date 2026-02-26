import React, { useState, useEffect } from 'react';
import { askAI } from '../services/geminiService';
import { SystemUser, UserRole } from '../types';

type ChatMessage = { role: string; text: string };
type AIAction =
  | { type: 'DOWNLOAD_REPORT'; report?: string }
  | { type: 'EXPORT_REPORTS' }
  | { type: 'PRINT_PAGE' }
  | { type: 'EXPORT_DATABASE' }
  | { type: 'SHARE' }
  | { type: 'PREVIEW'; target?: string }
  | { type: 'DOWNLOAD'; target?: string };

const OrientationAI: React.FC<{
  user: SystemUser;
  isFirstTime?: boolean;
  onComplete: (destinationModule?: string) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onNavigate?: (module: string) => void;
  onAction?: (action: AIAction) => void;
}> = ({ user, isFirstTime = false, onComplete, messages, setMessages, onNavigate, onAction }) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [showIdleHelp, setShowIdleHelp] = useState(false);
  const [showChat, setShowChat] = useState(false); // mobile: toggle between tour and chat
  const idleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistPulseRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const actionRepliesRef = React.useRef<string[]>([
    "On it! Give me just a sec 🚀",
    "Great call — executing that right now! ✨",
    "Consider it done! Working on it as we speak 💪",
    "Confirmed! Triggering that for you now 🎯",
  ]);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setShowIdleHelp(false);
    idleTimerRef.current = setTimeout(() => setShowIdleHelp(true), 180000);
  };

  useEffect(() => {
    resetIdleTimer();
    const handleActivity = () => resetIdleTimer();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
    };
  }, []);

  useEffect(() => {
    assistPulseRef.current = window.setInterval(() => {
      setShowIdleHelp(true);
      window.setTimeout(() => setShowIdleHelp(false), 8000);
    }, 180000);
    return () => {
      if (assistPulseRef.current) window.clearInterval(assistPulseRef.current);
    };
  }, []);

  const steps = [
    {
      title: 'Dashboard Overview',
      icon: 'fa-chart-line',
      emoji: '📊',
      content: "Your command centre! Real-time KPIs for Total Candidates, Training, and Deployment all live here. Click any KPI card and it'll take you straight there. Pretty slick, right? 😄",
    },
    {
      title: 'Candidates Registry',
      icon: 'fa-users',
      emoji: '👥',
      content: "This is where the magic happens! 🎯 Add candidates, import/export CSV, generate full dossier PDFs, and track document compliance. Your entire talent pipeline in one place.",
    },
    {
      title: 'Recruitment Hub',
      icon: 'fa-briefcase',
      emoji: '🚀',
      content: "Visualize your hiring funnel — from Applied all the way to Deployed! Spot bottlenecks instantly and use the analytics to make smarter recruitment decisions. Love this module! 💡",
    },
    {
      title: 'Security & Machine Auth',
      icon: 'fa-shield-alt',
      emoji: '🔐',
      content: "Full control over every device. Monitor live sessions, revoke access instantly, and if anyone gets force-logged out, hover over their machine name to see exactly why. Safety first! 🛡",
    },
  ];

  useEffect(() => {
    if (messages.length > 0) return;
    const firstName = user.name.split(' ')[0];
    const isAdmin = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;
    const greeting = isFirstTime
      ? `Hey ${firstName}! 👋 Welcome to the ZAYA Group Portal — so excited you're here! I'm ZAYA AI, your personal guide. I'll walk you through everything before you dive in. Ready? Let's go! 🚀`
      : isAdmin
      ? `Welcome back, ${firstName}! 😊 Great to see you again. I'm ZAYA AI — ready to help you navigate, surface insights, or execute tasks. What are we tackling today?`
      : `Hey ${firstName}, welcome back! 🌟 I'm ZAYA AI — here to help you find what you need fast. What can I do for you today?`;
    setMessages([{ role: 'ai', text: greeting }]);
  }, [isFirstTime, messages.length, setMessages, user.name, user.role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const detectNavigationIntent = (query: string): string | null => {
    const q = query.toLowerCase();
    const map: Record<string, string[]> = {
      dashboard: ['dashboard', 'home', 'overview', 'kpi'],
      candidates: ['candidate', 'registry', 'database', 'enrollment'],
      recruitment: ['recruit', 'hiring', 'funnel', 'hub'],
      broadcast: ['broadcast', 'message', 'announcement', 'comms'],
      booking: ['booking', 'schedule', 'calendar', 'interview'],
      settings: ['settings', 'profile', 'theme'],
      admin: ['admin', 'user management', 'console'],
      machines: ['machine', 'device', 'auth'],
      recovery: ['recovery', 'safe mode', 'backup'],
    };
    const match = Object.entries(map).find(([, keywords]) => keywords.some((k) => q.includes(k)));
    return match ? match[0] : null;
  };

  const detectActionIntent = (query: string): AIAction | null => {
    const q = query.toLowerCase();
    const hasActionWord = /(download|export|print|save pdf|generate report|share|preview)/.test(q);
    if (!hasActionWord) return null;
    if (/(share|send link)/.test(q)) return { type: 'SHARE' };
    if (/(preview|open preview)/.test(q)) return { type: 'PREVIEW', target: detectNavigationIntent(q) || undefined };
    if (/(download|save)/.test(q) && !/(report|database)/.test(q)) return { type: 'DOWNLOAD', target: detectNavigationIntent(q) || undefined };
    if (/(database|candidate list|candidate database)/.test(q)) return { type: 'EXPORT_DATABASE' };
    if (/(print|printer)/.test(q)) return { type: 'PRINT_PAGE' };
    if (/(report|roi|operations|recovery|department|rollout|logistics|recruitment)/.test(q)) {
      const reportMatch =
        q.includes('monthly roi') ? 'Monthly ROI' :
        q.includes('weekly operations') ? 'Weekly Operations' :
        q.includes('weekly recovery') ? 'Weekly Recovery Report' :
        q.includes('candidate performance') ? 'Candidate Performance' :
        q.includes('weekly recruitment') ? 'Weekly Recruitment Snapshot' :
        q.includes('update rollout') ? 'Update Rollout Report' :
        q.includes('department') ? 'Department Efficiency' :
        q.includes('logistics') ? 'Global Logistics Dataset' : undefined;
      return { type: 'DOWNLOAD_REPORT', report: reportMatch };
    }
    return { type: 'EXPORT_REPORTS' };
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    resetIdleTimer();
    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);
    // Switch to chat panel on mobile when user sends a message
    setShowChat(true);

    const navigateTo = detectNavigationIntent(userMsg);
    const action = detectActionIntent(userMsg);

    if (action) {
      setTimeout(() => {
        const line = actionRepliesRef.current.shift() || 'Executing now! 🚀';
        actionRepliesRef.current.push(line);
        setMessages((prev) => [...prev, { role: 'ai', text: line }]);
        if (onAction) onAction(action);
        setIsTyping(false);
      }, 60);
      return;
    }

    if (navigateTo) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: 'ai', text: `Heading to **${navigateTo.toUpperCase()}** right now! 🚀 Follow me!` },
        ]);
        setIsTyping(false);
        if (onNavigate) onNavigate(navigateTo);
      }, 60);
      return;
    }

    try {
      const response = await askAI({
        query: userMsg,
        user,
        moduleContext: steps[tourStep].title,
        conversationHistory: [...messages, { role: 'user', text: userMsg }].map((m) => ({
          role: m.role === 'user' ? 'user' : 'ai',
          text: m.text,
        })),
      });
      setMessages((prev) => [...prev, { role: 'ai', text: response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: `Oops — my brain had a tiny hiccup! 😅 Don't worry, just try again and I'll pick right back up where we left off!`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessage = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-black text-blue-300">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  // Quick suggestion chips
  const suggestions = [
    "How do I add a candidate?",
    "Show me the booking module",
    "What does Machine Auth do?",
    "How do I export a report?",
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-300"
      onClick={() => onComplete('dashboard')}
    >
      {/* Idle help bubble */}
      {showIdleHelp && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-[70] animate-bounce">
          <div className="bg-[#0f1a2e] border-2 border-gold p-4 rounded-2xl shadow-2xl max-w-xs text-center">
            <p className="text-xs font-black text-white uppercase">
              Psst, {user.name.split(' ')[0]}! 👀 Need a hand? I'm right here!
            </p>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#0f1a2e] border-b-2 border-r-2 border-gold rotate-45"></div>
          </div>
        </div>
      )}

      <div
        className="bg-[#0a1628] border border-[#1e3a5f] w-full max-w-5xl h-[min(90vh,780px)] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={() => onComplete('dashboard')}
          className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
          aria-label="Close orientation"
        >
          <i className="fas fa-times text-xs"></i>
        </button>

        {/* Mobile tab switcher */}
        <div className="flex md:hidden border-b border-[#1e3a5f] shrink-0">
          <button
            onClick={() => setShowChat(false)}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${
              !showChat ? 'text-gold border-b-2 border-gold' : 'text-blue-300/50'
            }`}
          >
            <i className="fas fa-map-signs mr-1"></i> Tour
          </button>
          <button
            onClick={() => { setShowChat(true); setTimeout(() => inputRef.current?.focus(), 100); }}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all ${
              showChat ? 'text-gold border-b-2 border-gold' : 'text-blue-300/50'
            }`}
          >
            <i className="fas fa-comment mr-1"></i> Chat {messages.length > 1 && `(${messages.length})`}
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left — Tour Panel */}
          <div className={`${showChat ? 'hidden' : 'flex'} md:flex w-full md:w-2/5 flex-col bg-enterprise-blue text-white relative overflow-y-auto`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full -ml-24 -mb-24 blur-3xl pointer-events-none"></div>

            <div className="relative z-10 p-6 md:p-10 flex flex-col justify-between h-full">
              <div>
                <div className="mb-8">
                  <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-blue-300/60">
                    Enterprise Orientation
                  </span>
                  <h2 className="text-3xl md:text-4xl font-bold mt-2">
                    ZAYA <span className="text-blue-400 font-light">CORE</span>
                  </h2>
                  <p className="text-white/60 text-sm mt-3 leading-relaxed font-medium">
                    Your personal tour of every module — let's make sure you feel right at home! 😊
                  </p>
                </div>

                {/* Current step card */}
                <div className="p-5 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-sm hover:bg-white/15 transition-all duration-300 mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center text-lg">
                      {steps[tourStep].emoji}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-gold text-enterprise-blue text-[10px] font-black flex items-center justify-center">
                        {tourStep + 1}
                      </span>
                      <h3 className="text-base font-bold">{steps[tourStep].title}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-white/75 leading-relaxed">{steps[tourStep].content}</p>
                </div>

                {/* Progress dots */}
                <div className="flex gap-2 mb-6">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                        i <= tourStep
                          ? 'bg-gold shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                          : 'bg-white/10'
                      }`}
                    ></div>
                  ))}
                </div>

                {/* All steps list */}
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <button
                      key={i}
                      onClick={() => setTourStep(i)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                        i === tourStep
                          ? 'bg-white/15 border border-white/20'
                          : i < tourStep
                          ? 'opacity-60 hover:opacity-80'
                          : 'opacity-40 hover:opacity-60'
                      }`}
                    >
                      <span className="text-base">{step.emoji}</span>
                      <span className="text-xs font-bold uppercase tracking-widest">{step.title}</span>
                      {i < tourStep && <i className="fas fa-check text-green-400 text-xs ml-auto"></i>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation buttons */}
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => onComplete('dashboard')}
                  className="text-[10px] text-white/40 hover:text-white transition-colors font-bold uppercase tracking-widest"
                >
                  Skip Tour
                </button>
                <div className="flex gap-2">
                  {tourStep > 0 && (
                    <button
                      onClick={() => setTourStep((prev) => prev - 1)}
                      className="px-4 py-2 border border-white/20 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  {tourStep < steps.length - 1 ? (
                    <button
                      onClick={() => setTourStep((prev) => prev + 1)}
                      className="px-6 py-2 bg-white text-enterprise-blue rounded-xl text-xs font-bold shadow-xl hover:scale-105 transition-transform active:scale-95"
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      onClick={() => onComplete('dashboard')}
                      className="px-6 py-2 bg-green-500 text-white rounded-xl text-xs font-bold shadow-xl hover:scale-105 transition-transform active:scale-95"
                    >
                      Enter Portal 🎉
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right — Chat Panel */}
          <div className={`${!showChat ? 'hidden' : 'flex'} md:flex w-full md:w-3/5 flex-col bg-[#0a1628] h-full`}>
            {/* Chat header */}
            <div className="p-4 border-b border-[#1e3a5f] bg-[#0f1a2e] flex items-center gap-3 shrink-0">
              <div className={`w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg transition-all duration-500 ${isTyping ? 'animate-bounce' : 'hover:scale-110 hover:rotate-12'}`}>
                <i className={`fas ${isTyping ? 'fa-robot' : 'fa-brain'} text-base`}></i>
              </div>
              <div>
                <p className="text-sm font-black text-white">ZAYA AI</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isTyping ? 'bg-amber-400' : 'bg-green-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isTyping ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                  </span>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${isTyping ? 'text-amber-400' : 'text-green-400'}`}>
                    {isTyping ? 'Thinking... 🤔' : 'Ready to help! ✨'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
                >
                  {msg.role === 'ai' && (
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs mr-2 shrink-0 mt-1">
                      <i className="fas fa-brain text-[10px]"></i>
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-3 md:p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-[#0f1a2e] border border-[#1e3a5f] text-blue-100 rounded-tl-none'
                    }`}
                  >
                    {msg.role === 'ai' ? renderMessage(msg.text) : msg.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start items-end gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs shrink-0">
                    <i className="fas fa-brain text-[10px]"></i>
                  </div>
                  <div className="bg-[#0f1a2e] border border-[#1e3a5f] p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                    <span className="text-blue-300/60 text-xs">ZAYA AI is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef}></div>
            </div>

            {/* Suggestion chips — only show when few messages */}
            {messages.length <= 2 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    className="px-3 py-1.5 bg-[#0f1a2e] border border-[#1e3a5f] rounded-full text-[10px] font-bold text-blue-300 hover:border-blue-400 hover:text-white transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input area */}
            <div className="p-3 md:p-4 bg-[#0f1a2e] border-t border-[#1e3a5f] shrink-0">
              <div className="flex gap-2 p-2 border border-[#1e3a5f] rounded-2xl bg-[#0a1628] focus-within:border-blue-500 transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask ZAYA AI anything..."
                  aria-label="Chat with ZAYA AI"
                  className="flex-1 bg-transparent border-none px-3 text-sm text-white focus:ring-0 outline-none placeholder:text-blue-300/30"
                />
                <button
                  disabled={isTyping || !input.trim()}
                  onClick={handleSend}
                  aria-label="Send message"
                  className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-paper-plane text-sm"></i>
                </button>
              </div>
              <p className="text-[9px] text-blue-300/30 mt-2 text-center uppercase font-bold tracking-[0.2em]">
                ZAYA AI — Enterprise Intelligence v3.1 ✨
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrientationAI;