import { jsonRequest, request } from './client';
import type { Task } from '../types';

const CATALOGUE_TTL_MS = 5 * 60 * 1000;
let catalogueCache: Task[] | null = null;
let catalogueCachedAt = 0;
let catalogueRequest: Promise<Task[]> | null = null;

type GetTasksOptions = {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
};

export async function getTasks({ search = '', category, page = 1, limit = 50 }: GetTasksOptions = {}): Promise<Task[]> {
  const useCatalogueCache = !search && !category && page === 1 && limit >= 50;

  if (useCatalogueCache && catalogueCache && Date.now() - catalogueCachedAt < CATALOGUE_TTL_MS) {
    return catalogueCache;
  }

  if (useCatalogueCache && catalogueRequest) return catalogueRequest;

  const params = new URLSearchParams({ search, page: String(page), limit: String(limit) });
  if (category) params.set('category', category);

  const promise = request<Task[]>(`/api/v1/tasks?${params.toString()}`);
  if (!useCatalogueCache) return promise;

  catalogueRequest = promise
    .then((data) => {
      catalogueCache = data;
      catalogueCachedAt = Date.now();
      return catalogueCache;
    })
    .finally(() => {
      catalogueRequest = null;
    });

  return catalogueRequest;
}

export const saveSelectedTasks = (taskIds: number[]) => jsonRequest<Task[]>('/api/v1/tasks/selected', 'PUT', { taskIds });
