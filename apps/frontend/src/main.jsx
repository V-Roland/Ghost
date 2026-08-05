import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import AppErrorBoundary from './components/error-boundary/AppErrorBoundary.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
