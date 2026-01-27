import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import {
  ThemeProvider,
  AuthProvider,
  AnalyticsProvider,
  DataCacheProvider
} from './contexts';
import App from './App';
import './styles/index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AnalyticsProvider>
          <AuthProvider>
            <DataCacheProvider>
              <App />
            </DataCacheProvider>
          </AuthProvider>
        </AnalyticsProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
