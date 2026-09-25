// The existing Firebase *web* app of project nibras-59284 (same one the Flutter
// web build uses — app/lib/firebase_options.dart). These values are public
// identifiers, not secrets; access is enforced by the security rules and the
// callable Functions.
export const firebaseConfig = {
  apiKey: 'AIzaSyBQ3dnpPzxbzRVVBy_m625GVI2P5SvBi7w',
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
