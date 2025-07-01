// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, connectAuthEmulator } from "firebase/auth";

// Your web app's Firebase configuration using Vite env variables
// Use dummy values for development if env vars are missing
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-api-key-for-testing",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "test.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "test-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "test-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:dummy-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app); 

// Configure Firebase Auth for testing environment to bypass reCAPTCHA
auth.settings.appVerificationDisabledForTesting = true;

// Set test phone numbers that bypass reCAPTCHA completely
auth.settings.testPhoneNumbers = {
  '+15555550100': '123456', // Test number 1
  '+15555550101': '123456', // Test number 2
  '+15555550102': '123456', // Test number 3
  '+15555550103': '123456', // Test number 4
  '+15555550104': '123456', // Test number 5
};

console.log('Firebase Config Debug:', {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? '***SET***' : 'MISSING',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  isDev: import.meta.env.DEV,
  testModeEnabled: true
});
