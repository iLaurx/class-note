import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('No se pudo iniciar ClassNote. Cierra la aplicación y vuelve a abrirla.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
