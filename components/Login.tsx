import React, { useState } from 'react';
import { SystemConfig } from '../types';
import { DEFAULT_LOGIN_SHOWCASES } from './loginShowcaseDefaults';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<string | null>;
  systemConfig: SystemConfig;
}

const Login: React.FC<LoginProps> = ({ onLogin, systemConfig }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const legacyFacts = [
    'Strong governance depends on policies that are visible, repeatable, and measurable.',
    'Good documentation reduces onboarding time and lowers operational risk.',
    'Disciplined release management protects data, reputation, and delivery timelines.',
  ];
  const hasLegacyFacts =
    Array.isArray(systemConfig.loginFacts) &&
    systemConfig.loginFacts.length === legacyFacts.length &&
    systemConfig.loginFacts.every((fact, index) => fact === legacyFacts[index]);
  const isLegacyTitle = systemConfig.loginShowcaseTitle === 'Corporate intelligence for teams that build with discipline.';
  const isLegacySummary = systemConfig.loginShowcaseSummary === 'Operations, recruitment, compliance, and delivery stay aligned when the system surfaces the right information at the right moment.';
  const isLegacyQuote = systemConfig.loginQuote === 'Well-built systems reduce noise so teams can focus on decisions that matter.';
  const isLegacyAuthor = systemConfig.loginQuoteAuthor === 'ZAYA Development Desk';
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const defaultShowcase = DEFAULT_LOGIN_SHOWCASES[dayIndex % DEFAULT_LOGIN_SHOWCASES.length];
  const rotatingImages = Array.isArray(systemConfig.loginHeroImages)
    ? systemConfig.loginHeroImages.filter(Boolean)
    : [];
  const activeHeroImage = rotatingImages.length > 0
    ? rotatingImages[dayIndex % rotatingImages.length]
    : systemConfig.loginHeroImage || defaultShowcase.image;
  const loginFacts = Array.isArray(systemConfig.loginFacts) && systemConfig.loginFacts.length > 0
    && !hasLegacyFacts
    ? systemConfig.loginFacts.slice(0, 3)
    : defaultShowcase.facts.slice(0, 3);
  const showcaseTitle = systemConfig.loginShowcaseTitle && !isLegacyTitle ? systemConfig.loginShowcaseTitle : defaultShowcase.title;
  const showcaseSummary = systemConfig.loginShowcaseSummary && !isLegacySummary ? systemConfig.loginShowcaseSummary : defaultShowcase.summary;
  const showcaseQuote = systemConfig.loginQuote && !isLegacyQuote ? systemConfig.loginQuote : defaultShowcase.quote;
  const showcaseAuthor = systemConfig.loginQuoteAuthor && !isLegacyAuthor ? systemConfig.loginQuoteAuthor : defaultShowcase.author;

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
    <div className="app-shell app-full-height relative w-full overflow-hidden bg-[radial-gradient(circle_at_top,#1055a5_0%,#003366_34%,#02111f_100%)] text-[#0f172a]">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(255,255,255,0.85)_0_1px,transparent_1.8px),radial-gradient(circle_at_28%_36%,rgba(212,175,55,0.55)_0_1.2px,transparent_2px),radial-gradient(circle_at_44%_18%,rgba(255,255,255,0.75)_0_1px,transparent_1.7px),radial-gradient(circle_at_67%_24%,rgba(255,255,255,0.85)_0_1.1px,transparent_1.8px),radial-gradient(circle_at_83%_14%,rgba(212,175,55,0.5)_0_1.2px,transparent_2px),radial-gradient(circle_at_74%_68%,rgba(255,255,255,0.75)_0_1px,transparent_1.7px),radial-gradient(circle_at_22%_78%,rgba(255,255,255,0.8)_0_1px,transparent_1.8px),radial-gradient(circle_at_91%_72%,rgba(255,255,255,0.72)_0_1px,transparent_1.7px)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:52px_52px] opacity-20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_58%,rgba(255,255,255,0.08)_58.4%,transparent_59%),radial-gradient(circle_at_center,transparent_0%,transparent_72%,rgba(212,175,55,0.08)_72.4%,transparent_73%)] opacity-60"></div>
        <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#0f4c97]/30 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-gold/10 blur-3xl"></div>
      </div>
      <div className="relative flex min-h-full w-full items-center px-4 py-6 md:px-8 md:py-8 lg:px-12">
        <div className="mx-auto flex min-h-[calc(var(--app-vh,1vh)*100-2.2rem)] max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-gold/20 bg-[#e9f1fb] shadow-[0_42px_120px_rgba(1,12,27,0.42)] md:min-h-[680px] md:flex-row">
          <div className="relative flex w-full items-center justify-center bg-[linear-gradient(180deg,#f4f8ff_0%,#e8f0fb_100%)] p-6 md:w-[48%] md:p-10 lg:p-12">
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-enterprise-pattern"></div>
            <div className="relative z-10 flex w-full max-w-md flex-col justify-center">
              <div className="mb-8">
                <div className="mb-7 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-[#003366]/10">
                    {renderLogo('h-8 w-8')}
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#003366]">Portal Access</p>
                    <p className="mt-1 text-base font-black tracking-tight text-[#003366]">{systemConfig.systemName}</p>
                  </div>
                </div>
                <h2 className="text-4xl font-black tracking-tight text-[#003366] md:text-[3.2rem]">Welcome Back!</h2>
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
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.28em] text-[#003366]/55">
                    Enterprise Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-[#003366]/20 bg-white px-5 py-4 font-semibold text-[#1e293b] outline-none transition-all placeholder:text-slate-300 focus:border-[#003366] focus:ring-4 focus:ring-[#003366]/10"
                    placeholder="username@zayagroupltd.com"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.28em] text-[#003366]/55">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-[#003366]/15 bg-white px-5 py-4 font-semibold text-[#1e293b] outline-none transition-all placeholder:text-slate-300 focus:border-[#003366] focus:ring-4 focus:ring-[#003366]/10"
                    placeholder="Enter your password"
                    required
                  />
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                  <label className="flex items-center gap-2 text-[#003366]/75">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#003366] focus:ring-[#003366]" />
                    <span>Remember me</span>
                  </label>
                  <span className="font-semibold text-gold">Forgot password?</span>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl border-b-4 border-black/15 bg-gold py-5 text-lg font-black text-[#003366] shadow-2xl shadow-gold/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? (
                      <i className="fas fa-circle-notch fa-spin"></i>
                    ) : (
                      <>
                        <i className="fas fa-shield-alt"></i>
                        <span className="uppercase tracking-[0.2em]">Login</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-8 space-y-3">
                <p className="text-xs leading-6 text-[#003366]/50">
                  By signing in you confirm that access to this environment is monitored under corporate policy.
                </p>
                <p className="text-[11px] font-semibold tracking-[0.08em] text-[#003366]/65">
                  All copyrights reserved by Zaya Group Ltd. @2026
                </p>
              </div>
            </div>
          </div>

          <div
            className="relative flex min-h-[420px] w-full flex-col justify-between overflow-hidden bg-[#003366] p-6 text-white md:min-h-full md:w-[52%] md:p-10"
            style={
              activeHeroImage
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(3, 20, 44, 0.18) 0%, rgba(3, 20, 44, 0.82) 100%), url(${activeHeroImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }
                : {
                    backgroundImage: 'radial-gradient(circle at top left, rgba(212, 175, 55, 0.22), transparent 26%), linear-gradient(135deg, #003366 0%, #0b3f78 48%, #041426 100%)',
                  }
            }
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_22%),radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.09),transparent_16%),linear-gradient(120deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:auto,auto,36px_36px] opacity-50"></div>
            <div className="absolute -bottom-16 -right-12 h-56 w-56 rounded-full border border-white/25 bg-white/10 blur-2xl"></div>

            <div className="relative z-10 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/92 shadow-lg ring-1 ring-white/40">
                {renderLogo('h-10 w-10')}
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.35em] text-gold">System Theme</p>
                <h1 className="mt-2 text-2xl font-black uppercase tracking-tight md:text-3xl">{systemConfig.systemName}</h1>
              </div>
            </div>

            <div className="relative z-10 max-w-lg space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-gold backdrop-blur">
                <i className="fas fa-building-shield"></i>
                Corporate matters and development wisdom
              </div>
              <div>
                <p className="max-w-lg text-sm font-medium leading-7 text-white/80 md:text-base">{showcaseSummary}</p>
              </div>

              <div className="grid gap-3 max-w-md">
                {loginFacts.map((fact, index) => (
                  <div key={`${fact}-${index}`} className="rounded-2xl border border-white/18 bg-black/20 px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold"></span>
                      <p className="text-sm font-medium leading-6 text-white/90">{fact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 max-w-lg rounded-[1.6rem] border border-white/18 bg-white/12 p-5 shadow-2xl backdrop-blur-md">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">{showcaseTitle}</p>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-gold">Wise Quote For Development</p>
              <p className="mt-3 text-lg font-medium leading-8 text-white">"{showcaseQuote}"</p>
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.24em] text-white/70">{showcaseAuthor}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
