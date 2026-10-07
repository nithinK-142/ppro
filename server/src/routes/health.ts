import express from 'express';
import { pingDatabase } from '../config/db.ts';

const router = express.Router();

router.get('/live', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/ready', async (_req, res) => {
  const ready = await pingDatabase();
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'not_ready' });
});

export default router;
