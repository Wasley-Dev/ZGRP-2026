import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';

const dataTrends = [
  { month: 'Jan', applicants: 400, hires: 40 },
  { month: 'Feb', applicants: 300, hires: 25 },
  { month: 'Mar', applicants: 600, hires: 85 },
  { month: 'Apr', applicants: 800, hires: 120 },
  { month: 'May', applicants: 500, hires: 60 },
];

const dataSource = [
  { name: 'LinkedIn', value: 450, color: '#0077b5' },
  { name: 'Website', value: 200, color: '#003366' },
  { name: 'Referral', value: 300, color: '#D4AF37' },
  { name: 'Agencies', value: 150, color: '#10b981' },
];

const RecruitmentHub: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Training', val: 412, icon: 'fa-graduation-cap' },
            { label: 'Interview', val: 89, icon: 'fa-comments' },
            { label: 'Deployment', val: 2950, icon: 'fa-shipping-fast' },
            { label: 'Pending', val: 120, icon: 'fa-hourglass-half' }
          ].map(stat => (
            <div key={stat.label} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border dark:border-slate-700 shadow-sm flex items-center justify-between">
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <h3 className="text-2xl font-black dark:text-white tracking-tight">{stat.val.toLocaleString()}</h3>
               </div>
               <div className="text-gold text-2xl drop-shadow-md"><i className={`fas ${stat.icon}`}></i></div>
            </div>
          ))}
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 shadow-sm">
             <h3 className="text-sm font-black text-[#003366] dark:text-white uppercase tracking-widest mb-8">Hiring Velocity & Trends</h3>
             <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={dataTrends}>
                      <defs>
                        <linearGradient id="colorHires" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f033" />
                      <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      <Tooltip />
                      <Area type="monotone" dataKey="applicants" stroke="#ef4444" fillOpacity={1} fill="#ef444411" />
                      <Area type="monotone" dataKey="hires" stroke="#D4AF37" fillOpacity={1} fill="url(#colorHires)" />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 shadow-sm">
             <h3 className="text-sm font-black text-[#003366] dark:text-white uppercase tracking-widest mb-8">Candidate Sources</h3>
             <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie data={dataSource} innerRadius={60} outerRadius={80} dataKey="value">
                         {dataSource.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                   </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="mt-6 space-y-3">
                {dataSource.map(s => (
                  <div key={s.name} className="flex justify-between items-center text-[10px] font-bold uppercase">
                     <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor: s.color}}></div> <span className="text-slate-500">{s.name}</span></div>
                     <span className="dark:text-white">{s.value}</span>
                  </div>
                ))}
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#001a33] p-10 rounded-[3rem] text-white space-y-8 relative overflow-hidden">
             <h4 className="text-gold font-black uppercase tracking-[0.3em] text-[10px] relative z-10">Smart Enterprise Insights</h4>
             <div className="space-y-6 relative z-10">
                {[ 
                  { label: 'Longest Hiring Delay', val: 'Architecture Lead (42 Days)' },
                  { label: 'Top Candidate Source', val: 'LinkedIn (Global)' },
                  { label: 'Productivity Alert', val: 'HR-HQ-02 At Risk' }
                ].map(i => (
                  <div key={i.label} className="flex justify-between border-b border-white/5 pb-4">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{i.label}</span>
                     <span className="text-xs font-bold text-white uppercase">{i.val}</span>
                  </div>
                ))}
             </div>
             <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border dark:border-slate-700 shadow-sm">
             <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 text-center">Recruitment Funnel Overview</h4>
             <div className="space-y-4">
                {[
                  { label: 'Applied', per: 100 },
                  { label: 'Screening', per: 85 },
                  { label: 'Shortlisted', per: 60 },
                  { label: 'Interviewed', per: 35 },
                  { label: 'Offered', per: 12 },
                  { label: 'Hired / Deployed', per: 8 }
                ].map(f => (
                  <div key={f.label} className="space-y-1">
                     <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-500">
                        <span>{f.label}</span>
                        <span>{f.per}%</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gold rounded-full" style={{width: `${f.per}%`}}></div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
       </div>
    </div>
  );
};

export default RecruitmentHub;
