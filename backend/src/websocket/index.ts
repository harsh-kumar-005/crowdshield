import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { query } from '../config/db';

const ML_ENGINE_URL = process.env.ML_ENGINE_HOST ? `http://${process.env.ML_ENGINE_HOST}:10000` : 'http://localhost:8000';
const VENUE_CAPACITY = 40000;

// ─── Shared state: camera-sourced crowd count ────────────────────────────────
let cameraPersonCount: number | null = null;   // null = no camera active
let lastCameraTimestamp = 0;
const CAMERA_STALE_MS = 10_000; // after 10s of no frames, camera is "offline"

// ─── Helper: call Python ML risk predictor ───────────────────────────────────
async function getRiskScore(
  totalCrowd: number,
  gates: Array<{ id: string; count: number }>,
  hourOfDay: number,
  weather: { is_raining: boolean; wind_speed: number } | null = null
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
        is_exit_event: hourOfDay >= 21,
        is_raining: weather?.is_raining ?? false,
        wind_speed: weather?.wind_speed ?? 0,
      }),
    });
    if (!response.ok) throw new Error('ML engine error');
    return await response.json();
  } catch {
    const pct = (totalCrowd / VENUE_CAPACITY) * 100;
    if (pct < 40) return { risk_score: 15, risk_level: 'low', risk_color: '#22c55e', top_factors: ['Venue Density'], suggested_actions: ['Normal monitoring'] };
    if (pct < 65) return { risk_score: 40, risk_level: 'medium', risk_color: '#f59e0b', top_factors: ['Venue Density'], suggested_actions: ['Increase monitoring'] };
    if (pct < 85) return { risk_score: 65, risk_level: 'high', risk_color: '#f97316', top_factors: ['Venue Density'], suggested_actions: ['Activate protocols'] };
    return { risk_score: 85, risk_level: 'critical', risk_color: '#ef4444', top_factors: ['Venue Density'], suggested_actions: ['Emergency protocols'] };
  }
}

// ─── Helper: analyze camera frame via YOLO ───────────────────────────────────
async function analyzeCameraFrame(imageBase64: string, frameId: number): Promise<{ person_count: number; boxes: any[] } | null> {
  try {
    const response = await fetch(`${ML_ENGINE_URL}/feed/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64, frame_id: frameId }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ─── Helper: persist reading to DB ───────────────────────────────────────────
async function saveCrowdReading(totalCrowd: number, gates: Array<{ id: string; count: number }>, riskScore: number, riskLevel: string, source: string) {
  try {
    await query(
      'INSERT INTO crowd_data (total_crowd, gate_counts, risk_score, risk_level) VALUES ($1, $2, $3, $4)',
      [totalCrowd, JSON.stringify({ gates, source }), riskScore, riskLevel]
    );
  } catch { /* non-critical */ }
}

// ─── SMS Alert cooldown (Feature 3) ────────────────────────────────────────
let lastAlertSentAt = 0;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

async function trySendAlert(riskScore: number, totalCrowd: number) {
  const now = Date.now();
  if (now - lastAlertSentAt < ALERT_COOLDOWN_MS) return;
  if (riskScore < 80) return;

  lastAlertSentAt = now;
  try {
    const port = process.env.PORT || 5000;
    await fetch(`http://localhost:${port}/api/alerts/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ risk_score: riskScore, total_crowd: totalCrowd, venue_capacity: VENUE_CAPACITY }),
    });
  } catch { /* alert service failure shouldn't crash websocket */ }
}

// ─── Weather cache ───────────────────────────────────────────────────────────
let cachedWeather: { is_raining: boolean; wind_speed: number; temp_c: number; condition: string; icon: string } | null = null;
let lastWeatherFetch = 0;
const WEATHER_CACHE_MS = 10 * 60 * 1000; // 10 min

async function getWeather(): Promise<typeof cachedWeather> {
  const now = Date.now();
  if (cachedWeather && now - lastWeatherFetch < WEATHER_CACHE_MS) return cachedWeather;

  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) return null;

    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Bangalore,IN&appid=${apiKey}&units=metric`);
    if (!res.ok) return cachedWeather;
    const data = await res.json();

    cachedWeather = {
      temp_c: Math.round(data.main.temp),
      is_raining: ['Rain', 'Drizzle', 'Thunderstorm'].includes(data.weather?.[0]?.main ?? ''),
      wind_speed: Math.round(data.wind?.speed ?? 0),
      condition: data.weather?.[0]?.main ?? 'Clear',
      icon: data.weather?.[0]?.icon ?? '01d',
    };
    lastWeatherFetch = now;
  } catch { /* weather fail is non-critical */ }
  return cachedWeather;
}

export const setupWebSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    maxHttpBufferSize: 5e6, // 5MB — needed for camera frame transfer
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // ── CAMERA FRAME HANDLER ─────────────────────────────────────
    socket.on('camera_frame', async (data: { image_base64: string; frame_id: number }) => {
      const result = await analyzeCameraFrame(data.image_base64, data.frame_id);
      if (result) {
        cameraPersonCount = result.person_count;
        lastCameraTimestamp = Date.now();
        // Send detection result back to THIS client for drawing boxes
        socket.emit('detection_result', {
          person_count: result.person_count,
          boxes: result.boxes,
          frame_id: data.frame_id,
          avg_confidence: (result as any).avg_confidence ?? 0,
        });
      }
    });

    // ── MAIN CROWD UPDATE LOOP ───────────────────────────────────
    const interval = setInterval(async () => {
      const hourOfDay = new Date().getHours();

      // Is camera active? (received a frame in last 10s)
      const cameraActive = cameraPersonCount !== null && (Date.now() - lastCameraTimestamp < CAMERA_STALE_MS);

      // Data source: real camera count OR simulated
      let totalCrowd: number;
      let source: string;

      if (cameraActive) {
        // Scale camera count to venue scale
        // If camera sees 5 people in a room, that might represent a gate with 500
        // In real deployment, you'd have multiple cameras at each gate
        // For demo: multiply camera count by a configurable factor
        totalCrowd = cameraPersonCount! * 1000;  // 5 people → 5,000
        source = 'camera';
      } else {
        totalCrowd = 10000 + Math.floor(Math.random() * 5000);
        source = 'simulated';
      }

      const gates = Array.from({ length: 4 }, (_, i) => ({
        id: `Gate ${i + 1}`,
        count: cameraActive
          ? Math.floor((cameraPersonCount! * 250) + Math.random() * 50) // Spread across gates
          : Math.floor(Math.random() * 500) + 100,
      }));

      // Get real weather (cached)
      const weather = await getWeather();

      // ML risk prediction
      const mlResult = await getRiskScore(totalCrowd, gates, hourOfDay, weather);

      // Persist to DB (~20% of readings)
      if (Math.random() > 0.8) {
        await saveCrowdReading(totalCrowd, gates, mlResult.risk_score, mlResult.risk_level, source);
      }

      // Try SMS alert if risk is critical
      await trySendAlert(mlResult.risk_score, totalCrowd);

      // Emit to all connected clients
      socket.emit('crowd_update', {
        totalCrowd,
        gates,
        venueCapacity: VENUE_CAPACITY,
        densityPct: Math.round((totalCrowd / VENUE_CAPACITY) * 100),
        dataSource: source,
        // ML results
        riskScore: mlResult.risk_score,
        riskLevel: mlResult.risk_level,
        riskColor: mlResult.risk_color,
        topFactors: mlResult.top_factors,
        suggestedActions: mlResult.suggested_actions,
        // Weather
        weather: weather ? {
          temp_c: weather.temp_c,
          condition: weather.condition,
          icon: weather.icon,
          is_raining: weather.is_raining,
          wind_speed: weather.wind_speed,
        } : null,
        timestamp: new Date().toISOString(),
      });

      // Critical alerts
      if (mlResult.risk_score > 70) {
        socket.emit('critical_alert', {
          message: mlResult.suggested_actions[0] || 'High risk detected',
          level: mlResult.risk_level,
          riskScore: mlResult.risk_score,
          timestamp: new Date().toISOString(),
        });
      }
    }, 4000);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      clearInterval(interval);
    });
  });

  return io;
};
