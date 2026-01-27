/**
 * Auth Context
 *
 * Handles Google Sign-In authentication with domain validation.
 *
 * Dependencies:
 *   npm install jwt-decode
 *
 * Environment Variables:
 *   REACT_APP_GOOGLE_CLIENT_ID - Your Google OAuth client ID
 *
 * Usage:
 *   import { AuthProvider, useAuth } from './contexts/AuthContext';
 *
 *   // In app root
 *   <AuthProvider>
 *     <App />
 *   </AuthProvider>
 *
 *   // In components
 *   const { user, isAuthenticated, signIn, signOut } = useAuth();
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);

const AUTH_STORAGE_KEY = 'auth_user';
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Configure allowed email domains for sign-in
// Modify this list based on your organization's requirements
const ALLOWED_DOMAINS = ['sobersidekick.com', 'empathyhealthtech.com'];

export const AuthProvider = ({ children, allowedDomains = ALLOWED_DOMAINS }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkExistingSession = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);

          // Validate that the stored user's domain is still allowed
          const domain = parsed.email?.split('@')[1];
          if (domain && allowedDomains.includes(domain)) {
            setUser(parsed);
          } else {
            // Clear invalid session
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('Failed to restore auth session:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, [allowedDomains]);

  // Initialize Google Sign-In
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn('REACT_APP_GOOGLE_CLIENT_ID is not set. Google Sign-In will not work.');
      return;
    }

    const initializeGoogleSignIn = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: true,
          cancel_on_tap_outside: true,
        });
      }
    };

    // Check if Google script is already loaded
    if (window.google?.accounts?.id) {
      initializeGoogleSignIn();
    } else {
      // Load Google Sign-In script
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleSignIn;
      document.body.appendChild(script);
    }
  }, []);

  const handleCredentialResponse = useCallback(async (response) => {
    try {
      setAuthError(null);
      const decoded = jwtDecode(response.credential);

      // Validate email domain
      const domain = decoded.email?.split('@')[1];
      if (!domain || !allowedDomains.includes(domain)) {
        throw new Error(`Access restricted to authorized domains only.`);
      }

      const userData = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        givenName: decoded.given_name,
        familyName: decoded.family_name,
        picture: decoded.picture,
        locale: decoded.locale,
      };

      // Persist session
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);

      return userData;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  }, [allowedDomains]);

  const signIn = useCallback(async (credential) => {
    return handleCredentialResponse({ credential });
  }, [handleCredentialResponse]);

  const signOut = useCallback(() => {
    // Clear stored session
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setAuthError(null);

    // Disable auto-select for next sign-in
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }, []);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  // Render Google Sign-In button
  const renderSignInButton = useCallback((elementId, options = {}) => {
    if (!window.google?.accounts?.id) {
      console.warn('Google Sign-In not initialized');
      return;
    }

    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element with id "${elementId}" not found`);
      return;
    }

    window.google.accounts.id.renderButton(element, {
      theme: options.theme || 'outline',
      size: options.size || 'large',
      width: options.width || 280,
      text: options.text || 'signin_with',
      shape: options.shape || 'rectangular',
      logo_alignment: options.logoAlignment || 'left',
    });
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    authError,
    signIn,
    signOut,
    clearError,
    renderSignInButton,
    allowedDomains,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
