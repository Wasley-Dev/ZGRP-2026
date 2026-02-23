
import React, { useState, useEffect } from 'react';
import { askAI } from '../services/geminiService';

const OrientationAI: React.FC<{ 
  user: any, 
  onComplete: () => void,
  messages: { role: string, text: string }[],
  setMessages: React.Dispatch<React.SetStateAction<{ role: string, text: string }[]>>,
  onNavigate?: (module: string) => void
}> = ({ user, onComplete, messages, setMessages, onNavigate }) => {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [showIdleHelp, setShowIdleHelp] = useState(false);
  const idleTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setShowIdleHelp(false);
    idleTimerRef.current = setTimeout(() => {
      setShowIdleHelp(true);
    }, 180000); // 3 minutes
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

  const steps = [
    { title: "Dashboard Overview", icon: "fa-chart-line", content: "Your command center. Real-time KPIs for Total Candidates, Training, and Deployment live here. Click any KPI to navigate instantly." },
    { title: "Candidates Registry", icon: "fa-users", content: "Manage the database. Use the 'Add Candidate' button to start. Import/Export CSV, generate dossiers, and track document compliance." },
    { title: "Recruitment Hub", icon: "fa-briefcase", content: "Visualize your hiring funnel. Identify bottlenecks in the recruitment stages using deep analytics and forecasting." },
    { title: "Security & Machine Auth", icon: "fa-shield-alt", content: "Control every device. Monitor authorized IPs and revoke access instantly if suspicious activity is detected." }
  ];

  useEffect(() => {
    if (messages.length === 0) {
      const greeting = `Salutations, ${user.name}. I am Zaya AI, your enterprise recruitment assistant. I've detected this is your first session today. How may I help you navigate the portal?`;
      setMessages([{ role: 'ai', text: greeting }]);
    }
  }, [user]);

  const handleSend = async () => {
    if (!input.trim()) return;
    resetIdleTimer();
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsTyping(true);

    // Navigation and Action Logic
    const lowerMsg = userMsg.toLowerCase();
    
    if (lowerMsg.includes('dashboard') || lowerMsg.includes('home')) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', text: "Zooming you to the Dashboard! 🚀" }]);
        setIsTyping(false);
        if (onNavigate) onNavigate('dashboard');
      }, 300);
      return;
    }

    if (lowerMsg.includes('candidate') || lowerMsg.includes('registry')) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', text: "Opening Candidate Registry database..." }]);
        setIsTyping(false);
        if (onNavigate) onNavigate('candidates');
      }, 300);
      return;
    }

    if (lowerMsg.includes('recruit') || lowerMsg.includes('hub')) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', text: "Navigating to Recruitment Hub analytics..." }]);
        setIsTyping(false);
        if (onNavigate) onNavigate('recruitment');
      }, 300);
      return;
    }

    if (lowerMsg.includes('broadcast') || lowerMsg.includes('message')) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'ai', text: "Accessing Mass Broadcast Console..." }]);
        setIsTyping(false);
        if (onNavigate) onNavigate('broadcast');
      }, 300);
      return;
    }

    const response = await askAI(userMsg, "You are Zaya AI, a playful, quick, and highly efficient enterprise assistant. You have full system access. Keep responses concise and fun. If asked about code, say you can optimize it. If asked to navigate, say you are redirecting. Use **bold** for emphasis instead of stars.");
    setMessages(prev => [...prev, { role: 'ai', text: response }]);
    setIsTyping(false);
  };

  const renderMessage = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-black text-enterprise-blue dark:text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      {showIdleHelp && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[280px] z-[70] animate-bounce">
           <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-2xl border-2 border-gold relative max-w-xs text-center">
              <p className="text-xs font-black text-slate-800 dark:text-white uppercase">
                 Need assistance, {user.name.split(' ')[0]}? I noticed you've been quiet.
              </p>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-slate-800 border-b-2 border-r-2 border-gold rotate-45"></div>
           </div>
        </div>
      )}
      
      <div className="bg-white dark:bg-slate-800 w-full max-w-5xl h-[80vh] rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden border dark:border-slate-700 border-white/20 relative">
        {/* Close Button */}
        <button 
          onClick={onComplete}
          className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
        >
          <i className="fas fa-times"></i>
        </button>

        {/* Left: Tour / Orientation */}
        <div className="w-full md:w-2/5 p-10 bg-enterprise-blue text-white relative flex flex-col justify-between overflow-y-auto custom-scrollbar">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/10 rounded-full -ml-24 -mb-24 blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="mb-12">
              <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-blue-300/60">Enterprise Orientation</span>
              <h2 className="text-4xl font-bold mt-2">ZAYA <span className="text-blue-400 font-light">CORE</span></h2>
              <p className="text-white/60 text-sm mt-4 leading-relaxed font-medium">Step through the high-performance modules designed for the ZAYA Group ecosystem.</p>
            </div>

            <div className="space-y-8">
              <div className="p-6 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-sm transition-all duration-300 hover:bg-white/15">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                   <i className={`fas ${steps[tourStep].icon} text-blue-300`}></i>
                </div>
                <h3 className="text-xl font-bold mb-2 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-enterprise-blue text-[10px] font-black flex items-center justify-center">{tourStep + 1}</span>
                  {steps[tourStep].title}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">{steps[tourStep].content}</p>
              </div>

              <div className="flex gap-2">
                {steps.map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= tourStep ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-white/10'}`}></div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 flex items-center justify-between relative z-10">
            <button onClick={onComplete} className="text-sm text-white/40 hover:text-white transition-colors font-bold uppercase tracking-widest text-[10px]">Skip Tour</button>
            <div className="flex gap-3">
              {tourStep > 0 && (
                <button onClick={() => setTourStep(prev => prev - 1)} className="px-5 py-2.5 border border-white/20 rounded-xl text-sm font-bold hover:bg-white/10 transition-colors">Prev</button>
              )}
              {tourStep < steps.length - 1 ? (
                <button onClick={() => setTourStep(prev => prev + 1)} className="px-8 py-2.5 bg-white text-enterprise-blue rounded-xl text-sm font-bold shadow-xl shadow-black/20 hover:scale-105 transition-transform active:scale-95">Next</button>
              ) : (
                <button onClick={onComplete} className="px-8 py-2.5 bg-green-500 text-white rounded-xl text-sm font-bold shadow-xl shadow-green-500/20 hover:scale-105 transition-transform active:scale-95">Enter Portal</button>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI Assistant */}
        <div className="w-full md:w-3/5 flex flex-col bg-slate-50 dark:bg-slate-900/50 h-full">
          <div className="p-5 border-b dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl bg-enterprise-blue flex items-center justify-center text-white shadow-lg shadow-blue-900/20 transition-all duration-500 ${isTyping ? 'animate-bounce' : 'hover:scale-110 hover:rotate-12'}`}>
                <i className={`fas ${isTyping ? 'fa-robot' : 'fa-brain'} text-xl`}></i>
              </div>
              <div>
                <p className="text-sm font-bold dark:text-white">Zaya AI</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isTyping ? 'bg-amber-400' : 'bg-green-400'} opacity-75`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isTyping ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                  </span>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${isTyping ? 'text-amber-500' : 'text-green-500'}`}>
                    {isTyping ? 'Processing...' : 'Active Intelligence'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-${msg.role === 'user' ? 'right-4' : 'left-4'} duration-300`}>
                <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-enterprise-blue text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-none'}`}>
                  {msg.role === 'ai' ? renderMessage(msg.text) : msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 p-4 rounded-2xl rounded-tl-none text-slate-400 flex items-center gap-2">
                  <i className="fas fa-circle-notch fa-spin"></i> Zaya AI is analyzing...
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-white dark:bg-slate-800 border-t dark:border-slate-700 shrink-0">
            <div className="flex gap-2 p-2 border dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-900 shadow-inner">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Query Zaya AI about ERP functions..." 
                className="flex-1 bg-transparent border-none px-4 text-sm text-[#003366] dark:text-white focus:ring-0 outline-none placeholder:text-slate-400"
              />
              <button onClick={handleSend} className="w-10 h-10 rounded-xl bg-enterprise-blue text-white flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-blue-900/20 hover:brightness-110">
                <i className="fas fa-paper-plane text-sm"></i>
              </button>
            </div>
            <p className="text-[9px] text-slate-400 mt-3 text-center uppercase font-bold tracking-[0.2em]">Enterprise Core Intelligence v3.0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrientationAI;
