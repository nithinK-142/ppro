const { db, transaction } = require('../db');
const AppError = require('../errors/app-error');

async function listTasks(req, res) {
  const { search, category, page, limit } = req.query;
  const filters = [];
  const values = [];

  if (category) {
    filters.push(`category = $${values.length + 1}`);
    values.push(category);
  }
  if (search) {
    const searchIndex = values.length + 1;
    filters.push(`(LOWER(name) LIKE LOWER($${searchIndex}) OR LOWER(description) LIKE LOWER($${searchIndex + 1}))`);
    const pattern = `%${search}%`;
    values.push(pattern, pattern);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const totalResult = await db.get(`SELECT COUNT(*)::int AS count FROM tasks ${where}`, values);
  const offset = (page - 1) * limit;
  const tasksValues = [...values, limit, offset];
  const limitIndex = tasksValues.length - 1;
  const offsetIndex = tasksValues.length;
  const tasks = await db.all(`SELECT id, name, category, description FROM tasks ${where} ORDER BY category, name LIMIT $${limitIndex} OFFSET $${offsetIndex}`, tasksValues);
  const total = Number(totalResult.count);

  res.json({
    data: tasks,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}

async function listSelectedTasks(req, res) {
  const tasks = await db.all(`SELECT t.id, t.name, t.category, t.description
    FROM user_tasks ut JOIN tasks t ON t.id = ut.task_id
    WHERE ut.user_id = $1 ORDER BY t.category, t.name`, [req.userId]);
  res.json({ data: tasks });
}

async function saveSelectedTasks(req, res) {
  const { taskIds } = req.body;
  if (taskIds.length === 0) {
    await db.run('DELETE FROM user_tasks WHERE user_id = $1', [req.userId]);
    return listSelectedTasks(req, res);
  }

  const placeholders = taskIds.map((_, index) => `$${index + 1}`).join(',');
  const existing = await db.all(`SELECT id FROM tasks WHERE id IN (${placeholders})`, taskIds);
  const existingIds = existing.map((row) => row.id);
  if (existingIds.length !== taskIds.length) throw new AppError(400, 'INVALID_TASK', 'One or more selected tasks do not exist');

  await transaction(async (tx) => {
    await tx.run('DELETE FROM user_tasks WHERE user_id = $1', [req.userId]);
    for (const taskId of taskIds) {
      await tx.run('INSERT INTO user_tasks (user_id, task_id) VALUES ($1, $2)', [req.userId, taskId]);
    }
  });

  return listSelectedTasks(req, res);
}

module.exports = { listTasks, listSelectedTasks, saveSelectedTasks };
