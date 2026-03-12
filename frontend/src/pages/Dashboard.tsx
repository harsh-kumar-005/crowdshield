import { useEffect, useState } from 'react';
import { Users, AlertTriangle, ShieldCheck, DoorOpen } from 'lucide-react';
import { useSocketData } from '../context/SocketContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const Dashboard = () => {
  const { isConnected, crowdData, alerts, historicalData } = useSocketData();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Live Command Center</h1>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium text-slate-600">
            {isConnected ? 'System Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Venue Crowd"
          value={crowdData ? crowdData.totalCrowd.toLocaleString() : '---'}
          icon={<Users className="text-blue-500" />}
          trend={crowdData?.totalCrowd > 12000 ? "⚠ High Density" : "✓ Normal"}
          trendColor={crowdData?.totalCrowd > 12000 ? "text-amber-500" : "text-emerald-500"}
        />
        <StatCard
          title="Active Alerts"
          value={alerts.length.toString()}
          icon={<AlertTriangle className={alerts.length > 0 ? "text-red-500" : "text-slate-400"} />}
          trend={alerts.length > 0 ? "Requires Attention" : "All Clear"}
          trendColor={alerts.length > 0 ? "text-red-500" : "text-emerald-500"}
        />
        <StatCard
          title="Security Status"
          value={alerts.length > 0 ? "Elevated" : "Secure"}
          icon={<ShieldCheck className="text-emerald-500" />}
        />
        <StatCard
          title="Open Gates"
          value={crowdData ? crowdData.gates.length : '---'}
          icon={<DoorOpen className="text-indigo-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Venue Density Over Time</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts Feed */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Live Alert Feed</h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-8">
                <ShieldCheck size={48} className="mb-2 opacity-50" />
                <p>No active alerts.</p>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={i} className="p-4 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3">
                  <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-sm font-medium text-red-900">{alert.message}</p>
                    <p className="text-xs text-red-700 mt-1">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Gate Traffic */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Live Gate Traffic</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={crowdData?.gates || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="id" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Reusable stat card
const StatCard = ({ title, value, icon, trend, trendColor }: any) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
      </div>
      <div className="p-3 bg-slate-50 rounded-lg">{icon}</div>
    </div>
    {trend && (
      <div className={`mt-4 text-sm font-medium ${trendColor}`}>
        {trend}
      </div>
    )}
  </div>
);

export default Dashboard;
