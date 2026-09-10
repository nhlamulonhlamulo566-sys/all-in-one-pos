'use client';

import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

export function initializeFirebase() {
  if (typeof window === 'undefined') {
    return getSdks(undefined);
  }

  try {
    const firebaseApp = getApps().length
      ? getApps()[0]
      : initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    return getSdks(undefined);
  }
}

export function getSdks(firebaseApp?: FirebaseApp) {
  if (!firebaseApp) {
    return {
      firebaseApp: undefined as unknown as FirebaseApp,
      auth: undefined as unknown as Auth,
      firestore: undefined as unknown as Firestore,
    };
  }

  try {
    return {
      firebaseApp,
      auth: getAuth(firebaseApp),
      firestore: typeof window === 'undefined'
        ? getFirestore(firebaseApp)
        : initializeFirestore(firebaseApp, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
          }),
    };
  } catch (error) {
    console.error('Firebase SDK setup failed:', error);
    return {
      firebaseApp,
      auth: undefined as unknown as Auth,
      firestore: undefined as unknown as Firestore,
    };
  }
}
