import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';

export default function Navigation() {
  const { user } = useAuth();

  return (
    <nav className="bg-gray-800 text-white p-4">
      <div className="container mx-auto flex flex-wrap items-center justify-between">
        <div className="text-xl font-bold">Woo-Combine</div>
        <div className="flex items-center space-x-4">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md ${isActive ? 'bg-gray-900' : 'hover:bg-gray-700'}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/players"
            className={({ isActive }) =>
              `px-3 py-2 rounded-md ${isActive ? 'bg-gray-900' : 'hover:bg-gray-700'}`
            }
          >
            Players
          </NavLink>
          {user && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `px-3 py-2 rounded-md ${isActive ? 'bg-gray-900' : 'hover:bg-gray-700'}`
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
                  `px-3 py-2 rounded-md ${isActive ? 'bg-gray-900' : 'hover:bg-gray-700'}`
                }
              >
                Login
              </NavLink>
              <NavLink
                to="/signup"
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md ${isActive ? 'bg-gray-900' : 'hover:bg-gray-700'}`
                }
              >
                Sign Up
              </NavLink>
            </>
          ) : (
            <button
              onClick={() => auth.signOut()}
              className="px-3 py-2 rounded-md hover:bg-gray-700"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
} 