import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@kunlun/ternary': path.resolve(__dirname, 'packages/kunlun-ternary/src'),
      '@kunlun/contradiction': path.resolve(__dirname, 'packages/kunlun-contradiction/src'),
      '@kunlun/eventbus': path.resolve(__dirname, 'packages/kunlun-eventbus/src'),
      '@kunlun/presence': path.resolve(__dirname, 'packages/kunlun-presence/src'),
      '@kunlun/spiral': path.resolve(__dirname, 'packages/kunlun-spiral/src'),
      '@kunlun/pw': path.resolve(__dirname, 'packages/kunlun-pw/src'),
      '@kunlun/ocgs': path.resolve(__dirname, 'packages/kunlun-ocgs/src'),
      '@kunlun/subsystems': path.resolve(__dirname, 'packages/kunlun-subsystems/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      thresholds: {
        'packages/kunlun-ternary/src/': {
          statements: 95,
          branches: 100,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
