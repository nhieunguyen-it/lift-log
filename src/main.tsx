import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

registerSW({ immediate: true });

// Follow the system theme. index.html starts dark so dark-mode users never see a flash.
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  document.documentElement.classList.toggle('dark', darkQuery.matches);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', darkQuery.matches ? '#0a0a0a' : '#ffffff');
}
applyTheme();
darkQuery.addEventListener('change', applyTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
