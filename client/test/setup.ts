import { afterEach, vi } from 'vitest';

process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:4000';
process.env.EXPO_PUBLIC_LOG_LEVEL = 'silent';

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn()
  },
  params: {} as Record<string, string>,
  secureStore: {
    getItemAsync: vi.fn(async () => null as string | null),
    setItemAsync: vi.fn(async () => undefined),
    deleteItemAsync: vi.fn(async () => undefined)
  }
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  const { Text } = await import('react-native');
  return {
    router: mocks.router,
    useLocalSearchParams: () => mocks.params,
    Link: ({ children }: { children: React.ReactNode }) => children,
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'router-redirect' }, href)
  };
});

vi.mock('expo-secure-store', () => mocks.secureStore);

export const testRouter = mocks.router;
export const routeParams = mocks.params;
export const secureStore = mocks.secureStore;

afterEach(() => {
  mocks.router.push.mockReset();
  mocks.router.replace.mockReset();
  mocks.router.back.mockReset();
  for (const key of Object.keys(mocks.params)) delete mocks.params[key];
  mocks.secureStore.getItemAsync.mockReset();
  mocks.secureStore.setItemAsync.mockReset();
  mocks.secureStore.deleteItemAsync.mockReset();
  mocks.secureStore.getItemAsync.mockResolvedValue(null);
  mocks.secureStore.setItemAsync.mockResolvedValue(undefined);
  mocks.secureStore.deleteItemAsync.mockResolvedValue(undefined);
});
