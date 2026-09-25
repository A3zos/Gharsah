// Lazily initialised Firebase services. Import this module only from routes that
// need Firebase (never from the landing page), so the landing bundle stays small.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

import { EMULATORS, firebaseConfig, FUNCTIONS_REGION, useEmulators } from './config';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
}

let services: FirebaseServices | undefined;

export function firebase(): FirebaseServices {
  if (services) return services;
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, FUNCTIONS_REGION);
  const storage = getStorage(app);
  if (useEmulators) {
    const { host } = EMULATORS;
    connectAuthEmulator(auth, `http://${host}:${EMULATORS.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, EMULATORS.firestore);
    connectFunctionsEmulator(functions, host, EMULATORS.functions);
    connectStorageEmulator(storage, host, EMULATORS.storage);
  }
  services = { app, auth, db, functions, storage };
  return services;
}
