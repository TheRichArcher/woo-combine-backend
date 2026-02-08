import React, { createContext, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const NavigationContext = createContext();

/**
 * NavigationContext - Centralized navigation state.
 * Provides navigate/location without coupling to AuthContext.
 */
export function NavigationProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const contextValue = {
    navigate,
    location,
    currentPath: location.pathname,
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNav() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNav must be used within a NavigationProvider");
  }
  return context;
}

export default NavigationContext;
