import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Users, Plus } from 'lucide-react';

export const Events = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, you'd fetch from your API. We'll simulate fetching for now
    const fetchEvents = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/events');
        if (response.ok) {
           const data = await response.json();
           setEvents(data);
        } else {
           // Fallback mock data if DB isn't running
           setEvents([
             { id: 1, name: 'T20 Cricket Final', venue_name: 'M Chinnaswamy Stadium', start_time: new Date().toISOString(), status: 'upcoming' },
             { id: 2, name: 'Music Festival 2026', venue_name: 'Main Arena', start_time: new Date(Date.now() + 86400000).toISOString(), status: 'upcoming' },
           ]);
        }
      } catch (e) {
        setEvents([
          { id: 1, name: 'T20 Cricket Final', venue_name: 'M Chinnaswamy Stadium', start_time: new Date().toISOString(), status: 'upcoming' },
          { id: 2, name: 'Music Festival 2026', venue_name: 'Main Arena', start_time: new Date(Date.now() + 86400000).toISOString(), status: 'upcoming' },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-slate-900">Event Management</h1>
           <p className="text-slate-500 mt-1">Manage upcoming venue events and predicted crowd sizes.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
          <Plus size={20} />
          Create Event
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading events...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-4 px-6 font-semibold text-slate-600">Event Name</th>
                <th className="py-4 px-6 font-semibold text-slate-600">Location</th>
                <th className="py-4 px-6 font-semibold text-slate-600">Date & Time</th>
                <th className="py-4 px-6 font-semibold text-slate-600">Status</th>
                <th className="py-4 px-6 font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 font-medium text-slate-900 border-b border-slate-100">{event.name}</td>
                  <td className="py-4 px-6 border-b border-slate-100 flex items-center gap-2 text-slate-600">
                     <MapPin size={16} className="text-slate-400" />
                     {event.venue_name}
                  </td>
                  <td className="py-4 px-6 border-b border-slate-100 flex items-center gap-2 text-slate-600">
                     <Calendar size={16} className="text-slate-400" />
                     {new Date(event.start_time).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6 border-b border-slate-100">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                      {event.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 border-b border-slate-100 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Events;
