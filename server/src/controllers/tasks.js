const { db } = require('../db');
const AppError = require('../errors/app-error');

function listTasks(req, res) {
  const { search, category, page, limit } = req.query;
  const filters = [];
  const values = [];

  if (category) {
    filters.push('category = ?');
    values.push(category);
  }
  if (search) {
    filters.push('(LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))');
    const pattern = `%${search}%`;
    values.push(pattern, pattern);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM tasks ${where}`).get(...values).count;
  const offset = (page - 1) * limit;
  const tasks = db.prepare(`SELECT id, name, category, description FROM tasks ${where} ORDER BY category, name LIMIT ? OFFSET ?`).all(...values, limit, offset);

  res.json({
    data: tasks,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
}

function listSelectedTasks(req, res) {
  const tasks = db.prepare(`SELECT t.id, t.name, t.category, t.description
    FROM user_tasks ut JOIN tasks t ON t.id = ut.task_id
    WHERE ut.user_id = ? ORDER BY t.category, t.name`).all(req.userId);
  res.json({ data: tasks });
}

function saveSelectedTasks(req, res) {
  const { taskIds } = req.body;
  const placeholders = taskIds.map(() => '?').join(',');
  const existing = db.prepare(`SELECT id FROM tasks WHERE id IN (${placeholders})`).all(...taskIds).map((row) => row.id);
  if (existing.length !== taskIds.length) throw new AppError(400, 'INVALID_TASK', 'One or more selected tasks do not exist');

  const save = db.transaction(() => {
    db.prepare('DELETE FROM user_tasks WHERE user_id = ?').run(req.userId);
    const insert = db.prepare('INSERT INTO user_tasks (user_id, task_id) VALUES (?, ?)');
    for (const taskId of taskIds) insert.run(req.userId, taskId);
  });
  save();

  return listSelectedTasks(req, res);
}

module.exports = { listTasks, listSelectedTasks, saveSelectedTasks };
