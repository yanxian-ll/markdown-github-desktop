import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'katex/dist/katex.min.css';
import 'prismjs/themes/prism-tomorrow.css';
import './assets/styles.css';
import App from './App.vue';

createApp(App).use(createPinia()).mount('#app');
