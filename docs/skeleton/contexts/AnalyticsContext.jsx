/**
 * Analytics Context
 *
 * Wraps Amplitude SDK for event tracking with standardized event names.
 *
 * Dependencies:
 *   npm install @amplitude/analytics-browser
 *
 * Environment Variables:
 *   REACT_APP_AMPLITUDE_API_KEY - Your Amplitude API key
 *
 * Usage:
 *   import { AnalyticsProvider, useAnalytics } from './contexts/AnalyticsContext';
 *
 *   // In app root
 *   <AnalyticsProvider>
 *     <App />
 *   </AnalyticsProvider>
 *
 *   // In components
 *   const { track, events, trackPageView, identify } = useAnalytics();
 *   track(events.BUTTON_CLICKED, { button_name: 'submit' });
 */

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import * as amplitude from '@amplitude/analytics-browser';

const AnalyticsContext = createContext(null);

const AMPLITUDE_API_KEY = process.env.REACT_APP_AMPLITUDE_API_KEY;

/**
 * Standard event names following Amplitude best practices:
 * - Use snake_case
 * - Use past tense verbs
 * - Noun + Verb pattern
 *
 * Add new events here to maintain consistency across the app.
 */
export const ANALYTICS_EVENTS = {
  // Page/View Events
  PAGE_VIEWED: 'page_viewed',
  MODAL_OPENED: 'modal_opened',
  MODAL_CLOSED: 'modal_closed',
  TAB_CHANGED: 'tab_changed',

  // Navigation Events
  NAVIGATION_CLICKED: 'navigation_clicked',
  LINK_CLICKED: 'link_clicked',
  BACK_CLICKED: 'back_clicked',

  // Search & Filter Events
  SEARCH_INITIATED: 'search_initiated',
  SEARCH_COMPLETED: 'search_completed',
  SEARCH_CLEARED: 'search_cleared',
  FILTER_APPLIED: 'filter_applied',
  FILTER_CLEARED: 'filter_cleared',
  SORT_CHANGED: 'sort_changed',

  // User Actions
  BUTTON_CLICKED: 'button_clicked',
  FORM_SUBMITTED: 'form_submitted',
  FORM_FIELD_CHANGED: 'form_field_changed',
  ITEM_SELECTED: 'item_selected',
  ITEM_DESELECTED: 'item_deselected',
  TOGGLE_CHANGED: 'toggle_changed',

  // Authentication Events
  SIGNIN_INITIATED: 'signin_initiated',
  SIGNIN_SUCCESS: 'signin_success',
  SIGNIN_FAILED: 'signin_failed',
  SIGNOUT_COMPLETED: 'signout_completed',

  // Content Events
  CONTENT_VIEWED: 'content_viewed',
  CONTENT_SHARED: 'content_shared',
  CONTENT_DOWNLOADED: 'content_downloaded',
  CONTENT_COPIED: 'content_copied',

  // Error Events
  ERROR_OCCURRED: 'error_occurred',
  API_ERROR: 'api_error',
  VALIDATION_ERROR: 'validation_error',

  // Performance Events
  API_REQUEST_COMPLETED: 'api_request_completed',
  PAGE_LOAD_COMPLETED: 'page_load_completed',

  // Feature-specific Events (extend as needed)
  MEETING_VIEWED: 'meeting_viewed',
  MEETING_DIRECTIONS_CLICKED: 'meeting_directions_clicked',
  MEETING_SHARED: 'meeting_shared',
  MEETING_SAVED: 'meeting_saved',
  MAP_INTERACTION: 'map_interaction',

  // Settings Events
  THEME_CHANGED: 'theme_changed',
  SETTINGS_CHANGED: 'settings_changed',
  NOTIFICATION_PREFERENCE_CHANGED: 'notification_preference_changed',
};

// Detect device type for automatic properties
const getDeviceType = () => {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
};

export const AnalyticsProvider = ({ children, appVersion = '1.0.0' }) => {
  const isInitialized = useRef(false);
  const sessionStartTime = useRef(Date.now());

  // Initialize Amplitude
  useEffect(() => {
    if (isInitialized.current) return;

    if (!AMPLITUDE_API_KEY) {
      console.warn('REACT_APP_AMPLITUDE_API_KEY is not set. Analytics will be disabled.');
      return;
    }

    try {
      amplitude.init(AMPLITUDE_API_KEY, {
        defaultTracking: {
          sessions: true,
          pageViews: false, // We track page views manually for more control
          formInteractions: true,
          fileDownloads: true,
        },
      });

      // Set session properties
      const identify = new amplitude.Identify();
      identify.set('device_type', getDeviceType());
      identify.set('app_version', appVersion);
      identify.set('environment', process.env.NODE_ENV);
      identify.set('session_start', new Date().toISOString());
      amplitude.identify(identify);

      isInitialized.current = true;
    } catch (error) {
      console.error('Failed to initialize Amplitude:', error);
    }
  }, [appVersion]);

  /**
   * Track an event with properties
   */
  const track = useCallback((eventName, properties = {}) => {
    if (!isInitialized.current) return;

    try {
      amplitude.track(eventName, {
        ...properties,
        timestamp: new Date().toISOString(),
        session_duration_ms: Date.now() - sessionStartTime.current,
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }, []);

  /**
   * Track a page view
   */
  const trackPageView = useCallback((pageName, properties = {}) => {
    track(ANALYTICS_EVENTS.PAGE_VIEWED, {
      page_name: pageName,
      page_path: window.location.pathname,
      page_url: window.location.href,
      referrer: document.referrer,
      ...properties,
    });
  }, [track]);

  /**
   * Identify a user and set user properties
   */
  const identify = useCallback((userId, properties = {}) => {
    if (!isInitialized.current) return;

    try {
      amplitude.setUserId(userId);

      if (Object.keys(properties).length > 0) {
        const identifyObj = new amplitude.Identify();
        Object.entries(properties).forEach(([key, value]) => {
          identifyObj.set(key, value);
        });
        amplitude.identify(identifyObj);
      }
    } catch (error) {
      console.error('Failed to identify user:', error);
    }
  }, []);

  /**
   * Set user properties without changing user ID
   */
  const setUserProperties = useCallback((properties) => {
    if (!isInitialized.current) return;

    try {
      const identifyObj = new amplitude.Identify();
      Object.entries(properties).forEach(([key, value]) => {
        identifyObj.set(key, value);
      });
      amplitude.identify(identifyObj);
    } catch (error) {
      console.error('Failed to set user properties:', error);
    }
  }, []);

  /**
   * Increment a numeric user property
   */
  const incrementUserProperty = useCallback((property, value = 1) => {
    if (!isInitialized.current) return;

    try {
      const identifyObj = new amplitude.Identify();
      identifyObj.add(property, value);
      amplitude.identify(identifyObj);
    } catch (error) {
      console.error('Failed to increment user property:', error);
    }
  }, []);

  /**
   * Track an error event
   */
  const trackError = useCallback((context, message, properties = {}) => {
    track(ANALYTICS_EVENTS.ERROR_OCCURRED, {
      error_context: context,
      error_message: message,
      ...properties,
    });
  }, [track]);

  /**
   * Track API request performance
   */
  const trackApiRequest = useCallback((endpoint, durationMs, success, properties = {}) => {
    track(ANALYTICS_EVENTS.API_REQUEST_COMPLETED, {
      endpoint,
      duration_ms: durationMs,
      success,
      ...properties,
    });
  }, [track]);

  /**
   * Clear user data (call on sign out)
   */
  const reset = useCallback(() => {
    if (!isInitialized.current) return;

    try {
      amplitude.reset();
    } catch (error) {
      console.error('Failed to reset analytics:', error);
    }
  }, []);

  const value = {
    track,
    trackPageView,
    identify,
    setUserProperties,
    incrementUserProperty,
    trackError,
    trackApiRequest,
    reset,
    events: ANALYTICS_EVENTS,
    isInitialized: isInitialized.current,
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
};

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
};

export default AnalyticsContext;
