import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../config/db.ts';
import { tasks, userTasks } from '../config/schema.ts';
import { getSelectedTasks } from '../config/queries.ts';
import type { DataResponse, Pagination, TaskListData } from '../types/api.ts';
import type { TaskRow } from '../config/schema.ts';
import AppError from '../utils/app-error.ts';
import { taskListQuerySchema, selectionSchema } from '../validation/tasks.ts';

type SelectionInput = z.infer<typeof selectionSchema>;
type RouteParams = Record<string, string>;
type TaskListHandler = RequestHandler<RouteParams, TaskListData>;
type SelectedTasksHandler = RequestHandler<RouteParams, DataResponse<TaskRow[]>>;
type SelectionHandler = RequestHandler<RouteParams, DataResponse<TaskRow[]>, SelectionInput>;

const listTasks: TaskListHandler = async (req, res) => {
  const { search, category, page, limit } = taskListQuerySchema.parse(req.query);
  const conditions = [];

  if (category) conditions.push(eq(tasks.category, category));

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(ilike(tasks.name, pattern), ilike(tasks.description, pattern))!);
  }

  const where = conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined;
  const offset = (page - 1) * limit;
  const rows = await db.select({
    id: tasks.id,
    name: tasks.name,
    category: tasks.category,
    description: tasks.description,
    total_count: sql<number>`count(*) over()::int`.as('total_count')
  }).from(tasks)
    .where(where)
    .orderBy(asc(tasks.category), asc(tasks.name))
    .limit(limit)
    .offset(offset);

  let total = rows[0]?.total_count ?? 0;
  if (!rows.length) {
    const [count] = await db.select({ total: sql<number>`count(*)::int`.as('total') })
      .from(tasks)
      .where(where);
    total = count?.total ?? 0;
  }

  const tasksData = rows.map(({ total_count: _totalCount, ...task }) => task);
  const pagination: Pagination = { page, limit, total, pages: Math.ceil(total / limit) };

  res.json({ data: tasksData, pagination });
};

const listSelectedTasks: SelectedTasksHandler = async (req, res) => {
  res.json({ data: await getSelectedTasks(req.userId!) });
};

const saveSelectedTasks: SelectionHandler = async (req, res) => {
  const userId = req.userId!;
  const { taskIds } = req.body;
  const existing = await db.select({ id: tasks.id }).from(tasks).where(inArray(tasks.id, taskIds));

  if (existing.length !== taskIds.length) {
    throw new AppError(400, 'INVALID_TASK', 'One or more selected tasks do not exist');
  }

  await db.transaction(async (tx) => {
    await tx.delete(userTasks).where(eq(userTasks.userId, userId));
    await tx.insert(userTasks).values(taskIds.map((taskId) => ({ userId, taskId })));
  });

  res.json({ data: await getSelectedTasks(userId) });
};

export { listTasks, listSelectedTasks, saveSelectedTasks };
