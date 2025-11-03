import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Modal from './ui/Modal';
import Button from './ui/Button';

export default function SessionExpiredGate() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = () => {
      setOpen(true);
    };
    window.addEventListener('wc-session-expired', handler);
    return () => window.removeEventListener('wc-session-expired', handler);
  }, []);

  const handleLoginAgain = useCallback(() => {
    try {
      const currentPath = location.pathname || '/';
      const onboarding = ['/login','/signup','/verify-email','/welcome','/'];
      const target = onboarding.includes(currentPath) ? '/dashboard' : (currentPath + (location.search || ''));
      localStorage.setItem('postLoginRedirect', target);
    } catch {}
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


