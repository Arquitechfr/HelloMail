import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    hookTimeout: 60000,
    testTimeout: 30000,
    maxWorkers: 2,
    fileParallelism: false,
    globalSetup: ['./src/test/globalSetup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/app.ts',
        'src/worker.ts',
        'src/config/env.ts',
        'src/test/**',
        // Worker de sync (Phase 2) — non couvert par les tests Phase 3.
        'src/services/sync/syncManager.ts',
        'src/services/sync/idleLoop.ts',
        'src/services/sync/initialSync.ts',
        'src/services/sync/reconcileFolder.ts',
        'src/services/sync/accountRegistry.ts',
        // connectionTest — testé indirectement via les mocks d'intégration.
        'src/services/email/connectionTest.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
