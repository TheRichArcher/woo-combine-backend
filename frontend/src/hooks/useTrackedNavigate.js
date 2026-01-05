import { useNavigate as useReactRouterNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';

/**
 * useTrackedNavigate - Debug wrapper for useNavigate that logs all navigation calls
 * 
 * This helps us identify which components are causing navigation during app initialization,
 * which can lead to screen flashing/flickering as multiple redirects fire.
 * 
 * Usage: Replace `useNavigate()` with `useTrackedNavigate()` in any component
 * where you want to debug navigation behavior.
 */
export function useTrackedNavigate(componentName = 'Unknown') {
  const navigate = useReactRouterNavigate();
  const location = useLocation();
  const navigationCount = useRef(0);

  useEffect(() => {
    console.log(`[useTrackedNavigate] ${componentName} mounted at ${location.pathname}`);
    return () => {
      console.log(`[useTrackedNavigate] ${componentName} unmounted (${navigationCount.current} navigations)`);
    };
  }, [componentName, location.pathname]);

  // Return wrapped navigate function that logs
  return (to, options = {}) => {
    navigationCount.current++;
    
    const callStack = new Error().stack;
    const callerLine = callStack.split('\n')[2]?.trim() || 'unknown';
    
    console.log(`[useTrackedNavigate] NAV_FROM: ${componentName} → ${to}`, {
      fromPath: location.pathname,
      toPath: to,
      options,
      caller: callerLine,
      navigationNumber: navigationCount.current,
      timestamp: new Date().toISOString()
    });

    // Call original navigate
    return navigate(to, options);
  };
}

/**
 * NavigationLogger - Component that logs all route changes
 * Place this inside BrowserRouter to track every route transition
 */
export function NavigationLogger() {
  const location = useLocation();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      console.log(`[NavigationLogger] ROUTE_CHANGE: ${previousPath.current} → ${location.pathname}`, {
        from: previousPath.current,
        to: location.pathname,
        timestamp: new Date().toISOString(),
        state: location.state
      });
      previousPath.current = location.pathname;
    }
  }, [location]);

  return null;
}

