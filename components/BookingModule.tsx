import React, { useMemo, useState } from 'react';
import { BookingEntry, SystemUser } from '../types';

interface BookingModuleProps {
  bookings: BookingEntry[];
  users: SystemUser[];
  currentUser: SystemUser;
  onUpsertBooking: (booking: BookingEntry) => void;
}

const BookingModule: React.FC<BookingModuleProps> = ({ bookings, users, currentUser, onUpsertBooking }) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const startOfToday = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');

  const [showForm, setShowForm] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [form, setForm] = useState({
    booker: '',
    date: '',
    time: '',
    purpose: 'Technical Interview',
    remarks: '',
    booking_result: '',
  });

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)),
    [bookings]
  );

  const upcomingBookings = useMemo(
    () => sortedBookings.filter((b) => new Date(`${b.date}T00:00:00`) >= startOfToday),
    [sortedBookings]
  );

  const pastBookings = useMemo(
    () => sortedBookings.filter((b) => new Date(`${b.date}T00:00:00`) < startOfToday),
    [sortedBookings]
  );

  const selectedDateBookings = useMemo(
    () => sortedBookings.filter((b) => b.date === selectedDate),
    [sortedBookings, selectedDate]
  );

  const bookingDates = useMemo(() => new Set(sortedBookings.map((b) => b.date)), [sortedBookings]);
  const bookingsPerDay = useMemo(() => {
    const map: Record<string, number> = {};
    sortedBookings.forEach((entry) => {
      map[entry.date] = (map[entry.date] || 0) + 1;
    });
    return map;
  }, [sortedBookings]);

  const monthLabel = useMemo(
    () => calendarMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    [calendarMonth]
  );

  const monthDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const numberOfDays = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ iso: string; day: number } | null> = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= numberOfDays; day += 1) {
      const iso = new Date(year, month, day).toISOString().slice(0, 10);
      cells.push({ iso, day });
    }
    return cells;
  }, [calendarMonth]);

  const bookingsByMonth = useMemo(() => {
    const counts = new Array(12).fill(0) as number[];
    sortedBookings.forEach((booking) => {
      const d = new Date(`${booking.date}T00:00:00`);
      if (d.getFullYear() === calendarYear) counts[d.getMonth()] += 1;
    });
    return counts;
  }, [sortedBookings, calendarYear]);

  const formatBookingDate = (isoDate: string) =>
    new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const getBookedByName = (createdByUserId: string) =>
    users.find((u) => u.id === createdByUserId)?.name || 'Unknown User';

  const isPast = (isoDate: string) => new Date(`${isoDate}T00:00:00`) < startOfToday;

  const openCreate = () => {
    setSelectedBooking(null);
    setForm({
      booker: currentUser.name,
      date: todayIso,
      time: '09:00',
      purpose: 'Technical Interview',
      remarks: '',
      booking_result: '',
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
      booking_result: (booking as any).booking_result || '',
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
      booking_result: form.booking_result.trim(),
      createdAt: selectedBooking?.createdAt || new Date().toISOString(),
      createdByUserId: selectedBooking?.createdByUserId || currentUser.id,
    } as any);
    setShowForm(false);
    setSelectedBooking(null);
  };

  // Reusable card style matching dashboard blue-hue theme
  const cardClass = 'bg-[#0f1a2e] border border-[#1e3a5f] rounded-2xl';
  const innerCardClass = 'bg-[#0a1628] border border-[#1e3a5f] rounded-xl';

  const displayList = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full overflow-x-hidden">
      {/* Header */}
      <div className={`${cardClass} p-4 md:p-8`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-10">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-blue-400 uppercase tracking-tight">
              Scheduling Architecture
            </h2>
            <p className="text-[10px] font-bold text-blue-300/50 uppercase tracking-widest mt-1">
              Live booking data — synced to {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="px-5 py-3 bg-gold text-enterprise-blue rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-gold/30 w-full md:w-auto"
          >
            + New Booking
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
          {/* Left Panel */}
          <div className="xl:col-span-3 space-y-6">
            {/* Selected date schedule */}
            <div className={`${cardClass} p-4 md:p-6 min-h-[300px]`}>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">
                {formatBookingDate(selectedDate)} Schedule
              </p>
              <div className="space-y-3 max-h-[390px] overflow-auto pr-1">
                {selectedDateBookings.length === 0 ? (
                  <div className="h-[260px] rounded-2xl border border-dashed border-[#1e3a5f] flex flex-col items-center justify-center text-center p-6">
                    <i className="fas fa-calendar-day text-3xl text-gold mb-3"></i>
                    <p className="text-sm font-black text-white uppercase tracking-wider">No Schedule On This Date</p>
                    <p className="text-xs text-blue-300/60 mt-2">Select another date or create a new booking.</p>
                  </div>
                ) : (
                  selectedDateBookings.map((entry) => (
                    <div key={entry.id} className={`${innerCardClass} p-4`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-xs font-black text-white uppercase">{entry.time} — {entry.booker}</p>
                        <button
                          onClick={() => openEdit(entry)}
                          className="px-3 py-1.5 border border-[#1e3a5f] rounded-lg text-[9px] font-black uppercase tracking-widest text-blue-300 hover:border-gold hover:text-gold transition-all"
                        >
                          Reschedule
                        </button>
                      </div>
                      <p className="text-[11px] text-blue-300/70 mt-1">{entry.purpose}</p>
                      <p className="text-[10px] text-blue-300/50 mt-1">Booked by: {getBookedByName(entry.createdByUserId)}</p>
                      {isPast(entry.date) && (entry as any).booking_result && (
                        <div className="mt-2 p-2 bg-green-900/30 border border-green-500/30 rounded-lg">
                          <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest">Outcome:</p>
                          <p className="text-[11px] text-green-300 mt-0.5">{(entry as any).booking_result}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Upcoming / Past tabs */}
            <div className={`${cardClass} p-4 md:p-6`}>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    activeTab === 'upcoming'
                      ? 'bg-gold text-enterprise-blue'
                      : 'border border-[#1e3a5f] text-blue-300 hover:border-gold'
                  }`}
                >
                  Upcoming ({upcomingBookings.length})
                </button>
                <button
                  onClick={() => setActiveTab('past')}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                    activeTab === 'past'
                      ? 'bg-blue-600 text-white'
                      : 'border border-[#1e3a5f] text-blue-300 hover:border-blue-400'
                  }`}
                >
                  Past ({pastBookings.length})
                </button>
              </div>

              <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
                {displayList.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#1e3a5f] flex flex-col items-center justify-center text-center p-6">
                    <i className="fas fa-calendar-plus text-3xl text-gold mb-3"></i>
                    <p className="text-sm font-black text-white uppercase tracking-wider">
                      {activeTab === 'upcoming' ? 'No Upcoming Bookings' : 'No Past Bookings'}
                    </p>
                    <p className="text-xs text-blue-300/50 mt-2">
                      {activeTab === 'upcoming' ? 'Create a new booking to get started.' : 'Completed bookings will appear here.'}
                    </p>
                  </div>
                ) : (
                  displayList.map((b) => (
                    <div
                      key={b.id}
                      className={`${innerCardClass} p-4 hover:border-gold transition-all cursor-pointer`}
                      onClick={() => openEdit(b)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h4 className="text-xs font-black text-white uppercase tracking-tight">{b.booker}</h4>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                          isPast(b.date)
                            ? 'text-blue-300 bg-blue-900/40'
                            : 'text-gold bg-gold/10'
                        }`}>
                          {formatBookingDate(b.date)} {b.time}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-blue-300/70 uppercase tracking-widest mt-1">{b.purpose}</p>
                      <p className="text-[10px] text-blue-300/50 mt-1">Booked by: {getBookedByName(b.createdByUserId)}</p>
                      {b.remarks && <p className="text-[11px] text-blue-300/40 mt-1 italic">"{b.remarks}"</p>}
                      {/* Show outcome for past bookings */}
                      {isPast(b.date) && (
                        <div className="mt-2">
                          {(b as any).booking_result ? (
                            <div className="p-2 bg-green-900/30 border border-green-500/30 rounded-lg">
                              <p className="text-[9px] text-green-400 font-black uppercase tracking-widest">✓ Outcome Recorded</p>
                              <p className="text-[10px] text-green-300 mt-0.5">{(b as any).booking_result}</p>
                            </div>
                          ) : (
                            <div className="p-2 bg-yellow-900/20 border border-yellow-500/20 rounded-lg">
                              <p className="text-[9px] text-yellow-400 font-black uppercase tracking-widest">⚠ Outcome Pending — Click to Record</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`${cardClass} p-4`}>
                <div className="text-3xl font-black text-gold">{upcomingBookings.length}</div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1">Upcoming Bookings</p>
              </div>
              <div className={`${cardClass} p-4`}>
                <div className="text-3xl font-black text-blue-400">{pastBookings.length}</div>
                <p className="text-[10px] font-black text-blue-300/60 uppercase tracking-widest mt-1">Past Bookings</p>
              </div>
            </div>
          </div>

          {/* Right Panel — Calendar */}
          <div className="xl:col-span-2 space-y-6">
            <div className={`${cardClass} p-4 md:p-6`}>
              {/* Year selector */}
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black text-blue-400 uppercase tracking-wider">Year Calendar</h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCalendarYear((prev) => prev - 1)}
                    className="w-8 h-8 rounded-lg border border-[#1e3a5f] text-blue-300 hover:border-gold transition-all"
                  >
                    <i className="fas fa-chevron-left text-xs"></i>
                  </button>
                  <span className="text-xs font-black text-white">{calendarYear}</span>
                  <button
                    onClick={() => setCalendarYear((prev) => prev + 1)}
                    className="w-8 h-8 rounded-lg border border-[#1e3a5f] text-blue-300 hover:border-gold transition-all"
                  >
                    <i className="fas fa-chevron-right text-xs"></i>
                  </button>
                </div>
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {Array.from({ length: 12 }, (_, m) => {
                  const monthName = new Date(calendarYear, m, 1).toLocaleDateString('en-GB', { month: 'short' });
                  const isFocused = calendarMonth.getMonth() === m && calendarMonth.getFullYear() === calendarYear;
                  return (
                    <button
                      key={`${calendarYear}-${m}`}
                      onClick={() => setCalendarMonth(new Date(calendarYear, m, 1))}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        isFocused
                          ? 'bg-gold text-enterprise-blue border-gold'
                          : 'bg-[#0a1628] border-[#1e3a5f] text-blue-200 hover:border-blue-400'
                      }`}
                    >
                      <p className="text-[10px] font-black uppercase">{monthName}</p>
                      <p className="text-[10px] font-bold opacity-80">{bookingsByMonth[m]}</p>
                    </button>
                  );
                })}
              </div>

              {/* Month calendar nav */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="w-8 h-8 rounded-lg border border-[#1e3a5f] text-blue-300 hover:border-gold transition-all"
                >
                  <i className="fas fa-chevron-left text-xs"></i>
                </button>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">{monthLabel}</h4>
                <button
                  onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="w-8 h-8 rounded-lg border border-[#1e3a5f] text-blue-300 hover:border-gold transition-all"
                >
                  <i className="fas fa-chevron-right text-xs"></i>
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black text-blue-400 uppercase mb-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((cell, idx) =>
                  cell ? (
                    <button
                      key={cell.iso}
                      onClick={() => setSelectedDate(cell.iso)}
                      className={`h-8 rounded-lg text-xs font-black relative border transition-all ${
                        cell.iso === todayIso && selectedDate !== cell.iso
                          ? 'border-blue-500 text-blue-300 bg-blue-900/30'
                          : selectedDate === cell.iso
                          ? 'bg-gold text-enterprise-blue border-gold'
                          : bookingDates.has(cell.iso)
                          ? 'bg-gold/20 border-gold text-gold'
                          : 'bg-[#0a1628] border-[#1e3a5f] text-blue-200 hover:border-blue-400'
                      }`}
                    >
                      {cell.day}
                      {bookingDates.has(cell.iso) && (
                        <span className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full bg-gold text-enterprise-blue text-[7px] leading-4 font-black border border-[#0f1a2e]">
                          {bookingsPerDay[cell.iso]}
                        </span>
                      )}
                    </button>
                  ) : (
                    <div key={`empty-${idx}`} />
                  )
                )}
              </div>

              {/* Today indicator */}
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mt-3 text-center">
                Today: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#1e3a5f] flex justify-between items-center bg-[#0f1a2e]">
              <h3 className="text-lg font-black text-blue-400 uppercase tracking-tight">
                {selectedBooking ? 'Reschedule Booking' : 'New Booking Entry'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-blue-300 hover:text-white transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <input
                className="w-full p-4 rounded-xl border border-[#1e3a5f] bg-[#0f1a2e] font-bold text-white outline-none focus:border-blue-400 placeholder-blue-300/30"
                value={form.booker}
                onChange={(e) => setForm((prev) => ({ ...prev, booker: e.target.value }))}
                placeholder="Booker Name"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="sr-only" htmlFor="booking-date">Booking Date</label>
                <input
                  id="booking-date"
                  type="date"
                  title="Booking Date"
                  aria-label="Booking Date"
                  className="w-full p-4 rounded-xl border border-[#1e3a5f] bg-[#0f1a2e] font-bold text-white outline-none focus:border-blue-400"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
                <label className="sr-only" htmlFor="booking-time">Booking Time</label>
                <input
                  id="booking-time"
                  type="time"
                  title="Booking Time"
                  aria-label="Booking Time"
                  className="w-full p-4 rounded-xl border border-[#1e3a5f] bg-[#0f1a2e] font-bold text-white outline-none focus:border-blue-400"
                  value={form.time}
                  onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))}
                />
                <label className="sr-only" htmlFor="booking-purpose">Booking Purpose</label>
                <select
                  id="booking-purpose"
                  title="Booking Purpose"
                  aria-label="Booking Purpose"
                  className="w-full p-4 rounded-xl border border-[#1e3a5f] bg-[#0f1a2e] font-bold text-white outline-none focus:border-blue-400"
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
                className="w-full h-24 p-4 rounded-xl border border-[#1e3a5f] bg-[#0f1a2e] font-bold text-white outline-none focus:border-blue-400 placeholder-blue-300/30"
                value={form.remarks}
                onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                placeholder="Remarks / Notes"
              />
              {/* Booking Result — only shown for past bookings */}
              {selectedBooking && isPast(selectedBooking.date) && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    📋 Booking Result / Outcome
                  </label>
                  <textarea
                    className="w-full h-24 p-4 rounded-xl border border-green-500/40 bg-green-900/10 font-bold text-white outline-none focus:border-green-400 placeholder-green-300/30"
                    value={form.booking_result}
                    onChange={(e) => setForm((prev) => ({ ...prev, booking_result: e.target.value }))}
                    placeholder="What was the outcome of this booking? (e.g. Candidate passed, Interview rescheduled, No-show...)"
                  />
                </div>
              )}
              <button
                onClick={submit}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase tracking-widest shadow-xl transition-all"
              >
                {selectedBooking ? 'Update Booking' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingModule;