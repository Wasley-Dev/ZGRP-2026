
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

declare global {
  interface Window {
    __APP_BOOTED__?: boolean;
  }
}

// `__APP_BOOTED__` is set by the React app *after* the first successful mount.
// This keeps the HTML boot splash visible if React fails to render (instead of
// showing an empty dark-blue screen).

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
