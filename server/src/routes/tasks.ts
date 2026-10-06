import express from 'express';
import authenticate from '../middleware/auth.ts';
import validate from '../middleware/validate.ts';
import { listTasks, listSelectedTasks, saveSelectedTasks } from '../controllers/tasks.ts';
import { taskListQuerySchema, selectionSchema } from '../validation/tasks.ts';

const router = express.Router();
router.get('/', validate({ query: taskListQuerySchema }), listTasks);
router.use(authenticate);
router.get('/selected', listSelectedTasks);
router.put('/selected', validate({ body: selectionSchema }), saveSelectedTasks);

export default router;
