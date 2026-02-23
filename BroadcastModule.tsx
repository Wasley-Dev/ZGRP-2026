
import React, { useState } from 'react';

const BroadcastModule: React.FC = () => {
  const [channel, setChannel] = useState<'SMS' | 'Email' | 'WhatsApp'>('SMS');
  const [target, setTarget] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<{ id: string, channel: string, target: string, time: string, status: string }[]>([
    { id: '1', channel: 'Email', target: 'All Candidates', time: '2 hours ago', status: 'Delivered' },
    { id: '2', channel: 'SMS', target: 'Interview Phase', time: '1 day ago', status: 'Delivered' }
  ]);

  const toggleTarget = (t: string) => {
    setTarget(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleSend = () => {
    const sender = channel === 'Email' ? 'customercare@zayagroupltd.com' : '+255779630201';
    alert(`BROADCAST SYSTEM: Sending ${channel} to ${target.length > 0 ? target.join(', ') : 'ALL CANDIDATES'}...\n\nSender: ${sender}`);
    
    setHistory(prev => [{
      id: Date.now().toString(),
      channel,
      target: target.length > 0 ? target.join(', ') : 'All Candidates',
      time: 'Just now',
      status: 'Queued'
    }, ...prev]);
    
    setMessage('');
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Compose Area */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-10 rounded-3xl border dark:border-slate-700 shadow-sm space-y-8">
           <div className="flex justify-between items-center">
             <h2 className="text-2xl font-black text-[#003366] dark:text-white uppercase tracking-tight">Mass Broadcast Console</h2>
             <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-700">
                {(['SMS', 'Email', 'WhatsApp'] as const).map(c => (
                  <button 
                    key={c}
                    onClick={() => setChannel(c)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${channel === c ? 'bg-enterprise-blue text-white shadow-lg' : 'text-slate-400 hover:text-enterprise-blue'}`}
                  >
                    {c}
                  </button>
                ))}
             </div>
           </div>

           <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black text-[#003366] dark:text-slate-400 uppercase tracking-[0.3em]">Communication payload</label>
                <span className="text-[10px] font-bold text-slate-400">
                  From: {channel === 'Email' ? 'customercare@zayagroupltd.com' : '+255 779 630 201'}
                </span>
              </div>
              <textarea 
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full h-48 p-6 bg-slate-50 dark:bg-slate-900/50 border dark:border-slate-700 rounded-3xl outline-none text-[#003366] dark:text-white font-bold text-sm focus:border-gold transition-colors"
                placeholder={`Type ${channel} message here...`}
              ></textarea>
           </div>

           <div className="pt-4">
              <button 
                onClick={handleSend}
                className="w-full py-5 bg-enterprise-blue text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-blue-900/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                 <i className={`fas ${channel === 'SMS' ? 'fa-sms' : channel === 'Email' ? 'fa-envelope' : 'fa-bell'} text-gold`}></i>
                 Execute {channel} Transmission
              </button>
           </div>
        </div>

        {/* Filter Area */}
        <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl border dark:border-slate-700 shadow-sm flex flex-col">
           <h3 className="text-sm font-black text-[#003366] dark:text-white uppercase tracking-widest mb-8">Recipient Protocol</h3>
           <div className="space-y-4 flex-1">
              {[
                { id: 'all', label: 'All Candidates' },
                { id: 'TRAINING', label: 'Training Phase' },
                { id: 'INTERVIEW', label: 'Interview Phase' },
                { id: 'DEPLOYMENT', label: 'Deployment Only' },
                { id: 'PENDING', label: 'Pending Queue' }
              ].map(item => (
                <div 
                  key={item.id}
                  onClick={() => toggleTarget(item.id)}
                  className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${target.includes(item.id) ? 'border-gold bg-gold/5' : 'border-slate-100 dark:border-slate-700'}`}
                >
                   <span className="text-[10px] font-black uppercase text-[#003366] dark:text-white tracking-widest">{item.label}</span>
                   <div className={`w-5 h-5 rounded flex items-center justify-center ${target.includes(item.id) ? 'bg-gold text-white' : 'bg-slate-200 dark:bg-slate-700 text-transparent'}`}>
                      <i className="fas fa-check text-[10px]"></i>
                   </div>
                </div>
              ))}
           </div>
           <div className="pt-8 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest leading-loose">
              Recipient filters ensure targeted organizational messaging and cost-effective communication flows.
           </div>
        </div>
      </div>

      {/* Previous Broadcasts */}
      <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl border dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-black text-[#003366] dark:text-white uppercase tracking-widest mb-8">Transmission History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-slate-700 text-left">
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Channel</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Audience</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-b dark:border-slate-700/50 last:border-none">
                  <td className="py-4 font-bold text-sm dark:text-white flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${h.channel === 'SMS' ? 'bg-blue-500' : h.channel === 'Email' ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                    {h.channel}
                  </td>
                  <td className="py-4 text-sm text-slate-600 dark:text-slate-300">{h.target}</td>
                  <td className="py-4 text-xs font-mono text-slate-400">{h.time}</td>
                  <td className="py-4 text-right">
                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest">
                      {h.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BroadcastModule;
