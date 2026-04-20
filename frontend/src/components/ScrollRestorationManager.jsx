import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Centralized route scroll policy:
 * - PUSH / REPLACE navigation starts at top (default app behavior)
 * - POP (back/forward) keeps prior scroll position
 * - Hash navigation and explicit preserve flags opt out
 */
export default function ScrollRestorationManager() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const preserveRequested = location.state?.preserveScroll === true;
    const hasHashTarget = Boolean(location.hash);
    const isHistoryNavigation = navigationType === 'POP';

    if (preserveRequested || hasHashTarget || isHistoryNavigation) {
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.key, location.pathname, location.search, location.hash, location.state, navigationType]);

  return null;
}
