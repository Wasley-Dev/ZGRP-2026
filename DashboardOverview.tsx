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

import { Candidate, SystemUser, UserRole } from '../types';

interface DashboardProps {
  onNavigate: (module: string) => void;
  candidatesCount: number;
  candidates: Candidate[];
  user: SystemUser;
}

// Dept Performance Data with Training added
const dataPerformance = [
  { name: 'Jan', recruitment: 400, deployment: 200, training: 50 },
  { name: 'Feb', recruitment: 300, deployment: 210, training: 60 },
  { name: 'Mar', recruitment: 200, deployment: 290, training: 80 },
  { name: 'Apr', recruitment: 278, deployment: 400, training: 30 },
  { name: 'May', recruitment: 189, deployment: 120, training: 70 },
];

const DashboardOverview: React.FC<DashboardProps> = ({ onNavigate, candidatesCount, candidates, user }) => {
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

  const funnelSteps = [
    { label: 'Applied', value: 1200, icon: 'fa-file-signature' },
    { label: 'Screening', value: 850, icon: 'fa-search' },
    { label: 'Shortlisted', value: 420, icon: 'fa-star' },
    { label: 'Interviewed', value: 180, icon: 'fa-comments' },
    { label: 'Offered', value: 54, icon: 'fa-envelope-open-text' },
    { label: 'Hired/Deployed', value: 42, icon: 'fa-user-check' },
  ];

  const upcomingOps = [
    { title: 'Interviews Today', items: ['Sarah M. (10:00 AM)', 'John K. (02:30 PM)'], icon: 'fa-comments', color: 'blue', action: 'recruitment' },
    { title: 'Trainings Scheduled', items: ['Safety Workshop (Mon)', 'ERP Training (Wed)'], icon: 'fa-graduation-cap', color: 'amber', action: 'booking' },
    { title: 'Deployments', items: ['Batch 04 - Logistics', 'Batch 05 - Ops'], icon: 'fa-shipping-fast', color: 'green', action: 'recruitment' },
    { title: 'Documentation Deadlines', items: ['12 Pending Incomplete TINs', '5 Missing ID scans'], icon: 'fa-file-exclamation', color: 'red', action: 'database' },
    { title: 'System Maintenance', items: ['Backup sync (11 PM)', 'Server Patch (Sunday)'], icon: 'fa-tools', color: 'slate', action: 'maintenance' },
  ];

  // Convert funnelSteps for Chart
  const dataFunnel = funnelSteps.map((step) => ({
    name: step.label,
    value: step.value,
    barValue: step.value * 0.8 // Simulated bar value for clustered effect
  }));

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-10">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Candidates', value: candidatesCount.toLocaleString(), icon: 'fa-users', color: 'blue', target: 'database' },
          { label: 'In Training', value: '412', icon: 'fa-graduation-cap', color: 'amber', target: 'recruitment' },
          { label: 'Interview Stage', value: '89', icon: 'fa-comments', color: 'indigo', target: 'recruitment' },
          { label: 'Deployed', value: '2,950', icon: 'fa-check-circle', color: 'gold', target: 'recruitment' },
        ].map((kpi, idx) => (
          <button 
            key={idx} 
            onClick={() => onNavigate(kpi.target)}
            className="group bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between text-left hover:shadow-md hover:border-gold transition-all active:scale-[0.98]"
          >
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">{kpi.label}</p>
              <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{kpi.value}</h3>
              <p className="text-xs text-gold mt-2 flex items-center gap-1 font-bold uppercase tracking-widest">
                <i className="fas fa-arrow-up"></i> 12% Growth
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center text-gold shadow-inner`}>
              <i className={`fas ${kpi.icon} text-xl`}></i>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Department Performance Chart with Training in red */}
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-sm">Department Performance</h3>
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
                <BarChart data={dataPerformance}>
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
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-sm">Enterprise Recruitment Funnel</h3>
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
                <p className="text-lg font-bold text-gold">3.5% Overall</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Screening Drop-off</p>
                <p className="text-lg font-bold text-red-500">-29%</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Time-to-Hire Avg</p>
                <p className="text-lg font-bold dark:text-white">12 Days</p>
              </div>
            </div>
          </div>

          {/* Real-time Operations - Broad Alignment */}
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-sm">Real-time Operations</h3>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Technical Interview: Sarah M.', time: '10:00 AM', status: 'In Progress', color: 'blue' },
                { title: 'Safety Training Workshop', time: '02:00 PM', status: 'Scheduled', color: 'gold' },
                { title: 'Logistics Deployment - B04', time: '04:30 PM', status: 'Preparation', color: 'indigo' },
                { title: 'Global Database Sync', time: '11:00 PM', status: 'Automated', color: 'slate' },
              ].map((event, idx) => (
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
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
             <h3 className="font-black text-slate-800 dark:text-white mb-8 uppercase tracking-tight text-sm">Document Compliance</h3>
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
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <div className="flex justify-between items-center mb-8">
                <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-sm">Upcoming Operations</h3>
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
