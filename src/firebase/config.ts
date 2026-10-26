import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || (typeof globalThis !== 'undefined' && (globalThis as any).process ? (globalThis as any).process.env : {}) || {}

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'mock-api-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'mock.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'mock-project',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'mock.appspot.com',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

if (env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  } catch {
    // Emulator connection already established
  }
}

let messagingInstance: any = null

export const getFirebaseMessaging = async (): Promise<any | null> => {
  if (typeof window !== 'undefined') {
    try {
      const { isSupported, getMessaging } = await import('firebase/messaging')
      if (await isSupported()) {
        if (!messagingInstance) {
          messagingInstance = getMessaging(app)
        }
        return messagingInstance
      }
    } catch (err) {
      console.warn('Firebase messaging not supported or failed to load:', err)
      return null
    }
  }
  return null
}

export default app


