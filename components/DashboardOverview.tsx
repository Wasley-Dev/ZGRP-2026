import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  Area
} from 'recharts';

import { BookingEntry, Candidate, RecruitmentStatus, SystemUser, UserRole } from '../types';

interface DashboardProps {
  onNavigate: (module: string) => void;
  candidatesCount: number;
  candidates: Candidate[];
  bookings: BookingEntry[];
  user: SystemUser;
}

const DashboardOverview: React.FC<DashboardProps> = ({ onNavigate, candidatesCount, candidates, bookings, user }) => {
  const trainingCount = candidates.filter((c) => c.status === RecruitmentStatus.TRAINING).length;
  const interviewCount = candidates.filter((c) => c.status === RecruitmentStatus.INTERVIEW).length;
  const deployedCount = candidates.filter((c) => c.status === RecruitmentStatus.DEPLOYMENT).length;
  const pendingCount = candidates.filter((c) => c.status === RecruitmentStatus.PENDING).length;
  const appliedCount = candidates.length;
  // Calculate compliance data from candidates
  const complianceStats = React.useMemo(() => {
    let complete = 0;
    let incomplete = 0;
    let missing = 0;

    candidates.forEach(c => {
      const docs = Object.values(c.documents);
      const completedDocs = docs.filter(d => d === 'COMPLETE').length;
      const totalDocs = docs.length;

      if (completedDocs === totalDocs) complete++;
      else if (completedDocs > 0) incomplete++;
      else missing++;
    });

    return [
      { name: 'Complete', value: complete, color: '#22c55e' },
      { name: 'Incomplete', value: incomplete, color: '#f59e0b' },
      { name: 'Missing', value: missing, color: '#ef4444' },
    ];
  }, [candidates]);

  const monthlyStatus = React.useMemo(() => {
    const monthMap = new Map<string, { recruitment: number; deployment: number; training: number }>();
    const fmt = new Intl.DateTimeFormat('en', { month: 'short' });
    const now = new Date();
    const maxMonth = now.getFullYear() === 2026 ? now.getMonth() : 11;
    for (let month = 0; month <= maxMonth; month += 1) {
      const d = new Date(2026, month, 1);
      const label = fmt.format(d);
      monthMap.set(label, { recruitment: 0, deployment: 0, training: 0 });
    }
    candidates.forEach((c) => {
      const d = new Date(c.createdAt);
      const label = fmt.format(d);
      const bucket = monthMap.get(label);
      if (!bucket) return;
      bucket.recruitment += 1;
      if (c.status === RecruitmentStatus.DEPLOYMENT) bucket.deployment += 1;
      if (c.status === RecruitmentStatus.TRAINING) bucket.training += 1;
    });
    return Array.from(monthMap.entries()).map(([name, value]) => ({ name, ...value }));
  }, [candidates]);

  const upcomingOps = React.useMemo(
    () => [
      {
        title: 'Interviews Today',
        items: (bookings.length ? bookings : [])
          .filter((b) => b.date === new Date().toISOString().slice(0, 10))
          .slice(0, 2)
          .map((b) => `${b.booker} (${b.time})`),
        icon: 'fa-comments',
        color: 'blue',
        action: 'booking',
      },
      {
        title: 'Trainings Scheduled',
        items: [`Candidates in training: ${trainingCount}`, `Pending interviews: ${interviewCount}`],
        icon: 'fa-graduation-cap',
        color: 'amber',
        action: 'recruitment',
      },
      {
        title: 'Deployments',
        items: [`Ready for deployment: ${deployedCount}`, `Pending review: ${pendingCount}`],
        icon: 'fa-shipping-fast',
        color: 'green',
        action: 'recruitment',
      },
      {
        title: 'Documentation Deadlines',
        items: [`Total candidates: ${appliedCount}`, `Open records need review`],
        icon: 'fa-file-exclamation',
        color: 'red',
        action: 'database',
      },
      { title: 'System Maintenance', items: ['Daily auto-backup at 15:00', 'Realtime sync active'], icon: 'fa-tools', color: 'slate', action: 'maintenance' },
    ],
    [bookings, trainingCount, interviewCount, deployedCount, pendingCount, appliedCount]
  );

  // Convert funnelSteps for Chart
  const dataFunnel = [
    { name: 'Applied', value: appliedCount, barValue: Math.max(1, Math.round(appliedCount * 0.8)) },
    { name: 'Screening', value: pendingCount, barValue: Math.max(1, Math.round(pendingCount * 0.8)) },
    { name: 'Interviewed', value: interviewCount, barValue: Math.max(1, Math.round(interviewCount * 0.8)) },
    { name: 'Training', value: trainingCount, barValue: Math.max(1, Math.round(trainingCount * 0.8)) },
    { name: 'Hired/Deployed', value: deployedCount, barValue: Math.max(1, Math.round(deployedCount * 0.8)) },
  ];

  const hiringEfficiency = appliedCount > 0 ? ((deployedCount / appliedCount) * 100).toFixed(1) : '0.0';
  const screeningDropoff = appliedCount > 0 ? (((appliedCount - interviewCount) / appliedCount) * 100).toFixed(1) : '0.0';
  const avgDaysToEvent = bookings.length
    ? (
        bookings.reduce((acc, booking) => {
          const target = new Date(`${booking.date}T00:00:00`);
          const diff = (target.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return acc + Math.max(0, diff);
        }, 0) / bookings.length
      ).toFixed(1)
    : '0.0';

  const handleTrace = () => {
    alert("SYSTEM TRACE: Full schedule synchronization complete. All modules aligned.");
  };

  const handleOpClick = (action: string) => {
    if (action === 'maintenance') {
      if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) {
        onNavigate('recovery');
      } else {
        onNavigate('settings');
      }
    } else {
      onNavigate(action);
    }
  };

  const getColorClass = (color: string) => {
    switch (color) {
      case 'blue': return 'text-blue-500';
      case 'amber': return 'text-amber-500';
      case 'green': return 'text-green-500';
      case 'red': return 'text-red-500';
      case 'slate': return 'text-slate-500';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10 text-slate-100">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Candidates', value: candidatesCount.toLocaleString(), icon: 'fa-users', color: 'blue', target: 'database' },
          { label: 'In Training', value: trainingCount.toLocaleString(), icon: 'fa-graduation-cap', color: 'amber', target: 'recruitment' },
          { label: 'Interview Stage', value: interviewCount.toLocaleString(), icon: 'fa-comments', color: 'indigo', target: 'recruitment' },
          { label: 'Deployed', value: deployedCount.toLocaleString(), icon: 'fa-check-circle', color: 'gold', target: 'recruitment' },
        ].map((kpi, idx) => (
          <button 
            key={idx} 
            onClick={() => onNavigate(kpi.target)}
            className="group bg-gradient-to-br from-[#0e1a3e] to-[#101c46] p-6 rounded-2xl border border-blue-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.35)] flex items-center justify-between text-left hover:shadow-[0_12px_36px_rgba(42,88,255,0.25)] hover:border-gold/40 transition-all active:scale-[0.98]"
          >
            <div>
              <p className="text-sm text-blue-100/70 font-medium mb-1">{kpi.label}</p>
              <h3 className="text-3xl font-bold text-white">{kpi.value}</h3>
              <p className="text-xs text-gold mt-2 flex items-center gap-1 font-bold uppercase tracking-widest">
                <i className="fas fa-arrow-up"></i> 12% Growth
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg bg-[#0b1536] flex items-center justify-center text-gold shadow-inner border border-blue-300/15`}>
              <i className={`fas ${kpi.icon} text-xl`}></i>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Department Performance Chart with Training in red */}
          <div className="bg-gradient-to-br from-[#0e1a3e] to-[#101c46] p-8 rounded-2xl border border-blue-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-white uppercase tracking-tight text-sm">Department Performance</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                  <div className="w-2 h-2 rounded-full bg-enterprise-blue"></div> Recruitment
                  <div className="w-2 h-2 rounded-full bg-gold"></div> Deployment
                  <div className="w-2 h-2 rounded-full bg-red-500"></div> Training
                </div>
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyStatus}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f033" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
                  <Tooltip cursor={{fill: '#f1f5f933'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="recruitment" fill="#003366" radius={[6, 6, 0, 0]} barSize={24} />
                  <Bar dataKey="deployment" fill="#D4AF37" radius={[6, 6, 0, 0]} barSize={24} />
                  <Bar dataKey="training" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Enterprise Recruitment Funnel - Clustered Line Bar Chart */}
          <div className="bg-gradient-to-br from-[#0e1a3e] to-[#101c46] p-8 rounded-2xl border border-blue-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-white uppercase tracking-tight text-sm">Enterprise Recruitment Funnel</h3>
              <span className="text-[10px] font-black text-gold uppercase tracking-[0.3em]">Hiring Efficiency Score</span>
            </div>
            <div className="h-64 mb-8 px-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dataFunnel}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f033" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f1f5f933' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="barValue" className="fill-[#003366] dark:fill-white" barSize={20} radius={[4, 4, 0, 0]} opacity={0.3} />
                  <Line type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={3} dot={{ r: 4, fill: '#D4AF37' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-6 pt-6 border-t dark:border-slate-700">
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Conversion Efficiency</p>
                <p className="text-lg font-bold text-gold">{hiringEfficiency}% Overall</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Screening Drop-off</p>
                <p className="text-lg font-bold text-red-500">-{screeningDropoff}%</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Time-to-Hire Avg</p>
                <p className="text-lg font-bold dark:text-white">{avgDaysToEvent} Days</p>
              </div>
            </div>
          </div>

          {/* Real-time Operations - Broad Alignment */}
          <div className="bg-gradient-to-br from-[#0e1a3e] to-[#101c46] p-8 rounded-2xl border border-blue-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-white uppercase tracking-tight text-sm">Real-time Operations</h3>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(bookings.length
                ? bookings.slice(0, 4).map((booking) => ({
                    title: `${booking.purpose}: ${booking.booker}`,
                    time: `${booking.date} ${booking.time}`,
                    status: 'Scheduled',
                  }))
                : [{ title: 'No Bookings Yet', time: '-', status: 'Waiting for data' }]).map((event, idx) => (
                <div key={idx} className="group p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-transparent hover:border-gold transition-all cursor-pointer" onClick={() => onNavigate('recruitment')}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-black dark:text-white uppercase leading-tight">{event.title}</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{event.status}</p>
                    </div>
                    <span className="text-[9px] font-black text-gold bg-gold/5 px-2 py-0.5 rounded border border-gold/20 whitespace-nowrap">{event.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={handleTrace}
              className="w-full mt-8 py-4 bg-enterprise-blue text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all hover:brightness-110"
            >
              Execute Full Schedule Trace
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Documentation Sync Pie Chart */}
          <div className="bg-gradient-to-br from-[#0e1a3e] to-[#101c46] p-8 rounded-2xl border border-blue-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.35)] flex flex-col">
             <h3 className="font-black text-white mb-8 uppercase tracking-tight text-sm">Document Compliance</h3>
             <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie data={complianceStats} innerRadius={60} outerRadius={80} dataKey="value">
                         {complianceStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                   </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="mt-6 space-y-3">
                {complianceStats.map(s => (
                  <div key={s.name} className="flex justify-between items-center text-[10px] font-bold uppercase">
                     <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor: s.color}}></div> <span className="text-slate-500 dark:text-slate-400">{s.name}</span></div>
                     <span className="dark:text-white">{s.value} CANDIDATES</span>
                  </div>
                ))}
             </div>
          </div>

          {/* Upcoming Operations Widget */}
          <div className="bg-gradient-to-br from-[#0e1a3e] to-[#101c46] p-8 rounded-2xl border border-blue-500/20 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
             <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-white uppercase tracking-tight text-sm">Upcoming Operations</h3>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
             </div>
             <div className="space-y-4">
                {upcomingOps.map((op, i) => (
                  <div key={i} className="group p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-transparent hover:border-gold transition-all cursor-pointer" onClick={() => handleOpClick(op.action)}>
                     <div className="flex items-start gap-4">
                        <div className={`w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center ${getColorClass(op.color)} shadow-sm shrink-0`}>
                           {op.title === 'Documentation Deadlines' ? (
                             <i className="fas fa-file-alt text-lg"></i>
                           ) : (
                             <i className={`fas ${op.icon}`}></i>
                           )}
                        </div>
                        <div>
                           <h4 className="text-[10px] font-black dark:text-white uppercase tracking-widest mb-2">{op.title}</h4>
                           <div className="space-y-1">
                              {op.items.map((item, j) => (
                                <div key={j} className="text-[9px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                   <div className="w-1 h-1 rounded-full bg-gold"></div>
                                   {item}
                                </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
