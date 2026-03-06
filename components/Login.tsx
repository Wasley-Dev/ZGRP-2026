import React, { useState } from 'react';
import { SystemConfig } from '../types';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<string | null>;
  systemConfig: SystemConfig;
}

const Login: React.FC<LoginProps> = ({ onLogin, systemConfig }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loginFacts = Array.isArray(systemConfig.loginFacts) && systemConfig.loginFacts.length > 0
    ? systemConfig.loginFacts.slice(0, 3)
    : [
        'Corporate governance works best when accountability is documented and easy to audit.',
        'Reliable systems shorten response time during recovery, maintenance, and approvals.',
        'Development teams move faster when standards are clear before work begins.',
      ];
  const showcaseTitle = systemConfig.loginShowcaseTitle || 'Corporate intelligence for teams that build with discipline.';
  const showcaseSummary = systemConfig.loginShowcaseSummary || 'Structured systems keep decisions, compliance, and delivery aligned across the organization.';
  const showcaseQuote = systemConfig.loginQuote || 'Well-built systems reduce noise so teams can focus on decisions that matter.';
  const showcaseAuthor = systemConfig.loginQuoteAuthor || 'ZAYA Development Desk';
  const rotatingImages = Array.isArray(systemConfig.loginHeroImages)
    ? systemConfig.loginHeroImages.filter(Boolean)
    : [];
  const activeHeroImage = (() => {
    if (rotatingImages.length > 0) {
      const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
      return rotatingImages[dayIndex % rotatingImages.length];
    }
    return systemConfig.loginHeroImage;
  })();

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

  const renderLogo = (sizeClass: string) => {
    if (!systemConfig.logoIcon) return null;
    if (systemConfig.logoIcon.startsWith('data:image')) {
      return <img src={systemConfig.logoIcon} alt="System Logo" className={`${sizeClass} object-contain`} />;
    }
    return <i className={`fas ${systemConfig.logoIcon} text-gold ${sizeClass.includes('text-') ? sizeClass : 'text-4xl'}`}></i>;
  };

  return (
    <div className="app-shell app-full-height w-full bg-[#efe9df] text-[#0f172a]">
      <div className="min-h-full w-full px-4 py-6 md:px-8 md:py-10 lg:px-12">
        <div className="mx-auto flex min-h-[calc(var(--app-vh,1vh)*100-3rem)] max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-[#0d5c5b] bg-white shadow-[0_40px_120px_rgba(15,23,42,0.18)] md:min-h-[720px] md:flex-row">
          <div
            className="relative flex min-h-[420px] w-full flex-col justify-between overflow-hidden bg-[#0d5c5b] p-6 text-white md:min-h-full md:w-[54%] md:p-10"
            style={
              activeHeroImage
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(4, 21, 35, 0.2) 0%, rgba(4, 21, 35, 0.82) 100%), url(${activeHeroImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {
                    backgroundImage: 'radial-gradient(circle at top left, rgba(150, 255, 199, 0.28), transparent 28%), linear-gradient(135deg, #0d5c5b 0%, #0a2c43 52%, #071726 100%)',
                  }
            }
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.2),transparent_22%),radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.12),transparent_16%),linear-gradient(120deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:auto,auto,36px_36px] opacity-60"></div>
            <div className="absolute -bottom-16 -right-12 h-56 w-56 rounded-full border border-white/25 bg-white/10 blur-2xl"></div>

            <div className="relative z-10 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/92 shadow-lg ring-1 ring-white/40">
                {renderLogo('h-10 w-10')}
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#ffe082]">Portal Access</p>
                <h1 className="mt-2 text-2xl font-black uppercase tracking-tight md:text-3xl">{systemConfig.systemName}</h1>
              </div>
            </div>

            <div className="relative z-10 max-w-xl space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[#ffe082] backdrop-blur">
                <i className="fas fa-building-shield"></i>
                Corporate matters and development wisdom
              </div>
              <div>
                <h2 className="max-w-lg text-3xl font-black leading-tight md:text-5xl">{showcaseTitle}</h2>
                <p className="mt-4 max-w-lg text-sm leading-7 text-white/82 md:text-base">{showcaseSummary}</p>
              </div>

              <div className="grid gap-3">
                {loginFacts.map((fact, index) => (
                  <div key={`${fact}-${index}`} className="rounded-2xl border border-white/18 bg-black/20 px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ffe082] text-[11px] font-black text-[#0a2c43]">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-6 text-white/92">{fact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 max-w-xl rounded-[1.6rem] border border-white/18 bg-white/12 p-5 shadow-2xl backdrop-blur-md">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ffe082]">Wise Quote For Development</p>
              <p className="mt-3 text-lg font-semibold leading-8 text-white">"{showcaseQuote}"</p>
              <p className="mt-4 text-sm font-bold uppercase tracking-[0.24em] text-white/70">{showcaseAuthor}</p>
            </div>
          </div>

          <div className="relative flex w-full items-center justify-center bg-[#fcfbf7] p-6 md:w-[46%] md:p-10 lg:p-14">
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-enterprise-pattern"></div>
            <div className="relative z-10 w-full max-w-md">
              <div className="mb-10">
                <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#0d5c5b]">Secure Login</p>
                <h2 className="mt-4 text-4xl font-black tracking-tight text-[#20115b] md:text-5xl">Welcome Back!</h2>
                <p className="mt-3 text-base leading-7 text-slate-500">Please sign in to continue to your corporate workspace.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-600">
                    <i className="fas fa-exclamation-triangle shrink-0"></i>
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.28em] text-slate-400">
                    Enterprise Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-[#0d5c5b]/35 bg-white px-5 py-4 font-semibold text-[#1e293b] outline-none transition-all placeholder:text-slate-300 focus:border-[#0d5c5b] focus:ring-4 focus:ring-[#0d5c5b]/10"
                    placeholder="username@zayagroupltd.com"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.28em] text-slate-400">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 font-semibold text-[#1e293b] outline-none transition-all placeholder:text-slate-300 focus:border-[#0d5c5b] focus:ring-4 focus:ring-[#0d5c5b]/10"
                    placeholder="Enter your password"
                    required
                  />
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <label className="flex items-center gap-2 text-slate-500">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#0d5c5b] focus:ring-[#0d5c5b]" />
                    <span>Remember me</span>
                  </label>
                  <span className="font-semibold text-[#c24161]">Forgot password?</span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border-b-4 border-black/15 bg-[#0d7a78] py-5 text-lg font-black text-white shadow-2xl shadow-[#0d7a78]/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <i className="fas fa-circle-notch fa-spin"></i>
                  ) : (
                    <>
                      <i className="fas fa-shield-alt"></i>
                      <span className="uppercase tracking-[0.28em]">Login</span>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-10 text-xs leading-6 text-slate-400">
                By signing in you confirm that access to this environment is monitored under corporate policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
