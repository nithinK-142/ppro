import { asc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { tasks, userTasks } from './schema/index.ts';

async function getSelectedTasks(userId: number) {
  return db
    .select({
      id: tasks.id,
      name: tasks.name,
      category: tasks.category,
      description: tasks.description
    })
    .from(userTasks)
    .innerJoin(tasks, eq(userTasks.taskId, tasks.id))
    .where(eq(userTasks.userId, userId))
    .orderBy(asc(tasks.category), asc(tasks.name));
}

export { getSelectedTasks };
