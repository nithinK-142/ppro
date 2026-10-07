import express from 'express';
import authenticate from '../middleware/auth.ts';
import validate from '../middleware/validate.ts';
import { listTasks, listSelectedTasks, saveSelectedTasks } from '../controllers/tasks.ts';
import { selectionSchema } from '../validation/tasks.ts';

const router = express.Router();
router.get('/', listTasks);
router.use(authenticate);
router.get('/selected', listSelectedTasks);
router.put('/selected', validate(selectionSchema), saveSelectedTasks);

export default router;
