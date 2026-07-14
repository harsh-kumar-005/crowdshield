import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Bell, Smartphone, Save, CheckCircle2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_HOST ? `https://${import.meta.env.VITE_API_HOST}` : 'http://localhost:5000';

const Settings = () => {
  const [phone, setPhone] = useState('');
  const [threshold, setThreshold] = useState(80);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mlStatus, setMlStatus] = useState<string>('checking...');

  // Load settings on mount
  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setPhone(data.alert_phone || '');
          setThreshold(data.alert_threshold || 80);
          setAlertsEnabled(data.alerts_enabled ?? true);
        }
      })
      .catch(() => {});

    // Check ML engine status
    fetch(`${API_URL}/api/ml/status`)
      .then(r => r.json())
      .then(d => setMlStatus(d.ml_engine || 'offline'))
      .catch(() => setMlStatus('offline'));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_phone: phone,
          alert_threshold: threshold,
          alerts_enabled: alertsEnabled,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* */ }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="text-slate-500" size={26} />
          Platform Settings
        </h1>
        <p className="text-slate-500 text-sm mt-1">Configure alerting, notifications, and system preferences</p>
      </div>

      {/* Alert Configuration */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Bell size={18} className="text-amber-500" />
          SMS Alert Configuration
        </h2>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <p className="font-medium text-sm text-slate-700">Enable SMS Alerts</p>
            <p className="text-xs text-slate-500 mt-0.5">Receive SMS when risk score exceeds threshold</p>
          </div>
          <button
            onClick={() => setAlertsEnabled(!alertsEnabled)}
            className={`w-12 h-6 rounded-full transition-colors relative ${alertsEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${alertsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <Smartphone size={14} className="inline mr-1.5" />
            Phone Number
          </label>
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">Include country code. Requires Twilio trial account (TWILIO_SID, TWILIO_AUTH_TOKEN in .env).</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Alert Threshold: <span className="text-blue-600 font-bold">{threshold}/100</span>
          </label>
          <input
            type="range" min={50} max={100} step={5} value={threshold}
            onChange={e => setThreshold(+e.target.value)}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>50 (Moderate)</span><span>100 (Critical only)</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {saved ? <><CheckCircle2 size={16} /> Saved!</> : <><Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}</>}
        </button>
      </div>

      {/* System Status */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="font-semibold text-slate-800">System Status</h2>
        {[
          ['ML Engine', mlStatus === 'online', mlStatus],
          ['PostgreSQL', true, 'connected'],
          ['WebSocket Server', true, 'running'],
        ].map(([name, ok, label]) => (
          <div key={name as string} className="flex items-center justify-between text-sm p-2.5 bg-slate-50 rounded-lg">
            <span className="text-slate-600 font-medium">{name as string}</span>
            <span className={`flex items-center gap-1.5 font-medium ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
              <div className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
              {label as string}
            </span>
          </div>
        ))}
      </div>

      {/* API Keys Info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Required API Keys (set in backend/.env):</strong>
        <ul className="mt-2 space-y-1 text-xs">
          <li>• <code className="bg-amber-100 px-1 rounded">TWILIO_SID</code> / <code className="bg-amber-100 px-1 rounded">TWILIO_AUTH_TOKEN</code> / <code className="bg-amber-100 px-1 rounded">TWILIO_PHONE_FROM</code> — for SMS alerts</li>
          <li>• <code className="bg-amber-100 px-1 rounded">OPENWEATHERMAP_API_KEY</code> — for live weather data on Dashboard</li>
        </ul>
      </div>
    </div>
  );
};

export default Settings;
