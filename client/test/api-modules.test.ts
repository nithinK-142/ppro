import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
const jsonRequest = vi.hoisted(() => vi.fn());
const paginatedRequest = vi.hoisted(() => vi.fn());

vi.mock('../src/api/client', () => ({ request, jsonRequest, paginatedRequest }));

async function loadApi() {
  return {
    auth: await import('../src/api/auth'),
    profile: await import('../src/api/profile'),
    tasks: await import('../src/api/tasks')
  };
}

describe('API feature wrappers', () => {
  beforeEach(() => {
    vi.resetModules();
    request.mockReset();
    jsonRequest.mockReset();
    paginatedRequest.mockReset();
  });

  it('uses the correct auth endpoints', async () => {
    jsonRequest.mockResolvedValue({});
    const { auth } = await loadApi();

    await auth.register({ email: 'a@b.com', password: '12345678', confirmPassword: '12345678' });
    await auth.verifyEmail({ registrationId: '00000000-0000-4000-8000-000000000000', otp: '123456' });
    await auth.resendVerification('00000000-0000-4000-8000-000000000000');
    await auth.login({ email: 'a@b.com', password: '12345678' });

    expect(jsonRequest).toHaveBeenNthCalledWith(1, '/api/v1/auth/register', 'POST', expect.any(Object));
    expect(jsonRequest).toHaveBeenNthCalledWith(2, '/api/v1/auth/verify-email', 'POST', expect.any(Object));
    expect(jsonRequest).toHaveBeenNthCalledWith(3, '/api/v1/auth/resend-verification', 'POST', { registrationId: '00000000-0000-4000-8000-000000000000' });
    expect(jsonRequest).toHaveBeenNthCalledWith(4, '/api/v1/auth/login', 'POST', expect.any(Object));
  });

  it('uses the profile endpoints', async () => {
    request.mockResolvedValue({ user: { id: 1 } });
    jsonRequest.mockResolvedValue({ name: 'N' });
    const { profile } = await loadApi();

    await profile.getMe();
    await profile.saveProfile({ name: 'N', mobile: '+919876543210', address: 'Some address', businessName: '' });

    expect(request).toHaveBeenCalledWith('/api/v1/profile');
    expect(jsonRequest).toHaveBeenCalledWith('/api/v1/profile', 'PATCH', expect.any(Object));
  });

  it('fetches task pages and saves selection', async () => {
    paginatedRequest.mockResolvedValue({ data: [{ id: 1 }], pagination: { page: 2, limit: 10, total: 11, pages: 2 } });
    jsonRequest.mockResolvedValue([{ id: 1 }]);
    const { tasks } = await loadApi();

    const page = await tasks.getTasks({ search: 'cleaning', category: 'Home Services', page: 2, limit: 10 });
    expect(page.pagination).toEqual({ page: 2, limit: 10, total: 11, pages: 2 });
    expect(page.data).toEqual([{ id: 1 }]);
    await tasks.saveSelectedTasks([1, 2]);

    expect(paginatedRequest).toHaveBeenCalledWith('/api/v1/tasks?search=cleaning&page=2&limit=10&category=Home+Services');
    expect(jsonRequest).toHaveBeenCalledWith('/api/v1/tasks/selected', 'PUT', { taskIds: [1, 2] });
  });

  it('reuses a warm catalogue cache', async () => {
    paginatedRequest.mockResolvedValue({ data: [{ id: 1 }], pagination: { page: 1, limit: 50, total: 1, pages: 1 } });
    const { tasks } = await loadApi();

    const page = { data: [{ id: 1 }], pagination: { page: 1, limit: 50, total: 1, pages: 1 } };
    await expect(tasks.getTasks()).resolves.toEqual(page);
    await expect(tasks.getTasks()).resolves.toEqual(page);
    expect(paginatedRequest).toHaveBeenCalledOnce();
  });

  it('deduplicates concurrent catalogue requests', async () => {
    let resolve!: (value: unknown) => void;
    paginatedRequest.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { tasks } = await loadApi();

    const first = tasks.getTasks();
    const second = tasks.getTasks();
    expect(paginatedRequest).toHaveBeenCalledOnce();

    const page = { data: [{ id: 1 }], pagination: { page: 1, limit: 50, total: 1, pages: 1 } };
    resolve(page);
    await expect(Promise.all([first, second])).resolves.toEqual([page, page]);
  });
});
