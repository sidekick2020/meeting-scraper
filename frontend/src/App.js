import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DataCacheProvider } from './contexts/DataCacheContext';
import { ParseProvider, useParse } from './contexts/ParseContext';
import MeetingsExplorer from './components/MeetingsExplorer';
import AdminPanel from './components/AdminPanel';
import DeploymentIndicator from './components/DeploymentIndicator';
import DevDocs from './components/DevDocs';
import DownloadPage from './components/DownloadPage';
import NotFound from './components/NotFound';
import LoadingOverlay from './components/LoadingOverlay';
import PublicSidebar, { SidebarToggleButton } from './components/PublicSidebar';

function SignInModal({ onClose }) {
  const { signIn, authError, clearError, allowedDomains } = useAuth();

  const handleSignIn = () => {
    signIn();
  };

  const handleClose = () => {
    clearError();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="sign-in-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Admin Sign In</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <div className="sign-in-body">
          <p>Sign in with your Google account to access the admin dashboard.</p>
          <p className="sign-in-domains">
            Authorized domains: {allowedDomains.join(', ')}
          </p>

          {authError && (
            <div className="auth-error">
              {authError}
            </div>
          )}

          <button className="btn btn-google" onClick={handleSignIn}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { connectionStatus, isConnectionReady } = useParse();
  const [currentView, setCurrentView] = useState('public'); // 'public' or 'admin'
  const [showSignIn, setShowSignIn] = useState(false);
  const [isBackendReady, setIsBackendReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleAdminClick = () => {
    if (isAuthenticated) {
      setCurrentView('admin');
    } else {
      setShowSignIn(true);
    }
  };

  const handleBackToPublic = () => {
    setCurrentView('public');
  };

  const handleBackendReady = () => {
    setIsBackendReady(true);
  };

  // Check for admin=1 query param (from other pages navigating here)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1') {
      // Clear the query param
      window.history.replaceState({}, '', '/');
      handleAdminClick();
    }
  }, []);

  // Backend is ready when Parse connection check completes (success, error, or not configured)
  React.useEffect(() => {
    if (isConnectionReady) {
      setIsBackendReady(true);
    }
  }, [isConnectionReady]);

  // Check if user just signed in
  React.useEffect(() => {
    if (isAuthenticated && showSignIn) {
      setShowSignIn(false);
      setCurrentView('admin');
    }
  }, [isAuthenticated, showSignIn]);

  // Show simple loading screen only for auth state check
  if (isLoading) {
    return (
      <div className="App loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="App">
      <DeploymentIndicator />

      {currentView === 'public' ? (
        <>
          <MeetingsExplorer
            sidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
          />
          <PublicSidebar
            onAdminClick={handleAdminClick}
            isOpen={sidebarOpen}
            onToggle={setSidebarOpen}
          />
        </>
      ) : (
        <>
          {!isBackendReady && <LoadingOverlay onReady={handleBackendReady} />}
          <AdminPanel onBackToPublic={handleBackToPublic} />
        </>
      )}

      {showSignIn && (
        <SignInModal onClose={() => setShowSignIn(false)} />
      )}
    </div>
  );
}

function DocsPage() {
  const handleAdminClick = () => {
    window.location.href = '/?admin=1';
  };

  return (
    <div className="App">
      <DevDocs standalone={true} />
      <PublicSidebar onAdminClick={handleAdminClick} />
    </div>
  );
}

function DownloadPageWrapper() {
  const handleAdminClick = () => {
    window.location.href = '/?admin=1';
  };

  return (
    <div className="App">
      <DownloadPage />
      <PublicSidebar onAdminClick={handleAdminClick} />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ParseProvider>
          <AuthProvider>
            <DataCacheProvider>
              <Routes>
                <Route path="/" element={<AppContent />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/download" element={<DownloadPageWrapper />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </DataCacheProvider>
          </AuthProvider>
        </ParseProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
