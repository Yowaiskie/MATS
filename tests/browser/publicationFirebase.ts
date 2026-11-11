import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

if (!['127.0.0.1', 'localhost'].includes(window.location.hostname)) throw new Error('This fixture requires localhost.')
export const firebaseConfig = { projectId: 'demo-mats-publication-browser', apiKey: 'fake-emulator-api-key', appId: 'verification-only' }
const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
connectFirestoreEmulator(db, '127.0.0.1', 8080, { mockUserToken: { sub: 'verification-coordinator' } })
export const auth = getAuth(app)
export const getFirebaseMessaging = async () => null
export default app
