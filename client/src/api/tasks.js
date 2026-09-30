import { request } from './client';

export const getTasks = ({ search = '', category, page = 1, limit = 50 } = {}) => {
  const params = new URLSearchParams({ search, page: String(page), limit: String(limit) });
  if (category) params.set('category', category);
  return request(`/api/v1/tasks?${params.toString()}`);
};

export const saveSelectedTasks = (taskIds) => request('/api/v1/tasks/selected', {
  method: 'PUT',
  body: JSON.stringify({ taskIds })
});

export const getSelectedTasks = () => request('/api/v1/tasks/selected');
