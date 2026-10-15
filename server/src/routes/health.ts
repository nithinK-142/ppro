import express from 'express';
import { pingDatabase } from '../config/db.ts';
import captureRoute from '../middleware/route-context.ts';

const router = express.Router();

router.get('/live', captureRoute, (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/ready', captureRoute, async (_req, res) => {
  const ready = await pingDatabase();
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'not_ready' });
});

export default router;
