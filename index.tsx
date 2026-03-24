
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

declare global {
  interface Window {
    __APP_BOOTED__?: boolean;
  }
}

window.__APP_BOOTED__ = true;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
