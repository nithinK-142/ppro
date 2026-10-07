import type { Task } from '../types';

export function groupTasksByCategory(tasks: Task[]): [string, Task[]][] {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    const group = groups.get(task.category);
    if (group) group.push(task);
    else groups.set(task.category, [task]);
  }

  return [...groups.entries()];
}
