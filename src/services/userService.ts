import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { db, firebaseConfig } from '@/firebase/config'
import type { UserProfile, UserRole } from '@/types/auth'
import { auditService } from '@/services/auditService'

const USERS_COLLECTION = 'users'

export const userService = {
  /**
   * Fetches all registered user profiles from Firestore.
   */
  async getUsers(): Promise<UserProfile[]> {
    const usersRef = collection(db, USERS_COLLECTION)
    const q = query(usersRef, orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    })) as UserProfile[]
  },

  /**
   * Registers a new authentication user in Firebase Auth with password AND saves their profile in Firestore.
   * Uses a secondary app instance so the active admin session is NOT logged out.
   */
  async registerNewUserWithAuth(
    data: { email: string; password?: string; displayName?: string; role: UserRole },
    performedBy = 'System'
  ): Promise<void> {
    let uid = ''

    if (data.password && data.password.trim().length >= 6) {
      const secondaryApp = getApps().find(app => app.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp')
      const secondaryAuth = getAuth(secondaryApp)

      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        data.email.trim(),
        data.password.trim()
      )
      uid = userCredential.user.uid
      await signOut(secondaryAuth)
    } else {
      uid = `user_${Date.now()}`
    }

    await this.saveUserProfile(
      {
        uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role
      },
      performedBy
    )
  },

  /**
   * Creates or updates a user profile in Firestore.
   */
  async saveUserProfile(
    profileData: { uid: string; email: string; displayName?: string; role: UserRole },
    performedBy = 'System'
  ): Promise<void> {
    const userDocRef = doc(db, USERS_COLLECTION, profileData.uid)
    const existingSnap = await getDoc(userDocRef)

    const payload = {
      uid: profileData.uid,
      email: profileData.email.toLowerCase().trim(),
      displayName: profileData.displayName?.trim() || '',
      role: profileData.role,
      updatedAt: serverTimestamp(),
      ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() })
    }

    await setDoc(userDocRef, payload, { merge: true })

    await auditService.logAction(
      (existingSnap.exists() ? 'SYSTEM_USER_UPDATE' : 'SYSTEM_USER_CREATE') as any,
      'system',
      `${existingSnap.exists() ? 'Updated' : 'Registered'} user account '${profileData.email}' with role '${profileData.role}'`,
      performedBy,
      { uid: profileData.uid, email: profileData.email, role: profileData.role }
    )
  },

  /**
   * Updates an existing user's role.
   */
  async updateUserRole(
    uid: string,
    email: string,
    newRole: UserRole,
    performedBy = 'System'
  ): Promise<void> {
    const userDocRef = doc(db, USERS_COLLECTION, uid)
    await updateDoc(userDocRef, {
      role: newRole,
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'SYSTEM_USER_UPDATE' as any,
      'system',
      `Changed role of user '${email}' to '${newRole}'`,
      performedBy,
      { uid, email, role: newRole }
    )
  },

  /**
   * Deletes a user profile document from Firestore.
   */
  async deleteUserProfile(uid: string, email: string, performedBy = 'System'): Promise<void> {
    const userDocRef = doc(db, USERS_COLLECTION, uid)
    await deleteDoc(userDocRef)

    await auditService.logAction(
      'SYSTEM_USER_DELETE' as any,
      'system',
      `Removed user account profile '${email}'`,
      performedBy,
      { uid, email }
    )
  }
}
