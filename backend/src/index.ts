import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import { query } from './config/db';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/api/health', async (req, res) => {
  try {
     const dbResult = await query('SELECT 1 as db_is_up');
     res.json({ status: 'ok', db: 'connected', result: dbResult.rows[0] });
  } catch(e: any) {
     res.json({ status: 'ok', db: 'error', error: e.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
