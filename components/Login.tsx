import React, { useState } from 'react';
// Inline to avoid resolution conflict with duplicate types file — matches types.ts exactly
interface SystemConfig { systemName: string; logoIcon: string; maintenanceMode?: boolean; maintenanceMessage?: string; maintenanceUpdatedBy?: string; maintenanceUpdatedAt?: string; backupHour?: number; }

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<string | null>;
  systemConfig: SystemConfig;
}

const Login: React.FC<LoginProps> = ({ onLogin, systemConfig }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setTimeout(async () => {
      const loginError = await onLogin(email, password);
      if (loginError) setError(loginError);
      setIsLoading(false);
    }, 250);
  };

  const renderLogo = () => {
    if (!systemConfig.logoIcon) return null;
    if (systemConfig.logoIcon.startsWith('data:image')) {
      return <img src={systemConfig.logoIcon} alt="System Logo" className="w-24 h-24 object-contain" />;
    }
    return <i className={`fas ${systemConfig.logoIcon} text-gold text-5xl`}></i>;
  };

  return (
    // Replaced style={{ minHeight: ... }} with app-full-height CSS class
    <div className="app-shell app-full-height w-full flex flex-col md:flex-row bg-[#0b1324] font-inter">

      {/* ── Left Branding Panel ── */}
      <div className="w-full md:w-1/2 login-texture flex flex-col justify-center p-12 md:p-24 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 max-w-lg">
          {/* Logo */}
          <div className="w-32 h-32 mb-8 shadow-2xl bg-white rounded-full flex items-center justify-center border-4 border-gold overflow-hidden">
            {renderLogo()}
          </div>

          {/* System name */}
          <h1 className="text-4xl font-black mb-6 tracking-tight leading-tight uppercase">
            {systemConfig.systemName.split(' ').slice(0, 2).join(' ')}<br />
            <span className="text-gold font-light italic">
              {systemConfig.systemName.split(' ').slice(2).join(' ')}
            </span>
          </h1>

          <p className="text-lg text-white/60 mb-12 font-medium leading-relaxed">
            Premium Organizational Intelligence Suite for Enterprise Resource Planning and Human Capital Management.
          </p>

          <div className="flex items-center gap-3 text-xs font-bold text-gold/80 tracking-widest uppercase">
            <i className="fas fa-lock"></i> Secured Infrastructure
          </div>
        </div>
      </div>

      {/* ── Right Login Panel ── */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-[#0f1a2e] relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-enterprise-pattern"></div>

        <div className="w-full max-w-md relative z-10">
          {/* Header */}
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-black text-white tracking-tight uppercase">
              Authentication
            </h2>
            <p className="text-blue-300/50 mt-2 font-bold uppercase text-[10px] tracking-widest">
              Powered By Zaya AI • System Administrator
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-900/30 text-red-400 text-xs font-bold rounded-xl flex items-center gap-3">
                <i className="fas fa-exclamation-triangle shrink-0"></i>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-blue-300/50 uppercase mb-2 tracking-widest">
                Enterprise Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-[#0a1628] border border-[#1e3a5f] rounded-2xl outline-none focus:border-blue-400 transition-all font-bold text-white placeholder-blue-300/20"
                placeholder="username@zayagroupltd.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-blue-300/50 uppercase tracking-widest mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-[#0a1628] border border-[#1e3a5f] rounded-2xl outline-none focus:border-blue-400 transition-all font-bold text-white placeholder-blue-300/20"
                placeholder="••••••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-5 bg-gold text-[#003366] rounded-2xl font-black text-lg shadow-2xl shadow-gold/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border-b-4 border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <i className="fas fa-circle-notch fa-spin"></i>
              ) : (
                <>
                  <i className="fas fa-shield-alt"></i>
                  <span className="tracking-widest uppercase">Authorize Access</span>
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