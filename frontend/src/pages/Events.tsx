import { useEffect, useState } from 'react';
import { Calendar, MapPin, Plus, X, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_HOST ? `https://${import.meta.env.VITE_API_HOST}${import.meta.env.VITE_API_HOST.includes('.onrender.com') ? '' : '.onrender.com'}` : 'http://localhost:5000';

interface Event {
  id: number;
  name: string;
  venue_name: string;
  start_time: string;
  status: string;
}

interface Venue {
  id: number;
  name: string;
}

const Events = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    venue_id: '',
    status: 'upcoming',
    start_time: '',
    end_time: '',
  });
  const [error, setError] = useState('');

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_URL}/api/events`);
      if (res.ok) setEvents(await res.json());
    } catch {
      // fallback to empty
    } finally {
      setLoading(false);
    }
  };

  const fetchVenues = async () => {
    try {
      const res = await fetch(`${API_URL}/api/venues`);
      if (res.ok) setVenues(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchEvents();
    fetchVenues();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setShowModal(false);
        setForm({ name: '', venue_id: '', status: 'upcoming', start_time: '', end_time: '' });
        fetchEvents(); // Refresh the list
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create event. Please try again.');
      }
    } catch {
      setError('Cannot connect to server. Make sure the backend is running.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Event Management</h1>
          <p className="text-slate-500 mt-1">Manage upcoming venue events and predicted crowd sizes.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Create Event
        </button>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin" size={32} />
            Loading events...
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Calendar size={48} className="mx-auto mb-3 opacity-50" />
            <p className="font-medium">No events yet.</p>
            <p className="text-sm mt-1">Click "Create Event" to add one.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-4 px-6 font-semibold text-slate-600 text-sm">Event Name</th>
                <th className="py-4 px-6 font-semibold text-slate-600 text-sm">Venue</th>
                <th className="py-4 px-6 font-semibold text-slate-600 text-sm">Date & Time</th>
                <th className="py-4 px-6 font-semibold text-slate-600 text-sm">Status</th>
                <th className="py-4 px-6 font-semibold text-slate-600 text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 font-medium text-slate-900">{event.name}</td>
                  <td className="py-4 px-6 text-slate-600">
                    <div className="flex items-center gap-2">
                      <MapPin size={15} className="text-slate-400" />
                      {event.venue_name || '—'}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={15} className="text-slate-400" />
                      {event.start_time ? new Date(event.start_time).toLocaleString() : '—'}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 capitalize">
                      {event.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Create New Event</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. T20 World Cup Final"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Venue</label>
                <select
                  value={form.venue_id}
                  onChange={e => setForm({ ...form, venue_id: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Select a venue (optional)</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="live">Live</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date & Time *</label>
                  <input
                    required
                    type="datetime-local"
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={form.end_time}
                    onChange={e => setForm({ ...form, end_time: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
