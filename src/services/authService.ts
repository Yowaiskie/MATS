import { 
  signInWithEmailAndPassword, 
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import type { UserProfile } from '@/types/auth'

export const authService = {
  /**
   * Signs in a user using email and password.
   */
  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password)
  },

  /**
   * Signs out the current user.
   */
  async logout(): Promise<void> {
    await signOut(auth)
  },

  /**
   * Re-authenticates current logged in user with their password to confirm high-security actions (e.g. unlocking session).
   */
  async verifyPassword(password: string): Promise<boolean> {
    const currentUser = auth.currentUser
    if (!currentUser || !currentUser.email) {
      throw new Error('No active authenticated user session found.')
    }
    const credential = EmailAuthProvider.credential(currentUser.email, password)
    await reauthenticateWithCredential(currentUser, credential)
    return true
  },

  /**
   * Fetches the user profile from the Firestore users collection.
   * Returns null if the profile does not exist.
   */
  async getUserProfile(uid: string, email?: string | null): Promise<UserProfile | null> {
    try {
      const userDocRef = doc(db, 'users', uid)
      const userDoc = await getDoc(userDocRef)
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile
      }

      if (email) {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('email', '==', email.toLowerCase().trim()))
        const snap = await getDocs(q)
        if (!snap.empty) {
          return snap.docs[0].data() as UserProfile
        }
      }
    } catch (err) {
      console.warn('Could not fetch user profile from Firestore:', err)
    }

    return null
  }
}
