// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, inMemoryPersistence } from "firebase/auth";
import { logger } from "./utils/logger";

// Your web app's Firebase configuration using Vite env variables
// Use dummy values for development if env vars are missing
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-api-key-for-testing",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "test.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "test-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "test-project.appspot.com",
  // messagingSenderId removed - not using Firebase messaging
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:dummy-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Ensure tokens are not persisted in browser storage
setPersistence(auth, inMemoryPersistence).catch(() => {
  // Non-fatal in environments where persistence override is not supported
});

// Debug Firebase configuration in development only
logger.debug('FIREBASE', 'Firebase configuration loaded', {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? '***SET***' : 'MISSING',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  isDev: import.meta.env.DEV
});
