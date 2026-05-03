import { createApp } from 'vue';
import App from './App.vue';
import { initFrontendSentry, runFrontendSentrySmokeCheck } from './lib/sentry.js';
import './styles/tailwind.css';

type SentrySmokeWindow = Window & {
	__m365copilotSentrySmokeCheck?: () => void;
};

const app = createApp(App);
initFrontendSentry(app);

if (import.meta.env.VITE_SENTRY_SMOKE_CHECK === 'true' && typeof window !== 'undefined') {
	(window as SentrySmokeWindow).__m365copilotSentrySmokeCheck = runFrontendSentrySmokeCheck;
}

app.mount('#app');
