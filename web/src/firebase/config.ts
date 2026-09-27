// The existing Firebase *web* app of project nibras-59284 — being replaced by
// Supabase (docs/supabase-migration.md). The API key is read from the untracked
// web/.env.local (VITE_FIREBASE_API_KEY) so no key is committed; the emulators
// accept any value.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'emulator-only',
  appId: '1:884261098380:web:71a9bf8d51d109370e3ca9',
  messagingSenderId: '884261098380',
  projectId: 'nibras-59284',
  authDomain: 'nibras-59284.firebaseapp.com',
  storageBucket: 'nibras-59284.firebasestorage.app',
  measurementId: 'G-BLM3Z1VWK3',
} as const;

/** Cloud Functions region (CLAUDE.md §14 — us-central1, next to Firestore nam5). */
export const FUNCTIONS_REGION = 'us-central1';

/** Emulator ports — must match app/firebase.json. */
export const EMULATORS = {
  host: '127.0.0.1',
  auth: 9099,
  firestore: 8080,
  functions: 5001,
  storage: 9198,
} as const;

/** `npm run dev:emu` (or VITE_USE_EMULATORS=1) talks to the local emulators. */
export const useEmulators = import.meta.env.VITE_USE_EMULATORS === '1';
