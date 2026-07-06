import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts', 'src/**/*.test.ts'],
    testTimeout: 30000,
    fileParallelism: false,
  },
});
