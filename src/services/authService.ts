import { 
  signInWithEmailAndPassword, 
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth'
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import type { UserProfile } from '@/types/auth'
import { auditService } from '@/services/auditService'

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
   * Changes the password for the currently logged-in user.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const currentUser = auth.currentUser
    if (!currentUser || !currentUser.email) {
      throw new Error('No active user session found. Please log in again.')
    }

    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.')
    }

    // 1. Re-authenticate
    const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
    await reauthenticateWithCredential(currentUser, credential)

    // 2. Update password
    await updatePassword(currentUser, newPassword)

    // 3. Log audit event
    await auditService.logAction(
      'USER_PASSWORD_CHANGE',
      'system',
      `User ${currentUser.email} changed their account password.`,
      currentUser.email
    )
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

      // Fallback: search by email if no doc found at auth UID
      if (email) {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('email', '==', email.toLowerCase().trim()))
        const snap = await getDocs(q)
        if (!snap.empty) {
          const profileData = snap.docs[0].data() as UserProfile
          // Auto-fix: re-save profile under the correct Auth UID
          // This fixes the Firestore rules isSuperAdmin() lookup mismatch
          try {
            await setDoc(doc(db, 'users', uid), {
              ...profileData,
              uid,
              updatedAt: serverTimestamp()
            }, { merge: true })
          } catch (fixErr) {
            console.warn('Could not auto-fix UID mismatch:', fixErr)
          }
          return { ...profileData, uid }
        }
      }
    } catch (err) {
      console.warn('Could not fetch user profile from Firestore:', err)
    }

    return null
  }
}
