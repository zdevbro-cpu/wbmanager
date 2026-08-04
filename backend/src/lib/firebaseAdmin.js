import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Cloud Run/로컬(gcloud ADC) 모두에서 Application Default Credentials로 동작한다.
if (!getApps().length) {
  initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}

export const firebaseAuth = getAuth();
