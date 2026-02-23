import React, { useState } from 'react';
import { SystemConfig } from '../types';

interface LoginProps {
  onLogin: (email: string, name: string) => void;
  systemConfig: SystemConfig;
}

const Login: React.FC<LoginProps> = ({ onLogin, systemConfig }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (email === 'it@zayagroupltd.com' && password === 'Kingsley06#') {
      setTimeout(() => {
        onLogin(email, 'George Wasley');
        setIsLoading(false);
      }, 1000);
    } else {
      setTimeout(() => {
        setError('Invalid enterprise credentials. Access denied.');
        setIsLoading(false);
      }, 800);
    }
  };

  // 🔥 Dynamic Logo Renderer
  const renderLogo = () => {
    if (!systemConfig.logoIcon) return null;

    // If admin uploaded image (base64)
    if (systemConfig.logoIcon.startsWith('data:image')) {
      return (
        <img
          src={systemConfig.logoIcon}
          alt="System Logo"
          className="w-24 h-24 object-contain"
        />
      );
    }

    // If icon class
    return (
      <i
        className={`fas ${systemConfig.logoIcon} text-gold text-5xl`}
      ></i>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-slate-100 dark:bg-slate-950 font-inter">
      
      {/* Left Branding Panel */}
      <div className="w-full md:w-1/2 login-texture flex flex-col justify-center p-12 md:p-24 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>

        <div className="relative z-10 max-w-lg">

          {/* ✅ FIXED LOGO DISPLAY */}
          <div className="w-32 h-32 mb-8 shadow-2xl bg-white rounded-full flex items-center justify-center border-4 border-gold overflow-hidden">
            {renderLogo()}
          </div>

          <h1 className="text-4xl font-black mb-6 tracking-tight leading-tight uppercase font-inter">
            {systemConfig.systemName.split(' ').slice(0, 2).join(' ')}<br />
            <span className="text-gold font-light italic">
              {systemConfig.systemName.split(' ').slice(2).join(' ')}
            </span>
          </h1>

          <p className="text-lg text-white/60 mb-12 font-medium leading-relaxed font-inter">
            Premium Organizational Intelligence Suite for Enterprise Resource Planning and Human Capital Management.
          </p>

          <div className="flex items-center gap-3 text-xs font-bold text-gold/80 tracking-widest uppercase">
            <i className="fas fa-lock"></i> Secured Infrastructure
          </div>
        </div>
      </div>

      {/* Right Login Panel */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 transition-colors duration-200 relative">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-enterprise-pattern"></div>

        <div className="w-full max-w-md relative z-10">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight uppercase">
              Authentication
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-bold uppercase text-[10px] tracking-widest font-inter">
              Powered By Zaya AI • System Administrator
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl flex items-center gap-3 animate-shake font-inter">
                <i className="fas fa-exclamation-triangle"></i> {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase mb-2 tracking-widest">
                Enterprise Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-gold/10 transition-all font-bold text-[#003366]"
                placeholder="username@zayagroupltd.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-gold/10 transition-all font-bold text-[#003366]"
                placeholder="••••••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-5 bg-gold text-enterprise-blue rounded-2xl font-black text-lg shadow-2xl shadow-gold/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border-b-4 border-black/20"
            >
              {isLoading ? (
                <i className="fas fa-circle-notch fa-spin"></i>
              ) : (
                <>
                  <i className="fas fa-shield-alt"></i>
                  <span className="tracking-widest uppercase">
                    Authorize Access
                  </span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
