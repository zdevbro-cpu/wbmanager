import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDPt4U62wHbKCKdLSCyMaqaMCKczwcjFWo',
  authDomain: 'crosswb-a7083.firebaseapp.com',
  projectId: 'crosswb-a7083',
  storageBucket: 'crosswb-a7083.firebasestorage.app',
  messagingSenderId: '1006822407460',
  appId: '1:1006822407460:web:0b8c86b47ee3e8b0d7c7b1',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
