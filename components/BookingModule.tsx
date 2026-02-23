import React, { useMemo, useState } from 'react';
import { BookingEntry, SystemUser } from '../types';

interface BookingModuleProps {
  bookings: BookingEntry[];
  currentUser: SystemUser;
  onUpsertBooking: (booking: BookingEntry) => void;
}

const BookingModule: React.FC<BookingModuleProps> = ({ bookings, currentUser, onUpsertBooking }) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingEntry | null>(null);
  const [form, setForm] = useState({
    booker: '',
    date: '',
    time: '',
    purpose: 'Technical Interview',
    remarks: '',
  });

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)),
    [bookings]
  );

  const openCreate = () => {
    setSelectedBooking(null);
    setForm({
      booker: currentUser.name,
      date: new Date().toISOString().slice(0, 10),
      time: '09:00',
      purpose: 'Technical Interview',
      remarks: '',
    });
    setShowForm(true);
  };

  const openEdit = (booking: BookingEntry) => {
    setSelectedBooking(booking);
    setForm({
      booker: booking.booker,
      date: booking.date,
      time: booking.time,
      purpose: booking.purpose,
      remarks: booking.remarks,
    });
    setShowForm(true);
  };

  const submit = () => {
    if (!form.booker.trim() || !form.date.trim() || !form.time.trim() || !form.purpose.trim()) {
      alert('Booker, date, time, and purpose are required.');
      return;
    }
    onUpsertBooking({
      id: selectedBooking?.id || `BK-${Date.now()}`,
      booker: form.booker.trim(),
      date: form.date.trim(),
      time: form.time.trim(),
      purpose: form.purpose.trim(),
      remarks: form.remarks.trim(),
      createdAt: selectedBooking?.createdAt || new Date().toISOString(),
      createdByUserId: selectedBooking?.createdByUserId || currentUser.id,
    });
    setShowForm(false);
    setSelectedBooking(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 shadow-sm">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-2xl font-black text-enterprise-blue dark:text-white uppercase tracking-tight">
              Scheduling Architecture
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Live booking data from portal database
            </p>
          </div>
          <button
            onClick={openCreate}
            className="px-6 py-3 bg-enterprise-blue text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/20"
          >
            New Booking Protocol
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 space-y-4">
            {sortedBookings.map((b) => (
              <div
                key={b.id}
                className="group p-6 bg-slate-50 dark:bg-slate-900/50 border dark:border-slate-700 rounded-2xl flex items-center justify-between hover:border-gold transition-all"
              >
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-gold shadow-sm border dark:border-slate-700">
                    <i className="fas fa-clock text-xl"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-black dark:text-white uppercase tracking-tight">{b.booker}</h4>
                      <span className="text-[9px] font-black text-gold bg-gold/10 px-2 py-0.5 rounded">
                        {b.date} {b.time}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{b.purpose}</p>
                    <p className="text-xs text-slate-400 mt-2 italic">"{b.remarks}"</p>
                  </div>
                </div>
                <button
                  onClick={() => openEdit(b)}
                  className="px-4 py-2 border-2 border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-gold hover:text-gold transition-all"
                >
                  Execute Protocol: Reschedule
                </button>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border dark:border-slate-700 text-center flex flex-col items-center justify-center">
            <div className="text-3xl font-black text-gold mb-2">{sortedBookings.length}</div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Active Bookings</p>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border dark:border-slate-700">
            <div className="p-8 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="text-xl font-black dark:text-white uppercase tracking-tight">
                {selectedBooking ? 'Execute Protocol: Reschedule' : 'New Booking Entry'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-10 space-y-6">
              <input
                className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                value={form.booker}
                onChange={(e) => setForm((prev) => ({ ...prev, booker: e.target.value }))}
                placeholder="Booker Identity"
              />
              <div className="grid grid-cols-3 gap-4">
                <input
                  type="date"
                  className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
                <input
                  type="time"
                  className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                  value={form.time}
                  onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))}
                />
                <select
                  className="w-full p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                  value={form.purpose}
                  onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))}
                >
                  <option>Training</option>
                  <option>Technical Interview</option>
                  <option>Background Check</option>
                  <option>Deployment Briefing</option>
                </select>
              </div>
              <textarea
                className="w-full h-32 p-4 rounded-2xl border dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold dark:text-white outline-none"
                value={form.remarks}
                onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="Audit Remarks"
              />
              <button
                onClick={submit}
                className="w-full py-4 bg-enterprise-blue text-white rounded-2xl font-black uppercase tracking-widest shadow-xl"
              >
                Finalize Schedule Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingModule;
