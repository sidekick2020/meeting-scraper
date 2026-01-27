import React from 'react';

const AboutPage = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">About</h1>
        <p className="page-description">
          Learn more about this application and the Sober Sidekick platform.
        </p>
      </div>

      <div className="card max-w-2xl">
        <div className="card-body">
          <h2 className="text-lg font-semibold mb-4">About This Template</h2>
          <p className="mb-4">
            This application was created using the Sober Sidekick subdomain skeleton template.
            It includes all the shared design system components, authentication, and analytics
            that are used across the Sober Sidekick platform.
          </p>

          <h3 className="text-md font-semibold mb-2">Features</h3>
          <ul className="mb-4" style={{ paddingLeft: '1.5rem', listStyle: 'disc' }}>
            <li>Shared design tokens and CSS variables</li>
            <li>Pre-built component styles</li>
            <li>Google Sign-In with domain validation</li>
            <li>Amplitude analytics integration</li>
            <li>Light/dark theme support</li>
            <li>Responsive layout patterns</li>
            <li>Client-side data caching</li>
          </ul>

          <h3 className="text-md font-semibold mb-2">Getting Started</h3>
          <p>
            Edit the files in <code>src/</code> to customize this application.
            Start by updating the app name in the Header component and adding
            your own routes and pages.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
