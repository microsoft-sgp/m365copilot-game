import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    open: false,
  },
  test: {
    include: ['src/**/*.test.{js,ts}'],
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./test/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html'],
      include: ['src/**/*.{js,ts,vue}'],
      exclude: ['src/main.{js,ts}', 'src/styles/**', '**/*.test.{js,ts}'],
      // Floors enforced when running `npm run test:coverage`.
      // Raise these as gaps are closed (e.g. once the remaining admin views —
      // AdminCampaigns/Dashboard/Layout/Organizations/Players — are tested).
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 55,
        lines: 70,
      },
    },
  },
});
