import { Component } from 'react';

/** Last-resort UI so a rendering bug never leaves the user on a blank page. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-xl font-extrabold">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-500">Please reload the page. Your seat hold and booking are safe on our servers.</p>
          <button onClick={() => window.location.assign('/')} className="mt-5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white">
            Back to home
          </button>
        </div>
      </div>
    );
  }
}
