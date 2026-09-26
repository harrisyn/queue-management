import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    include: ['src/**/*.test.ts'],
    env: {
      MASTER_ENCRYPTION_KEY: 'test-only-master-encryption-key',
      JWT_SECRET: 'test-only-jwt-secret',
    },
  },
});
