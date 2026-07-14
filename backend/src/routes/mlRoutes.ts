import { Router, Request, Response } from 'express';

const router = Router();
const ML_ENGINE_URL = process.env.ML_ENGINE_HOST ? `http://${process.env.ML_ENGINE_HOST}:10000` : 'http://localhost:8000';

// Helper to forward requests to the Python ML engine
async function callMLEngine(endpoint: string, body: object): Promise<any> {
  const response = await fetch(`${ML_ENGINE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ML Engine error: ${err}`);
  }
  return response.json();
}

// POST /api/ml/density
router.post('/density', async (req: Request, res: Response) => {
  try {
    const result = await callMLEngine('/density/analyze', req.body);
    res.json(result);
  } catch (error: any) {
    res.status(503).json({ error: 'ML Engine unavailable', detail: error.message });
  }
});

// POST /api/ml/risk
router.post('/risk', async (req: Request, res: Response) => {
  try {
    const result = await callMLEngine('/risk/predict', req.body);
    res.json(result);
  } catch (error: any) {
    res.status(503).json({ error: 'ML Engine unavailable', detail: error.message });
  }
});

// POST /api/ml/detect — this is a multipart form upload, so we forward raw
// For simplicity we tell users to POST directly to :8000 for image upload
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(`${ML_ENGINE_URL}/health`);
    const data = await response.json();
    res.json({ ml_engine: 'online', ...data });
  } catch {
    res.status(503).json({ ml_engine: 'offline', error: 'Cannot reach ML engine at :8000' });
  }
});

export default router;
