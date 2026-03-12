import { Request, Response } from 'express';
import { query } from '../config/db';

export const getVenues = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM venues ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createVenue = async (req: Request, res: Response) => {
  const { name, location, capacity } = req.body;
  try {
    const result = await query(
      'INSERT INTO venues (name, location, capacity) VALUES ($1, $2, $3) RETURNING *',
      [name, location, capacity]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
