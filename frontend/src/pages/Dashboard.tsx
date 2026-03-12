import { useEffect, useState } from 'react';
import { Users, AlertTriangle, ShieldCheck, DoorOpen, BrainCircuit } from 'lucide-react';
import { useSocketData } from '../context/SocketContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend
} from 'recharts';

const Dashboard = () => {
  const { isConnected, crowdData, alerts, historicalData } = useSocketData();
  const [dbHistory, setDbHistory] = useState<any[]>([]);

  // Load historical data from DB on mount
  useEffect(() => {
    fetch('http://localhost:5000/api/crowd-history')
      .then(r => r.ok ? r.json() : [])
      .then(data => setDbHistory(data.map((d: any) => ({
        time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        crowd: d.total_crowd,
        risk: d.risk_score,
      }))))
      .catch(() => {});
  }, []);

  const riskScore = crowdData?.riskScore ?? 0;
  const riskLevel = crowdData?.riskLevel ?? 'loading';
  const riskColor = crowdData?.riskColor ?? '#64748b';
  const densityPct = crowdData?.densityPct ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Live Command Center</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time crowd monitoring — ML risk updated every 4 seconds</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium text-slate-600">{isConnected ? 'System Live' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Top Row: Stat Cards + Risk Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Stat cards — 4 cols */}
        <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Crowd"
            value={crowdData ? crowdData.totalCrowd.toLocaleString() : '—'}
            sub={crowdData ? `${densityPct}% capacity` : ''}
            icon={<Users className="text-blue-500" size={22} />}
          />
          <StatCard
            title="Active Alerts"
            value={alerts.length.toString()}
            sub={alerts.length > 0 ? 'Requires action' : 'All clear'}
            icon={<AlertTriangle className={alerts.length > 0 ? 'text-red-500' : 'text-slate-400'} size={22} />}
            valueColor={alerts.length > 0 ? 'text-red-600' : ''}
          />
          <StatCard
            title="Security Status"
            value={riskLevel === 'loading' ? '—' : riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
            sub="ML-calculated"
            icon={<ShieldCheck style={{ color: riskColor }} size={22} />}
          />
          <StatCard
            title="Open Gates"
            value={crowdData ? `${crowdData.gates.length}` : '—'}
            sub="Active entry points"
            icon={<DoorOpen className="text-indigo-500" size={22} />}
          />
        </div>

        {/* ML Risk Gauge — 1 col */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-2">
          <BrainCircuit size={22} className="text-purple-500" />
          <p className="text-xs font-semibold text-slate-500 text-center uppercase tracking-wide">ML Risk Score</p>

          {/* Circular progress via SVG */}
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" stroke="#e2e8f0" strokeWidth="10" fill="none" />
              <circle
                cx="50" cy="50" r="40"
                stroke={riskColor}
                strokeWidth="10"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40}`}
                strokeDashoffset={`${2 * Math.PI * 40 * (1 - riskScore / 100)}`}
                style={{ transition: 'stroke-dashoffset 1s ease, stroke 1s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-900">{riskScore}</span>
              <span className="text-xs text-slate-400">/100</span>
            </div>
          </div>

          <span
            className="text-xs font-bold uppercase px-2 py-0.5 rounded-full"
            style={{ backgroundColor: riskColor + '20', color: riskColor }}
          >
            {riskLevel}
          </span>
        </div>
      </div>

      {/* ML Actions + Live Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Density Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Venue Crowd — Live Feed</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts + Actions */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Live Alert Feed</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <ShieldCheck size={40} className="mb-2 opacity-40" />
                <p className="text-sm">No active alerts</p>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={i} className="p-3 rounded-lg bg-red-50 border border-red-100">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
                    <div>
                      <p className="text-xs font-medium text-red-900">{alert.message}</p>
                      <p className="text-xs text-red-600 mt-0.5">Risk: {alert.riskScore}/100 • {new Date(alert.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {crowdData?.suggestedActions?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">ML Recommendations</p>
              <ul className="space-y-1">
                {crowdData.suggestedActions.slice(0, 2).map((a: string, i: number) => (
                  <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                    <span style={{ color: riskColor }}>›</span> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Historical DB Chart + Gate Traffic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historical chart from real DB data */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-base font-semibold text-slate-800">Historical Session Data</h2>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">From PostgreSQL</span>
          </div>
          {dbHistory.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              <div className="text-center">
                <p>No historical data yet.</p>
                <p className="text-xs mt-1 text-slate-300">Data builds up as the system runs.</p>
              </div>
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dbHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="crowd" orientation="left" stroke="#3b82f6" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="risk" orientation="right" stroke="#a855f7" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="crowd" type="monotone" dataKey="crowd" stroke="#3b82f6" strokeWidth={2} dot={false} name="Crowd" />
                  <Line yAxisId="risk" type="monotone" dataKey="risk" stroke="#a855f7" strokeWidth={2} dot={false} name="Risk Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Gate Traffic */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Live Gate Traffic</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={crowdData?.gates || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="id" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// Reusable clean stat card
const StatCard = ({ title, value, sub, icon, valueColor }: any) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start mb-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      {icon}
    </div>
    <h3 className={`text-2xl font-bold text-slate-900 ${valueColor}`}>{value}</h3>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

export default Dashboard;
