import { Request, Response } from 'express';
import { query } from '../config/db';

export const getEvents = async (req: Request, res: Response) => {
  try {
    // Join with venues to get venue name
    const result = await query(`
      SELECT e.*, v.name as venue_name 
      FROM events e 
      LEFT JOIN venues v ON e.venue_id = v.id 
      ORDER BY e.start_time ASC
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createEvent = async (req: Request, res: Response) => {
  const { venue_id, name, status, start_time, end_time } = req.body;
  try {
    const result = await query(
      'INSERT INTO events (venue_id, name, status, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [venue_id, name, status, start_time, end_time]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
