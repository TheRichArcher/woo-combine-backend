import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { Menu } from 'lucide-react';

export default function Navigation() {
  const { user, leagues, selectedLeagueId, setSelectedLeagueId } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-cmf-contrast text-cmf-accent p-4 shadow-md">
      <div className="container mx-auto flex flex-wrap items-center justify-between">
        <div className="text-2xl font-extrabold tracking-wide text-cmf-primary drop-shadow">Woo-Combine</div>
        {/* Hamburger for mobile */}
        <button className="sm:hidden p-2" onClick={() => setMobileOpen(v => !v)} aria-label="Open menu">
          <Menu className="w-7 h-7 text-cmf-primary" />
        </button>
        {/* Desktop nav */}
        <div className="hidden sm:flex items-center space-x-2 sm:space-x-4">
          {leagues && leagues.length > 0 && (
            <select
              className="border rounded px-2 py-1 bg-white text-cmf-primary font-semibold mr-2"
              value={selectedLeagueId}
              onChange={e => setSelectedLeagueId(e.target.value)}
            >
              {leagues.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/players"
            className={({ isActive }) =>
              `px-3 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
            }
          >
            Players
          </NavLink>
          {user && (
            <NavLink
              to="/create-league"
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
              }
            >
              Create or Join League
            </NavLink>
          )}
          {user && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
              }
            >
              Admin
            </NavLink>
          )}
          {!user ? (
            <>
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
                }
              >
                Login
              </NavLink>
              <NavLink
                to="/signup"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
                }
              >
                Sign Up
              </NavLink>
            </>
          ) : (
            <button
              onClick={() => auth.signOut()}
              className="px-3 py-2 rounded-lg font-semibold transition hover:bg-cmf-primary/10 hover:text-cmf-primary"
            >
              Logout
            </button>
          )}
        </div>
        {/* Mobile nav menu */}
        {mobileOpen && (
          <div className="sm:hidden absolute top-16 left-0 w-full bg-white shadow-lg z-50 border-t border-gray-200">
            <div className="flex flex-col items-center py-4 space-y-2">
              {leagues && leagues.length > 0 && (
                <select
                  className="border rounded px-2 py-1 bg-white text-cmf-primary font-semibold mb-2"
                  value={selectedLeagueId}
                  onChange={e => setSelectedLeagueId(e.target.value)}
                >
                  {leagues.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `block px-4 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
                }
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/players"
                className={({ isActive }) =>
                  `block px-4 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
                }
                onClick={() => setMobileOpen(false)}
              >
                Players
              </NavLink>
              {user && (
                <NavLink
                  to="/create-league"
                  className={({ isActive }) =>
                    `block px-4 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  Create or Join League
                </NavLink>
              )}
              {user && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `block px-4 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  Admin
                </NavLink>
              )}
              {!user ? (
                <>
                  <NavLink
                    to="/login"
                    className={({ isActive }) =>
                      `block px-4 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    Login
                  </NavLink>
                  <NavLink
                    to="/signup"
                    className={({ isActive }) =>
                      `block px-4 py-2 rounded-lg font-semibold transition ${isActive ? 'text-cmf-primary underline underline-offset-4' : 'hover:bg-cmf-primary/10 hover:text-cmf-primary'}`
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign Up
                  </NavLink>
                </>
              ) : (
                <button
                  onClick={() => {
                    auth.signOut();
                    setMobileOpen(false);
                  }}
                  className="block px-4 py-2 rounded-lg font-semibold transition hover:bg-cmf-primary/10 hover:text-cmf-primary"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
} 