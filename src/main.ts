import '@fontsource-variable/geist';
import '@fontsource/literata/400.css';
import './ui/app.css';
import { mount } from 'svelte';
import App from './ui/App.svelte';

mount(App, { target: document.querySelector<HTMLDivElement>('#app')! });
