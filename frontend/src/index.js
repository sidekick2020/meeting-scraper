import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Import ParseContext early to trigger synchronous Parse SDK initialization
// This ensures Parse is ready BEFORE any React components mount.
// The initialization happens at module load time, not in useEffect,
// which eliminates race conditions and reduces perceived latency.
import './contexts/ParseContext';

import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
