import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
const jsonRequest = vi.hoisted(() => vi.fn());

vi.mock('../src/api/client', () => ({ request, jsonRequest }));

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
  });

  it('uses the correct auth endpoints', async () => {
    jsonRequest.mockResolvedValue({});
    const { auth } = await loadApi();

    await auth.register({ email: 'a@b.com', password: '12345678', confirmPassword: '12345678' });
    await auth.verifyEmail({ email: 'a@b.com', otp: '123456' });
    await auth.resendVerification('a@b.com');
    await auth.login({ email: 'a@b.com', password: '12345678' });

    expect(jsonRequest).toHaveBeenNthCalledWith(1, '/api/v1/auth/register', 'POST', expect.any(Object));
    expect(jsonRequest).toHaveBeenNthCalledWith(2, '/api/v1/auth/verify-email', 'POST', expect.any(Object));
    expect(jsonRequest).toHaveBeenNthCalledWith(3, '/api/v1/auth/resend-verification', 'POST', { email: 'a@b.com' });
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
    request.mockResolvedValue([{ id: 1 }]);
    jsonRequest.mockResolvedValue([{ id: 1 }]);
    const { tasks } = await loadApi();

    await tasks.getTasks({ search: 'cleaning', category: 'Home Services', page: 2, limit: 10 });
    await tasks.saveSelectedTasks([1, 2]);

    expect(request).toHaveBeenCalledWith('/api/v1/tasks?search=cleaning&page=2&limit=10&category=Home+Services');
    expect(jsonRequest).toHaveBeenCalledWith('/api/v1/tasks/selected', 'PUT', { taskIds: [1, 2] });
  });

  it('reuses a warm catalogue cache', async () => {
    request.mockResolvedValue([{ id: 1 }]);
    const { tasks } = await loadApi();

    await expect(tasks.getTasks()).resolves.toEqual([{ id: 1 }]);
    await expect(tasks.getTasks()).resolves.toEqual([{ id: 1 }]);
    expect(request).toHaveBeenCalledOnce();
  });

  it('deduplicates concurrent catalogue requests', async () => {
    let resolve!: (value: unknown) => void;
    request.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { tasks } = await loadApi();

    const first = tasks.getTasks();
    const second = tasks.getTasks();
    expect(request).toHaveBeenCalledOnce();

    resolve([{ id: 1 }]);
    await expect(Promise.all([first, second])).resolves.toEqual([[{ id: 1 }], [{ id: 1 }]]);
  });
});
