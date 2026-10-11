import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@speclens/ai-core': path.resolve(__dirname, 'packages/ai-core/src/index.ts'),
      '@speclens/openapi-core': path.resolve(__dirname, 'packages/openapi-core/src/index.ts'),
      '@speclens/db': path.resolve(__dirname, 'packages/db/src/index.ts'),
      '@speclens/codegen': path.resolve(__dirname, 'packages/codegen/src/index.ts'),
      '@speclens/evals': path.resolve(__dirname, 'packages/evals/src/index.ts'),
      '@': path.resolve(__dirname, 'apps/web/src'),
    },
  },
});
