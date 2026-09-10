'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase/initialize';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseServices, setFirebaseServices] = useState<any | null>(null);

  useEffect(() => {
    let isActive = true;

    const bootstrap = async () => {
      try {
        const services = await initializeFirebase();
        if (isActive) {
          setFirebaseServices(services);
        }
      } catch (error) {
        console.error('Client Firebase provider failed to initialize:', error);
        if (isActive) {
          setFirebaseServices({
            firebaseApp: undefined,
            auth: undefined,
            firestore: undefined,
          });
        }
      }
    };

    bootstrap();

    return () => {
      isActive = false;
    };
  }, []);

  if (!firebaseServices) {
    return null;
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
