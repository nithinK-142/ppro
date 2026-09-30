const express = require('express');
const authenticate = require('../middleware/auth');
const validate = require('../middleware/validate');
const { listTasks, listSelectedTasks, saveSelectedTasks } = require('../controllers/tasks');
const { taskListQuerySchema, selectionSchema } = require('../validation/tasks');

const router = express.Router();
router.get('/', validate({ query: taskListQuerySchema }), listTasks);
router.use(authenticate);
router.get('/selected', listSelectedTasks);
router.put('/selected', validate({ body: selectionSchema }), saveSelectedTasks);

module.exports = router;
