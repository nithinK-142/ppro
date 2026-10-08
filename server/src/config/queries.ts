import { asc, eq } from 'drizzle-orm';
import { db } from './db.ts';
import { profiles, tasks, userTasks, users } from './schema.ts';

async function findUserByEmail(email: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user;
}

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

export { findUserByEmail, getSelectedTasks };
