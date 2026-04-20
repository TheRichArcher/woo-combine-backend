import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { useAuth } from '../context/AuthContext';

export default function SessionExpiredGate() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, authChecked, roleChecked, initializing } = useAuth();

  useEffect(() => {
    const handler = () => {
      console.info('[SessionExpiredGate] Session-expired overlay requested');
      setOpen(true);
    };
    window.addEventListener('wc-session-expired', handler);
    return () => window.removeEventListener('wc-session-expired', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    console.info('[SessionExpiredGate] Overlay mounted', {
      pathname: location.pathname,
      authChecked,
      roleChecked,
      hasUser: !!user
    });
    return () => {
      console.info('[SessionExpiredGate] Overlay unmounted', {
        pathname: location.pathname
      });
    };
  }, [open, location.pathname, authChecked, roleChecked, user]);

  // Prevent stale modal backdrops from blocking interaction after login/refresh.
  useEffect(() => {
    if (!open) return;
    const authRecovered =
      !initializing &&
      authChecked &&
      roleChecked &&
      !!user;

    if (authRecovered) {
      console.info('[SessionExpiredGate] Closing overlay after auth recovery', {
        pathname: location.pathname,
        hasUser: !!user
      });
      setOpen(false);
    }
  }, [open, initializing, authChecked, roleChecked, user, location.pathname]);

  // Never block auth entry screens with a stale backdrop.
  useEffect(() => {
    if (!open) return;
    const authEntryRoutes = ['/login', '/signup', '/welcome', '/verify-email'];
    if (authEntryRoutes.includes(location.pathname)) {
      console.info('[SessionExpiredGate] Closing overlay on auth entry route', {
        pathname: location.pathname
      });
      setOpen(false);
    }
  }, [open, location.pathname]);

  const handleLoginAgain = useCallback(() => {
    try {
      const currentPath = location.pathname || '/';
      const onboarding = ['/login','/signup','/verify-email','/welcome','/'];
      const target = onboarding.includes(currentPath) ? '/dashboard' : (currentPath + (location.search || ''));
      localStorage.setItem('postLoginRedirect', target);
    } catch { /* ignore localStorage errors */ }
    setOpen(false);
    navigate('/login?reason=session_expired', { replace: true });
  }, [location.pathname, location.search, navigate]);

  if (!open) return null;

  return (
    <Modal
      title="Session Expired"
      onClose={() => setOpen(false)}
      size="sm"
      footer={(
        <>
          <Button variant="primary" onClick={handleLoginAgain}>
            Log In Again
          </Button>
        </>
      )}
    >
      <p className="text-sm text-text">
        Your session has expired. Please log in again.
      </p>
    </Modal>
  );
}


