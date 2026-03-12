import { Router } from 'express';
import { getVenues, createVenue } from '../controllers/venueController';
import { getEvents, createEvent } from '../controllers/eventController';

const router = Router();

router.get('/venues', getVenues);
router.post('/venues', createVenue);

router.get('/events', getEvents);
router.post('/events', createEvent);

export default router;
