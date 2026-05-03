import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{js,ts}'],
    exclude: ['dist/**', 'node_modules/**', 'coverage/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html', 'json-summary', 'lcov'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/index.ts', 'src/test-helpers/**', '**/*.test.js'],
      // Floors enforced when running `npm run test:coverage`.
      // Raise these as gaps are closed.
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 85,
        lines: 80,
      },
    },
  },
});
