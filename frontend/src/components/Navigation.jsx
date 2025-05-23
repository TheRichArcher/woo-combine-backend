import React, { useState, useEffect } from 'react';
console.log('NAVIGATION IS MOUNTED');
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { Menu } from 'lucide-react';

export default function Navigation() {
  const { user, leagues, selectedLeagueId, setSelectedLeagueId } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu if resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <div style={{ backgroundColor: 'lime', padding: 12, fontWeight: 'bold' }}>
        ✅ NAV JSX RENDERED — No conditionals, no Tailwind
      </div>
      <ul>
        <li style={{ color: 'red', fontSize: 20 }}>🔗 Hardcoded Link 1</li>
        <li style={{ color: 'blue', fontSize: 20 }}>🔗 Hardcoded Link 2</li>
      </ul>
    </>
  );
} 