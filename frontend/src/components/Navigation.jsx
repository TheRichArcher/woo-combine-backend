import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';

export default function Navigation() {
  const { user } = useAuth();

  return (
    <nav className="bg-cmf-contrast text-cmf-accent p-4 shadow-md">
      <div className="container mx-auto flex flex-wrap items-center justify-between">
        <div className="text-2xl font-extrabold tracking-wide text-cmf-primary drop-shadow">Woo-Combine</div>
        <div className="flex items-center space-x-2 sm:space-x-4">
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
      </div>
    </nav>
  );
} 