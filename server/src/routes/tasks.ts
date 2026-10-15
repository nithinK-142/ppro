import express from 'express';
import authenticate from '../middleware/auth.ts';
import validate from '../middleware/validate.ts';
import { listTasks, listSelectedTasks, saveSelectedTasks } from '../controllers/tasks.ts';
import { selectionSchema } from '../validation/tasks.ts';
import captureRoute from '../middleware/route-context.ts';

const router = express.Router();
router.get('/', captureRoute, listTasks);
router.get('/selected', captureRoute, authenticate, listSelectedTasks);
router.put('/selected', captureRoute, authenticate, validate(selectionSchema), saveSelectedTasks);

export default router;
