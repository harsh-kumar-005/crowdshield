import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { query } from '../config/db';

const ML_ENGINE_URL = 'http://localhost:8000';
const VENUE_CAPACITY = 40000; // M Chinnaswamy Stadium

// ─── Helper: call Python ML risk predictor ───────────────────────────────────
async function getRiskScore(
  totalCrowd: number,
  gates: Array<{ id: string; count: number }>,
  hourOfDay: number
): Promise<{ risk_score: number; risk_level: string; risk_color: string; top_factors: string[]; suggested_actions: string[] }> {
  try {
    const response = await fetch(`${ML_ENGINE_URL}/risk/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total_crowd: totalCrowd,
        venue_capacity: VENUE_CAPACITY,
        gates,
        hour_of_day: hourOfDay,
        is_exit_event: hourOfDay >= 21, // Assume exit rush after 9pm
      }),
    });
    if (!response.ok) throw new Error('ML engine returned error');
    return await response.json();
  } catch {
    // ML engine offline — fall back to simple rule-based classification
    const pct = (totalCrowd / VENUE_CAPACITY) * 100;
    if (pct < 40) return { risk_score: 15, risk_level: 'low', risk_color: '#22c55e', top_factors: ['Venue Density'], suggested_actions: ['Normal monitoring'] };
    if (pct < 65) return { risk_score: 40, risk_level: 'medium', risk_color: '#f59e0b', top_factors: ['Venue Density'], suggested_actions: ['Increase monitoring'] };
    if (pct < 85) return { risk_score: 65, risk_level: 'high', risk_color: '#f97316', top_factors: ['Venue Density'], suggested_actions: ['Activate protocols'] };
    return { risk_score: 85, risk_level: 'critical', risk_color: '#ef4444', top_factors: ['Venue Density'], suggested_actions: ['Emergency protocols'] };
  }
}

// ─── Helper: persist reading to DB ───────────────────────────────────────────
async function saveCrowdReading(
  totalCrowd: number,
  gates: Array<{ id: string; count: number }>,
  riskScore: number,
  riskLevel: string
) {
  try {
    await query(
      'INSERT INTO crowd_data (total_crowd, gate_counts, risk_score, risk_level) VALUES ($1, $2, $3, $4)',
      [totalCrowd, JSON.stringify(gates), riskScore, riskLevel]
    );
  } catch {
    // DB write failing shouldn't crash the WebSocket loop
  }
}

export const setupWebSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    const interval = setInterval(async () => {
      const hourOfDay = new Date().getHours();

      // Build realistic simulated gate counts
      // Crowd grows toward event time, peaks, then drains — a real pattern
      const baseCrowd = 10000 + Math.floor(Math.random() * 5000);
      const gates = Array.from({ length: 4 }, (_, i) => ({
        id: `Gate ${i + 1}`,
        count: Math.floor(Math.random() * 500) + 100,
      }));

      // ── REAL ML CALL ─────────────────────────────────────────────
      const mlResult = await getRiskScore(baseCrowd, gates, hourOfDay);
      // ─────────────────────────────────────────────────────────────

      // Persist to DB (every 5th reading to reduce DB load)
      if (Math.random() > 0.8) {
        await saveCrowdReading(baseCrowd, gates, mlResult.risk_score, mlResult.risk_level);
      }

      // Emit full payload including ML risk score
      socket.emit('crowd_update', {
        totalCrowd: baseCrowd,
        gates,
        venueCapacity: VENUE_CAPACITY,
        densityPct: Math.round((baseCrowd / VENUE_CAPACITY) * 100),
        // ── ML RESULTS ──
        riskScore: mlResult.risk_score,
        riskLevel: mlResult.risk_level,
        riskColor: mlResult.risk_color,
        topFactors: mlResult.top_factors,
        suggestedActions: mlResult.suggested_actions,
        timestamp: new Date().toISOString(),
      });

      // Critical alert threshold from ML
      if (mlResult.risk_score > 70) {
        socket.emit('critical_alert', {
          message: mlResult.suggested_actions[0] || 'High risk detected - activate protocols',
          level: mlResult.risk_level,
          riskScore: mlResult.risk_score,
          timestamp: new Date().toISOString(),
        });
      }
    }, 4000); // Every 4 seconds (slightly slower to wait for ML response)

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      clearInterval(interval);
    });
  });

  return io;
};
