import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { db, firebaseConfig } from '@/firebase/config'
import type { UserProfile, UserRole, UserPermissions } from '@/types/auth'
import type { OrderGroup } from '@/types/member'
import { auditService } from '@/services/auditService'
import { authService } from '@/services/authService'

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
    data: { email: string; password?: string; displayName?: string; role: UserRole; assignedOrder?: OrderGroup; permissions?: Partial<UserPermissions> },
    performedBy = 'System'
  ): Promise<void> {
    let uid = ''

    if (data.password && data.password.trim().length >= 6) {
      const secondaryApp = getApps().find(app => app.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp')
      const secondaryAuth = getAuth(secondaryApp)

      try {
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth,
          data.email.trim(),
          data.password.trim()
        )
        uid = userCredential.user.uid
        await signOut(secondaryAuth)
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          // Check if profile document already exists in Firestore by querying users collection
          const usersRef = collection(db, USERS_COLLECTION)
          const q = query(usersRef, where('email', '==', data.email.toLowerCase().trim()))
          const snap = await getDocs(q)
          if (!snap.empty) {
            uid = snap.docs[0].id
          } else {
            // Document missing, search by email hash/string or generate custom doc ID linked to email
            uid = `user_${data.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
          }
        } else {
          throw err
        }
      }
    } else {
      uid = `user_${Date.now()}`
    }

    await this.saveUserProfile(
      {
        uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        assignedOrder: data.assignedOrder,
        permissions: data.permissions
      },
      performedBy
    )
  },

  /**
   * Creates or updates a user profile in Firestore.
   */
  async saveUserProfile(
    profileData: { uid: string; email: string; displayName?: string; role: UserRole; assignedOrder?: OrderGroup; permissions?: Partial<UserPermissions> },
    performedBy = 'System'
  ): Promise<void> {
    const userDocRef = doc(db, USERS_COLLECTION, profileData.uid)
    const existingSnap = await getDoc(userDocRef)

    const payload = {
      uid: profileData.uid,
      email: profileData.email.toLowerCase().trim(),
      displayName: profileData.displayName?.trim() || '',
      role: profileData.role,
      assignedOrder: profileData.assignedOrder || '',
      permissions: profileData.permissions || null,
      updatedAt: serverTimestamp(),
      ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() })
    }

    await setDoc(userDocRef, payload, { merge: true })

    // Ensure any legacy or duplicate user documents with the same email are synchronized
    try {
      const normalizedEmail = (profileData.email || '').toLowerCase().trim()
      const usersRef = collection(db, USERS_COLLECTION)
      const q = query(usersRef, where('email', '==', normalizedEmail))
      const snap = await getDocs(q)
      if (!snap.empty) {
        for (const otherDoc of snap.docs) {
          if (otherDoc.id !== profileData.uid) {
            // Update legacy/duplicate doc to match latest assignedOrder and permissions
            try {
              await updateDoc(doc(db, USERS_COLLECTION, otherDoc.id), {
                assignedOrder: profileData.assignedOrder || '',
                permissions: profileData.permissions || null,
                updatedAt: serverTimestamp()
              })
            } catch (innerErr) {
              console.warn('Failed to sync duplicate user doc:', otherDoc.id, innerErr)
            }
          }
        }
      }
    } catch (syncErr) {
      console.warn('Error while syncing duplicate user documents by email:', syncErr)
    }

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
   * Sends a password reset email to a user.
   */
  async sendPasswordReset(email: string, performedBy = 'System'): Promise<void> {
    await authService.sendPasswordReset(email, performedBy)
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
