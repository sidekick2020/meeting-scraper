import React, { useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useTheme, useAuth, useAnalytics } from './contexts';

// Components
import Header from './components/Header';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import NotFound from './pages/NotFound';

function App() {
  const { theme } = useTheme();
  const { trackPageView } = useAnalytics();
  const location = useLocation();

  // Track page views on route change
  useEffect(() => {
    trackPageView(location.pathname, {
      search: location.search,
    });
  }, [location, trackPageView]);

  return (
    <div className="app" data-theme={theme}>
      <Header />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
