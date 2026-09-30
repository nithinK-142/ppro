const express = require('express');
const { pingDatabase } = require('../db');

const router = express.Router();

router.get('/live', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/ready', (_req, res) => {
  const ready = pingDatabase();
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'not_ready' });
});

module.exports = router;
