import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/authentication/AuthContext';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_KEY = 'mats_last_activity';

export const useInactivityRedirect = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Only track if user is logged in
    if (!user) return;

    const checkInactivity = () => {
      const lastActivityStr = localStorage.getItem(STORAGE_KEY);
      if (lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10);
        if (Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
          // If inactive for > 30 mins, redirect to dashboard
          // but only if we are not already on the dashboard
          if (location.pathname !== '/') {
            navigate('/', { replace: true });
          }
        }
      }
      // Always update on check to prevent immediate redirect on next interaction if it was close
      updateActivity();
    };

    const updateActivity = () => {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    };

    // Check inactivity on mount and when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };

    // Check immediately on mount
    checkInactivity();

    // Events to track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    // Throttle the localStorage update to avoid performance issues
    let throttleTimer: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          updateActivity();
          throttleTimer = null;
        }, 5000); // Update at most once every 5 seconds
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check periodically just in case
    const intervalId = setInterval(checkInactivity, 60000); // Check every minute

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(intervalId);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [user, navigate, location.pathname]);
};
