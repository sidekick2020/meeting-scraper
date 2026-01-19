import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// You'll need to replace this with your actual Google Client ID
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

// Allowed email domains for admin access
const ALLOWED_DOMAINS = ['sobersidekick.com', 'empathyhealthtech.com'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const isAllowedDomain = (email) => {
    if (!email) return false;
    const domain = email.split('@')[1]?.toLowerCase();
    return ALLOWED_DOMAINS.includes(domain);
  };

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        // Re-validate domain on load
        if (isAllowedDomain(parsed.email)) {
          setUser(parsed);
        } else {
          localStorage.removeItem('auth_user');
        }
      } catch (e) {
        localStorage.removeItem('auth_user');
      }
    }
    setIsLoading(false);

    // Load Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const signIn = () => {
    setAuthError(null);

    if (!GOOGLE_CLIENT_ID) {
      console.error('Google Client ID not configured');
      setAuthError('Google Sign-In not configured. Please set REACT_APP_GOOGLE_CLIENT_ID environment variable.');
      return;
    }

    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.prompt();
    } else {
      setAuthError('Google Sign-In is loading. Please try again.');
    }
  };

  const handleCredentialResponse = (response) => {
    // Decode the JWT token to get user info
    const payload = decodeJwt(response.credential);

    // Check if email domain is allowed
    if (!isAllowedDomain(payload.email)) {
      setAuthError(`Access denied. Only ${ALLOWED_DOMAINS.join(' and ')} email addresses are allowed.`);
      return;
    }

    const userData = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      token: response.credential,
    };
    setUser(userData);
    setAuthError(null);
    localStorage.setItem('auth_user', JSON.stringify(userData));
  };

  const decodeJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return {};
    }
  };

  const signOut = () => {
    setUser(null);
    setAuthError(null);
    localStorage.removeItem('auth_user');
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  const clearError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      signIn,
      signOut,
      isAuthenticated: !!user,
      authError,
      clearError,
      allowedDomains: ALLOWED_DOMAINS
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
