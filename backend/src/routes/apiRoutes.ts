import { Router } from 'express';
import { getVenues, createVenue } from '../controllers/venueController';
import { getEvents, createEvent } from '../controllers/eventController';
import { query } from '../config/db';

const router = Router();

router.get('/venues', getVenues);
router.post('/venues', createVenue);

router.get('/events', getEvents);
router.post('/events', createEvent);

// Returns last 60 crowd readings from DB — used by the historical trend chart
router.get('/crowd-history', async (req, res) => {
  try {
    const result = await query(
      `SELECT total_crowd, risk_score, risk_level, timestamp 
       FROM crowd_data 
       ORDER BY timestamp DESC 
       LIMIT 60`,
    );
    // Reverse so oldest is first (for chart ordering left→right)
    res.json(result.rows.reverse());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

