import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 15_000
  }
});
