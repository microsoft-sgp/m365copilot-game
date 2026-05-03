import { createApp } from 'vue';
import App from './App.vue';
import { initFrontendSentry } from './lib/sentry.js';
import './styles/tailwind.css';

const app = createApp(App);
initFrontendSentry(app);
app.mount('#app');
