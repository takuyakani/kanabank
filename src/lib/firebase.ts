import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseCustomConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const LOCAL_FIREBASE_CONFIG_KEY = 'kanabank_firebase_config';

export const getSavedFirebaseConfig = (): FirebaseCustomConfig | null => {
  try {
    if (typeof window !== 'undefined') {
      // URLクエリパラメータから設定を自動取得（招待リンク/QRコード経由での合流対応）
      const searchStr = window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
      const urlParams = new URLSearchParams(searchStr);
      const configParam = urlParams.get('firebase_config');
      if (configParam) {
        try {
          const decoded = JSON.parse(decodeURIComponent(atob(configParam)));
          if (decoded.apiKey && decoded.projectId) {
            localStorage.setItem(LOCAL_FIREBASE_CONFIG_KEY, JSON.stringify(decoded));
            return decoded;
          }
        } catch (e) {
          console.warn('URLパラメータからのFirebase設定パースエラー:', e);
        }
      }
    }

    const raw = localStorage.getItem(LOCAL_FIREBASE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return null;
};

export const saveFirebaseConfig = (config: FirebaseCustomConfig) => {
  localStorage.setItem(LOCAL_FIREBASE_CONFIG_KEY, JSON.stringify(config));
};

export const clearFirebaseConfig = () => {
  localStorage.removeItem(LOCAL_FIREBASE_CONFIG_KEY);
};

// .env または localStorage から Firebase 設定を取得
const savedConfig = typeof window !== 'undefined' ? getSavedFirebaseConfig() : null;

const firebaseConfig = {
  apiKey: savedConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: savedConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: savedConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: savedConfig?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: savedConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: savedConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.error('Firebase initialization error:', err);
  }
}

export { app, auth, db };
