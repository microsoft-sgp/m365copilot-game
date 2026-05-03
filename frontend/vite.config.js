import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { execSync } from 'node:child_process';

function gitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

const currentGitSha = gitSha();
const sentryRelease =
  process.env.VITE_SENTRY_RELEASE ||
  process.env.SENTRY_RELEASE ||
  (currentGitSha ? `m365copilot-game@${currentGitSha}` : '');
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG || 'voyager163';
const sentryProject = process.env.SENTRY_PROJECT || 'javascript-vue';
const shouldUploadSentrySourceMaps = Boolean(sentryAuthToken && sentryRelease);
const sentryPlugins = shouldUploadSentrySourceMaps
  ? [
      sentryVitePlugin({
        org: sentryOrg,
        project: sentryProject,
        authToken: sentryAuthToken,
        release: { name: sentryRelease },
        sourcemaps: { assets: './dist/assets/**' },
        telemetry: false,
      }),
    ]
  : [];

export default defineConfig({
  plugins: [vue(), tailwindcss(), ...sentryPlugins],
  define: {
    'import.meta.env.VITE_GIT_SHA': JSON.stringify(currentGitSha),
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(sentryRelease),
  },
  build: {
    sourcemap: shouldUploadSentrySourceMaps || process.env.VITE_SENTRY_SOURCEMAPS === 'true',
  },
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
      reporter: ['text-summary', 'text', 'html', 'json-summary', 'lcov'],
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
