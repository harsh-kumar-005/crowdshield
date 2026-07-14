import { useState, useRef, useEffect, useCallback } from 'react';
import { FlaskConical, Play, Pause, RotateCcw, Zap, Users, AlertTriangle, ShieldCheck } from 'lucide-react';

const ML_URL = import.meta.env.VITE_ML_HOST ? `https://${import.meta.env.VITE_ML_HOST}` : 'http://localhost:8000';

// Venue to canvas scale: venue is 60x40m, canvas is ~720x480px
const SCALE = 12;
const CANVAS_W = 60 * SCALE;
const CANVAS_H = 40 * SCALE;

// Agent colours per status
const STATUS_COLORS: Record<string, string> = {
  moving:   '#22c55e',   // green
  bunching: '#f97316',   // orange
  panic:    '#ef4444',   // red
};

const SCENARIOS_META = [
  { key: 'normal',       emoji: '🟢', label: 'Normal Event Exit' },
  { key: 'gate_failure', emoji: '🟡', label: 'Gate Failure' },
  { key: 'fire_alert',   emoji: '🔴', label: 'Fire / Emergency Alert' },
  { key: 'rain_delay',   emoji: '🔵', label: 'Rain Delay' },
  { key: 'chinnaswamy',  emoji: '🚨', label: 'Chinnaswamy Incident' },
];

interface Gate { name: string; x: number; y: number; open: boolean; }
interface Agent { x: number; y: number; status: string; }
interface RiskPoint { frame: number; risk: number; t: number; }
interface SimData {
  frames: Agent[][];
  total_frames: number;
  gates: Gate[];
  venue: { width: number; height: number };
  risk_timeline: RiskPoint[];
  summary: { agents_evacuated: number; max_risk_score: number; peak_risk_level: string; duration_seconds: number };
  scenario_label: string;
  num_agents: number;
  fps: number;
}

export default function Simulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);
  const simDataRef = useRef<SimData | null>(null);

  const [selectedScenario, setSelectedScenario] = useState('normal');
  const [numAgents, setNumAgents] = useState(400);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [simData, setSimData] = useState<SimData | null>(null);
  const [error, setError] = useState('');
  const [speed, setSpeed] = useState(1); // playback fps multiplier

  // ── Draw one frame on canvas ─────────────────────────────────────
  const drawFrame = useCallback((data: SimData, fi: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { gates, frames } = data;
    const frame = frames[fi] || [];

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Venue boundary
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, CANVAS_W - 4, CANVAS_H - 4);

    // Grid lines (subtle)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= CANVAS_W; x += SCALE * 5) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += SCALE * 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }

    // Gates
    gates.forEach(gate => {
      const gx = gate.x * SCALE;
      const gy = gate.y * SCALE;
      ctx.beginPath();
      ctx.arc(gx, gy, 10, 0, Math.PI * 2);
      ctx.fillStyle = gate.open ? '#3b82f6' : '#6b7280';
      ctx.fill();
      ctx.strokeStyle = gate.open ? '#93c5fd' : '#9ca3af';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      const labelY = gy < 30 ? gy + 22 : gy - 15;
      ctx.fillText(gate.name, gx, labelY);
      if (!gate.open) {
        ctx.fillStyle = '#ef4444';
        ctx.fillText('CLOSED', gx, labelY + 12);
      }
    });

    // Agents
    frame.forEach(agent => {
      const ax = agent.x * SCALE;
      const ay = agent.y * SCALE;
      ctx.beginPath();
      ctx.arc(ax, ay, 4, 0, Math.PI * 2);
      ctx.fillStyle = STATUS_COLORS[agent.status] || '#94a3b8';
      ctx.fill();
    });

    // Frame counter overlay
    const risk = data.risk_timeline[fi]?.risk ?? 0;
    ctx.fillStyle = `rgba(15,23,42,0.7)`;
    ctx.fillRect(8, 8, 180, 52);
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Frame ${fi + 1} / ${data.total_frames ?? frames.length}`, 16, 26);
    ctx.fillText(`Agents on field: ${frame.length}`, 16, 42);
    ctx.fillText(`Risk: ${risk}/100`, 16, 58);
  }, []);

  // ── Fetch simulation from ml-engine ─────────────────────────────
  const runSimulation = async () => {
    setLoading(true);
    setError('');
    stopAnimation();
    setFrameIdx(0);
    frameRef.current = 0;

    try {
      const res = await fetch(`${ML_URL}/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: selectedScenario, num_agents: numAgents }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Simulation failed');
      const data: SimData = await res.json();
      setSimData(data);
      simDataRef.current = data;
      // Draw first frame immediately
      drawFrame(data, 0);
    } catch (e: any) {
      setError(e.message.includes('fetch')
        ? 'Cannot reach ML Engine. Make sure it is running on port 8000.'
        : e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Animation loop ───────────────────────────────────────────────
  const startAnimation = useCallback(() => {
    const data = simDataRef.current;
    if (!data) return;
    setRunning(true);

    const interval = Math.max(16, Math.round(1000 / (data.fps * speed)));
    let last = 0;

    const loop = (ts: number) => {
      if (ts - last >= interval) {
        const fi = frameRef.current;
        if (fi >= data.frames.length - 1) {
          setRunning(false);
          return;
        }
        drawFrame(data, fi);
        frameRef.current = fi + 1;
        setFrameIdx(fi + 1);
        last = ts;
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  }, [drawFrame, speed]);

  const stopAnimation = () => {
    cancelAnimationFrame(animRef.current);
    setRunning(false);
  };

  const reset = () => {
    stopAnimation();
    frameRef.current = 0;
    setFrameIdx(0);
    if (simDataRef.current) drawFrame(simDataRef.current, 0);
  };

  // Cleanup on unmount
  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  const currentRisk = simData?.risk_timeline[frameIdx]?.risk ?? 0;
  const riskColor = currentRisk < 30 ? '#22c55e' : currentRisk < 55 ? '#f59e0b' : currentRisk < 75 ? '#f97316' : '#ef4444';
  const frameAgents = simData?.frames[frameIdx] ?? [];
  const panicCount = frameAgents.filter(a => a.status === 'panic').length;
  const bunchCount = frameAgents.filter(a => a.status === 'bunching').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FlaskConical className="text-purple-500" size={26} />
          Crowd Simulation Engine
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Agent-based Social Force Model — each dot is a real simulated person with velocity and collision avoidance
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* ── Left: Controls ──────────────────────────────────────── */}
        <div className="xl:col-span-1 space-y-4">
          {/* Scenario selector */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Scenario</h2>
            {SCENARIOS_META.map(s => (
              <button
                key={s.key}
                onClick={() => setSelectedScenario(s.key)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                  selectedScenario === s.key
                    ? 'bg-purple-600 text-white font-medium shadow'
                    : 'hover:bg-slate-50 text-slate-700 border border-slate-200'
                }`}
              >
                <span className="mr-2">{s.emoji}</span>{s.label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Parameters</h2>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium">Agents: <span className="text-slate-900 font-bold">{numAgents}</span></label>
              <input type="range" min={100} max={800} step={50} value={numAgents}
                onChange={e => setNumAgents(+e.target.value)}
                className="w-full accent-purple-600" />
              <div className="flex justify-between text-xs text-slate-400 mt-1"><span>100</span><span>800</span></div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5 font-medium">Playback Speed: <span className="text-slate-900 font-bold">{speed}x</span></label>
              <input type="range" min={0.5} max={4} step={0.5} value={speed}
                onChange={e => setSpeed(+e.target.value)}
                className="w-full accent-purple-600" />
              <div className="flex justify-between text-xs text-slate-400 mt-1"><span>0.5x</span><span>4x</span></div>
            </div>
          </div>

          {/* Run controls */}
          <div className="space-y-2">
            <button
              onClick={runSimulation}
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Zap size={16} />
              {loading ? 'Computing…' : 'Run Simulation'}
            </button>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={running ? stopAnimation : startAnimation} disabled={!simData}
                className="py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg text-xs flex items-center justify-center gap-1 transition-colors">
                {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
              </button>
              <button onClick={reset} disabled={!simData}
                className="py-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-800 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors col-span-2">
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="font-semibold text-slate-800 text-xs uppercase tracking-wide mb-3">Legend</h2>
            <div className="space-y-2 text-sm">
              {[['#22c55e','Moving safely'],['#f97316','Bunching / Slowing'],['#ef4444','Panic / Trapped'],['#3b82f6','Open Gate'],['#6b7280','Closed Gate']].map(([col, label]) => (
                <div key={label} className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: col }} />
                  <span className="text-slate-600 text-xs">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Canvas + Stats ───────────────────────────────── */}
        <div className="xl:col-span-3 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
          )}

          {/* Scenario info banner */}
          {selectedScenario === 'chinnaswamy' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-bold text-red-800 text-sm">Chinnaswamy Stadium Recreation — June 4, 2025</p>
                <p className="text-red-700 text-xs mt-1">This simulation recreates the conditions of the tragedy. 42,000 crowd post-match, Gate N2 and S1 closed, all traffic funnelling through the Tunnel bottleneck. Watch panic emerge at t=10s.</p>
              </div>
            </div>
          )}

          {/* Canvas */}
          <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-700 relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full"
              style={{ imageRendering: 'pixelated' }}
            />
            {!simData && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <FlaskConical size={48} className="mb-3 opacity-30" />
                <p className="font-semibold">Select a scenario and click Run Simulation</p>
                <p className="text-sm mt-1 text-slate-500">The simulation computes server-side via Python</p>
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-slate-200">
                <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-semibold">Running Social Force Model…</p>
                <p className="text-sm text-slate-400 mt-1">Computing {numAgents} agents</p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {simData && (
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Frame {frameIdx + 1} of {simData.frames.length}</span>
                <span>t = {(frameIdx / simData.fps).toFixed(1)}s / {simData.summary.duration_seconds}s</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${(frameIdx / Math.max(simData.frames.length - 1, 1)) * 100}%`,
                    background: riskColor
                  }}
                />
              </div>
            </div>
          )}

          {/* Live stats row */}
          {simData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatMini icon={<Users size={16} className="text-blue-500"/>}
                label="On Field" value={frameAgents.length.toString()} />
              <StatMini icon={<AlertTriangle size={16} className="text-orange-500"/>}
                label="Bunching" value={bunchCount.toString()} color="text-orange-600"/>
              <StatMini icon={<AlertTriangle size={16} className="text-red-500"/>}
                label="Panic" value={panicCount.toString()} color="text-red-600"/>
              <StatMini
                icon={<ShieldCheck size={16} style={{ color: riskColor }}/>}
                label="Risk Score"
                value={`${currentRisk}/100`}
                color={currentRisk > 55 ? 'text-red-600' : currentRisk > 30 ? 'text-orange-500' : 'text-emerald-600'}
              />
            </div>
          )}

          {/* Summary (shown after simulation completes) */}
          {simData && !running && frameIdx >= simData.frames.length - 2 && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-3">Simulation Complete — {simData.scenario_label}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                {[
                  ['Agents Simulated', simData.num_agents],
                  ['Agents Evacuated', simData.summary.agents_evacuated],
                  ['Peak Risk Score', `${simData.summary.max_risk_score}/100`],
                  ['Risk Level', simData.summary.peak_risk_level.toUpperCase()],
                ].map(([label, value]) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xl font-bold text-slate-900">{value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const StatMini = ({ icon, label, value, color = 'text-slate-900' }: any) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
    {icon}
    <div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  </div>
);
