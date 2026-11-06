import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
    // Closing Chrome after the PDF tests can exceed the 10 s default when the machine is busy.
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
