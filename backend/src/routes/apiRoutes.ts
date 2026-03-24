import { Router } from 'express';
import { getVenues, createVenue } from '../controllers/venueController';
import { getEvents, createEvent } from '../controllers/eventController';
import { query } from '../config/db';
import { alertService } from '../services/alertService';

const router = Router();

router.get('/venues', getVenues);
router.post('/venues', createVenue);

router.get('/events', getEvents);
router.post('/events', createEvent);

// Returns last 60 crowd readings from DB
router.get('/crowd-history', async (req, res) => {
  try {
    const result = await query(
      `SELECT total_crowd, risk_score, risk_level, timestamp 
       FROM crowd_data 
       ORDER BY timestamp DESC 
       LIMIT 60`,
    );
    res.json(result.rows.reverse());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Settings Endpoints ─────────────────────────────────────────────
// Create settings table if not exists (auto-migration)
query(`CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  alert_phone VARCHAR(20) DEFAULT '',
  alert_threshold INTEGER DEFAULT 80,
  alerts_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
)`).catch(() => {});

router.get('/settings', async (_req, res) => {
  try {
    const result = await query('SELECT * FROM app_settings WHERE id = 1');
    if (result.rows.length === 0) {
      await query('INSERT INTO app_settings (id) VALUES (1)');
      res.json({ alert_phone: '', alert_threshold: 80, alerts_enabled: true });
    } else {
      res.json(result.rows[0]);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const { alert_phone, alert_threshold, alerts_enabled } = req.body;
    await query(
      `INSERT INTO app_settings (id, alert_phone, alert_threshold, alerts_enabled, updated_at)
       VALUES (1, $1, $2, $3, NOW())
       ON CONFLICT (id) DO UPDATE SET
         alert_phone = $1, alert_threshold = $2, alerts_enabled = $3, updated_at = NOW()`,
      [alert_phone || '', alert_threshold || 80, alerts_enabled ?? true]
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── SMS Alert Trigger (called by WebSocket loop) ────────────────────
router.post('/alerts/send', async (req, res) => {
  try {
    // Load settings to get phone number
    const settings = await query('SELECT * FROM app_settings WHERE id = 1');
    const cfg = settings.rows[0];

    if (!cfg || !cfg.alerts_enabled) {
      return res.json({ sent: false, reason: 'Alerts disabled' });
    }

    const phone = cfg.alert_phone || process.env.ALERT_PHONE_TO || '';
    const sent = await alertService.sendAlert(phone, req.body);
    res.json({ sent, phone: phone ? `***${phone.slice(-4)}` : 'none' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
