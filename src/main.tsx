import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadStore } from './lib/store';
import './styles.css';

loadStore();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
