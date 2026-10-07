import { defineConfig } from 'vitest/config';
import { reactNative } from 'vitest-native';

export default defineConfig({
  plugins: [reactNative({ engine: 'mock' })],
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    setupFiles: ['./test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10_000
  }
});
