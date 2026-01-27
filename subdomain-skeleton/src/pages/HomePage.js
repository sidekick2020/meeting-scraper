import React from 'react';
import { useAuth } from '../contexts';

const HomePage = () => {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">
          {isAuthenticated ? `Welcome, ${user.givenName}!` : 'Welcome'}
        </h1>
        <p className="page-description">
          This is your new Sober Sidekick subdomain application.
          Start building something amazing!
        </p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🎨 Design System</h3>
          </div>
          <div className="card-body">
            <p>
              Pre-built components, design tokens, and utility classes
              for consistent styling across all Sober Sidekick apps.
            </p>
          </div>
          <div className="card-footer">
            <span className="badge badge-success">Ready</span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🔐 Authentication</h3>
          </div>
          <div className="card-body">
            <p>
              Google Sign-In with domain validation.
              Shared across all subdomains.
            </p>
          </div>
          <div className="card-footer">
            <span className="badge badge-primary">
              {isAuthenticated ? 'Authenticated' : 'Sign in to test'}
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📊 Analytics</h3>
          </div>
          <div className="card-body">
            <p>
              Amplitude integration with standardized events.
              Track user behavior consistently.
            </p>
          </div>
          <div className="card-footer">
            <span className="badge badge-info">Configured</span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🌙 Theme Support</h3>
          </div>
          <div className="card-body">
            <p>
              Light and dark themes with system preference detection.
              Toggle with the button in the header!
            </p>
          </div>
          <div className="card-footer">
            <span className="badge badge-warning">Try it!</span>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-3 stack-mobile">
          <button className="btn btn-primary">Primary Button</button>
          <button className="btn btn-secondary">Secondary Button</button>
          <button className="btn btn-success">Success Button</button>
          <button className="btn btn-danger">Danger Button</button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
