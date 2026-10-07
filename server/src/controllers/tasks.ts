import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { query, transaction } from '../config/db.ts';
import type { DataResponse, Pagination, TaskListData } from '../types/api.ts';
import type { TaskIdRow, TaskRow, TaskWithTotalRow } from '../types/database.ts';
import AppError from '../utils/app-error.ts';
import { taskListQuerySchema, selectionSchema } from '../validation/tasks.ts';

type SelectionInput = z.infer<typeof selectionSchema>;
type RouteParams = Record<string, string>;
type TaskListHandler = RequestHandler<RouteParams, TaskListData>;
type SelectedTasksHandler = RequestHandler<RouteParams, DataResponse<TaskRow[]>>;
type SelectionHandler = RequestHandler<RouteParams, DataResponse<TaskRow[]>, SelectionInput>;

async function getSelectedTasks(userId: number) {
  const { rows } = await query<TaskRow>(`SELECT t.id, t.name, t.category, t.description
    FROM user_tasks ut JOIN tasks t ON t.id = ut.task_id
    WHERE ut.user_id = $1 ORDER BY t.category, t.name`, [userId]);
  return rows;
}

const listTasks: TaskListHandler = async (req, res) => {
  const { search, category, page, limit } = taskListQuerySchema.parse(req.query);
  const filters: string[] = [];
  const values: Array<string | number> = [];

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
  const offset = (page - 1) * limit;
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;
  const { rows } = await query<TaskWithTotalRow>(`SELECT id, name, category, description, COUNT(*) OVER()::int AS total_count
    FROM tasks ${where} ORDER BY category, name LIMIT $${limitIndex} OFFSET $${offsetIndex}`, [...values, limit, offset]);

  const total = rows[0]?.total_count ?? 0;
  const tasks = rows.map(({ total_count: _totalCount, ...task }) => task);
  const pagination: Pagination = { page, limit, total, pages: Math.ceil(total / limit) };

  res.json({ data: tasks, pagination });
};

const listSelectedTasks: SelectedTasksHandler = async (req, res) => {
  res.json({ data: await getSelectedTasks(req.userId!) });
};

const saveSelectedTasks: SelectionHandler = async (req, res) => {
  const userId = req.userId!;
  const { taskIds } = req.body;
  const placeholders = taskIds.map((_, index) => `$${index + 1}`).join(',');
  const { rows: existing } = await query<TaskIdRow>(
    `SELECT id FROM tasks WHERE id IN (${placeholders})`,
    taskIds
  );

  if (existing.length !== taskIds.length) {
    throw new AppError(400, 'INVALID_TASK', 'One or more selected tasks do not exist');
  }

  await transaction(async (query) => {
    await query('DELETE FROM user_tasks WHERE user_id = $1', [userId]);

    const values: number[] = [userId];
    const rowPlaceholders = taskIds.map((taskId) => {
      values.push(taskId);
      return `($1, $${values.length})`;
    });

    await query(
      `INSERT INTO user_tasks (user_id, task_id) VALUES ${rowPlaceholders.join(',')}`,
      values
    );
  });

  res.json({ data: await getSelectedTasks(userId) });
};

export { listTasks, listSelectedTasks, saveSelectedTasks };
