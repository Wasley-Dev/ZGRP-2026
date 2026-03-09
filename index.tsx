
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ZAYA_LOGO_SRC } from './brand';

type RootBoundaryState = {
  hasError: boolean;
};

class RootBoundary extends React.Component<React.PropsWithChildren, RootBoundaryState> {
  state: RootBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RootBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Root render failure:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell app-full-height flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#1055a5_0%,#003366_34%,#02111f_100%)] p-6 text-white">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/15 bg-white/10 p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[1.5rem] bg-white p-3 shadow-lg">
              <img src={ZAYA_LOGO_SRC} alt="Zaya Group logo" className="h-full w-full object-contain" />
            </div>
            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.34em] text-gold">Recovery Mode</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">The workspace hit an unexpected startup error.</h1>
            <p className="mt-4 text-sm leading-7 text-white/80">Refresh the page to retry. If the issue persists, review the latest deployment or runtime configuration.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </React.StrictMode>
);
