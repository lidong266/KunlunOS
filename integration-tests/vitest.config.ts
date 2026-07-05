import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 10000,
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@kunlun/ternary': path.resolve(__dirname, '../packages/kunlun-ternary/src'),
      '@kunlun/eventbus': path.resolve(__dirname, '../packages/kunlun-eventbus/src'),
      '@kunlun/spiral': path.resolve(__dirname, '../packages/kunlun-spiral/src'),
      '@kunlun/pw': path.resolve(__dirname, '../packages/kunlun-pw/src'),
      '@kunlun/presence': path.resolve(__dirname, '../packages/kunlun-presence/src'),
      '@kunlun/contradiction': path.resolve(__dirname, '../packages/kunlun-contradiction/src'),
      '@kunlun/ocgs': path.resolve(__dirname, '../packages/kunlun-ocgs/src'),
      '@kunlun/subsystems': path.resolve(__dirname, '../packages/kunlun-subsystems/src'),
    },
  },
});
