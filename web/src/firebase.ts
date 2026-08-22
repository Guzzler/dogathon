import { initializeApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { LOCAL_MODE } from "./lib/localMode";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Without web/.env there is nothing to connect to; callers branch on LOCAL_MODE instead.
export const firebaseApp = LOCAL_MODE ? null : initializeApp(firebaseConfig);
export const firestore: Firestore = firebaseApp ? getFirestore(firebaseApp) : (null as unknown as Firestore);
