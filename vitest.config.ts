import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Keep jsdom startup predictable on Windows and lower-memory development machines.
  test: { pool: 'threads', maxWorkers: 1, fileParallelism: false },
});
