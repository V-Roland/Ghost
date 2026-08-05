import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[ghost-ui] Unhandled application error:', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app dark">
          <div className="app-window profile-window">
            <section className="profile-sign-in">
              <div className="profile-sign-in-card card elevated">
                <span className="eyebrow">Ghost Startup</span>
                <h1>The application could not start</h1>
                <p>Check the browser console and Supabase environment configuration, then reload the page.</p>
                <button className="primary" onClick={() => globalThis.location.reload()}>Reload Ghost</button>
              </div>
            </section>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
