import React, { useEffect, useMemo, useState } from 'react';
import { Candidate } from '../types';
import {
  EMAIL_SENDER,
  SMS_SENDER,
  fetchSmsDeliveryReceipts,
  sendEmailCampaign,
  sendSmsCampaign,
} from '../services/communicationsService';

type CampaignStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

type CampaignHistory = {
  id: string;
  channel: 'SMS' | 'Email' | 'WhatsApp';
  target: string;
  time: string;
  status: CampaignStatus;
  providerMessageIds: string[];
  requestId?: string;
  failedReason?: string;
  body: string;
  recipients: string[];
};

const pollMs = Number(import.meta.env.VITE_SMS_STATUS_POLL_MS || 10000);

const BroadcastModule: React.FC<{ candidates: Candidate[] }> = ({ candidates }) => {
  const [channel, setChannel] = useState<'SMS' | 'Email' | 'WhatsApp'>('SMS');
  const [target, setTarget] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<CampaignHistory[]>([]);

  const toggleTarget = (value: string) => {
    setTarget((prev) => (prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value]));
  };

  const filteredCandidates = useMemo(() => {
    if (target.length === 0 || target.includes('all')) return candidates;
    return candidates.filter((candidate) => target.includes(candidate.status));
  }, [candidates, target]);

  const recipients = useMemo(() => {
    const emails = Array.from(new Set(filteredCandidates.map((candidate) => candidate.email).filter(Boolean)));
    const phones = Array.from(new Set(filteredCandidates.map((candidate) => candidate.phone).filter(Boolean)));
    return { emails, phones };
  }, [filteredCandidates]);

  const updateCampaignStatus = (
    campaignId: string,
    status: CampaignStatus,
    failedReason?: string
  ) => {
    setHistory((prev) =>
      prev.map((entry) =>
        entry.id === campaignId ? { ...entry, status, failedReason } : entry
      )
    );
  };

  useEffect(() => {
    const pending = history.filter(
      (entry) => entry.channel === 'SMS' && (entry.status === 'QUEUED' || entry.status === 'SENT')
    );
    if (pending.length === 0) return;

    const timer = window.setInterval(async () => {
      const ids = pending.flatMap((entry) => entry.providerMessageIds);
      if (ids.length === 0) return;

      try {
        const receipts = await fetchSmsDeliveryReceipts(ids);
        setHistory((prev) =>
          prev.map((entry) => {
            if (entry.channel !== 'SMS') return entry;
            if (entry.status !== 'QUEUED' && entry.status !== 'SENT') return entry;

            const scoped = receipts.filter((receipt) => entry.providerMessageIds.includes(receipt.providerMessageId));
            if (scoped.length === 0) return entry;

            const hasFailed = scoped.some((receipt) => receipt.status === 'FAILED');
            const allDelivered = scoped.every((receipt) => receipt.status === 'DELIVERED');
            const allSentOrDelivered = scoped.every(
              (receipt) => receipt.status === 'SENT' || receipt.status === 'DELIVERED'
            );

            if (hasFailed) {
              const failed = scoped.find((receipt) => receipt.status === 'FAILED');
              return { ...entry, status: 'FAILED', failedReason: failed?.failedReason || 'Delivery failed.' };
            }
            if (allDelivered) return { ...entry, status: 'DELIVERED', failedReason: undefined };
            if (allSentOrDelivered) return { ...entry, status: 'SENT', failedReason: undefined };
            return entry;
          })
        );
      } catch {
        // keep current status and retry at next poll tick
      }
    }, pollMs);

    return () => window.clearInterval(timer);
  }, [history]);

  const buildTargetLabel = () => (target.length > 0 ? target.join(', ') : 'All Candidates');

  const queueHistory = (entry: Omit<CampaignHistory, 'id' | 'time'>) => {
    setHistory((prev) => [
      {
        ...entry,
        id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: new Date().toLocaleString(),
      },
      ...prev,
    ]);
  };

  const sendCampaignByChannel = async (
    selectedChannel: 'SMS' | 'Email' | 'WhatsApp',
    body: string,
    emails: string[],
    phones: string[]
  ) => {
    if (selectedChannel === 'Email') {
      const result = await sendEmailCampaign(emails, body);
      return {
        channel: 'Email' as const,
        result,
      };
    }
    const smsBody = selectedChannel === 'WhatsApp' ? `[WhatsApp] ${body}` : body;
    const result = await sendSmsCampaign(phones, smsBody);
    return {
      channel: selectedChannel,
      result,
    };
  };

  const handleSend = async () => {
    if (!message.trim()) {
      alert('Message body is required.');
      return;
    }

    if (channel === 'Email' && recipients.emails.length === 0) {
      alert('No recipient emails were resolved from candidate data.');
      return;
    }

    if ((channel === 'SMS' || channel === 'WhatsApp') && recipients.phones.length === 0) {
      alert('No recipient phone numbers were resolved from candidate data.');
      return;
    }

    setSending(true);
    try {
      const { channel: usedChannel, result } = await sendCampaignByChannel(
        channel,
        message.trim(),
        recipients.emails,
        recipients.phones
      );
      queueHistory({
        channel: usedChannel,
        target: buildTargetLabel(),
        status: usedChannel === 'Email' ? (result.failed > 0 ? 'FAILED' : 'SENT') : (result.failed > 0 ? 'FAILED' : 'QUEUED'),
        providerMessageIds: result.providerMessageIds,
        requestId: result.requestId,
        failedReason: result.failed > 0 ? `${result.failed} recipient(s) failed.` : undefined,
        body: message.trim(),
        recipients: usedChannel === 'Email' ? recipients.emails : recipients.phones,
      });

      setMessage('');
    } catch (error) {
      queueHistory({
        channel,
        target: buildTargetLabel(),
        status: 'FAILED',
        providerMessageIds: [],
        failedReason: error instanceof Error ? error.message : 'Dispatch failed.',
        body: message.trim(),
        recipients: channel === 'Email' ? recipients.emails : recipients.phones,
      });
    } finally {
      setSending(false);
    }
  };

  const retryFailedCampaign = async (campaignId: string) => {
    const failedCampaign = history.find((entry) => entry.id === campaignId);
    if (!failedCampaign) return;
    if (failedCampaign.channel === 'Email') {
      setChannel('Email');
    } else if (failedCampaign.channel === 'WhatsApp') {
      setChannel('WhatsApp');
    } else {
      setChannel('SMS');
    }
    updateCampaignStatus(campaignId, 'QUEUED');
    try {
      const { channel: usedChannel, result } = await sendCampaignByChannel(
        failedCampaign.channel,
        failedCampaign.body,
        failedCampaign.channel === 'Email' ? failedCampaign.recipients : [],
        failedCampaign.channel === 'Email' ? [] : failedCampaign.recipients
      );
      setHistory((prev) =>
        prev.map((entry) =>
          entry.id === campaignId
            ? {
                ...entry,
                channel: usedChannel,
                status: usedChannel === 'Email' ? (result.failed > 0 ? 'FAILED' : 'SENT') : (result.failed > 0 ? 'FAILED' : 'QUEUED'),
                providerMessageIds: result.providerMessageIds,
                requestId: result.requestId,
                failedReason: result.failed > 0 ? `${result.failed} recipient(s) failed.` : undefined,
                time: new Date().toLocaleString(),
              }
            : entry
        )
      );
    } catch (error) {
      updateCampaignStatus(
        campaignId,
        'FAILED',
        error instanceof Error ? error.message : 'Retry failed.'
      );
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-10 rounded-3xl border dark:border-slate-700 shadow-sm space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-[#003366] dark:text-white uppercase tracking-tight">
              Mass Broadcast Console
            </h2>
            <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-700">
              {(['SMS', 'Email', 'WhatsApp'] as const).map((entry) => (
                <button
                  key={entry}
                  onClick={() => setChannel(entry)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    channel === entry ? 'bg-enterprise-blue text-white shadow-lg' : 'text-slate-400 hover:text-enterprise-blue'
                  }`}
                >
                  {entry}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-black text-[#003366] dark:text-slate-400 uppercase tracking-[0.3em]">
                Communication payload
              </label>
              <span className="text-[10px] font-bold text-slate-400">
                From: {channel === 'Email' ? EMAIL_SENDER : SMS_SENDER}
              </span>
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Recipients from database: {recipients.phones.length} phone(s), {recipients.emails.length} email(s)
            </div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="w-full h-48 p-6 bg-slate-50 dark:bg-slate-900/50 border dark:border-slate-700 rounded-3xl outline-none text-[#003366] dark:text-white font-bold text-sm focus:border-gold transition-colors"
              placeholder={`Type ${channel} message here...`}
            />
          </div>

          <div className="pt-4">
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full py-5 bg-enterprise-blue text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl shadow-blue-900/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
            >
              <i className={`fas ${channel === 'SMS' ? 'fa-sms' : channel === 'Email' ? 'fa-envelope' : 'fa-bell'} text-gold`} />
              {sending ? 'Sending...' : `Execute ${channel} Transmission`}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl border dark:border-slate-700 shadow-sm flex flex-col">
          <h3 className="text-sm font-black text-[#003366] dark:text-white uppercase tracking-widest mb-8">Recipient Protocol</h3>
          <div className="space-y-4 flex-1">
            {[
              { id: 'all', label: 'All Candidates' },
              { id: 'TRAINING', label: 'Training Phase' },
              { id: 'INTERVIEW', label: 'Interview Phase' },
              { id: 'DEPLOYMENT', label: 'Deployment Only' },
              { id: 'PENDING', label: 'Pending Queue' },
            ].map((item) => (
              <div
                key={item.id}
                onClick={() => toggleTarget(item.id)}
                className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                  target.includes(item.id) ? 'border-gold bg-gold/5' : 'border-slate-100 dark:border-slate-700'
                }`}
              >
                <span className="text-[10px] font-black uppercase text-[#003366] dark:text-white tracking-widest">{item.label}</span>
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center ${
                    target.includes(item.id) ? 'bg-gold text-white' : 'bg-slate-200 dark:bg-slate-700 text-transparent'
                  }`}
                >
                  <i className="fas fa-check text-[10px]" />
                </div>
              </div>
            ))}
          </div>
          <div className="pt-8 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest leading-loose">
            Recipient filters are mapped directly to live candidate records.
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-10 rounded-3xl border dark:border-slate-700 shadow-sm">
        <h3 className="text-sm font-black text-[#003366] dark:text-white uppercase tracking-widest mb-8">Transmission History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-slate-700 text-left">
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Channel</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Audience</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b dark:border-slate-700/50 last:border-none">
                  <td className="py-4 font-bold text-sm dark:text-white">{entry.channel}</td>
                  <td className="py-4 text-sm text-slate-600 dark:text-slate-300">
                    {entry.target}
                    {entry.failedReason && <div className="text-xs text-red-500 mt-1">{entry.failedReason}</div>}
                  </td>
                  <td className="py-4 text-xs font-mono text-slate-400">{entry.time}</td>
                  <td className="py-4 text-sm font-black text-slate-700 dark:text-slate-200">{entry.status}</td>
                  <td className="py-4 text-right">
                    {entry.status === 'FAILED' ? (
                      <button
                        onClick={() => retryFailedCampaign(entry.id)}
                        className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest"
                      >
                        Retry
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                    No transmissions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BroadcastModule;
