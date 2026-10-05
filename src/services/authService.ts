import { 
  signInWithEmailAndPassword, 
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail
} from 'firebase/auth'
import { doc, getDoc, collection, query, where, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import type { UserProfile } from '@/types/auth'
import type { Member } from '@/types/member'
import { getFullName, normalizeName } from '@/utils/member'
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
   * Updates password directly for currently logged-in user (from User Management or profile).
   * Re-authenticates if currentPassword is provided to satisfy Firebase recent login requirements.
   */
  async updateCurrentUserPassword(newPassword: string, currentPassword?: string): Promise<void> {
    const currentUser = auth.currentUser
    if (!currentUser || !currentUser.email) {
      throw new Error('No active user session found. Please log in again.')
    }

    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.')
    }

    if (currentPassword && currentPassword.trim()) {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword.trim())
      await reauthenticateWithCredential(currentUser, credential)
    }

    await updatePassword(currentUser, newPassword)

    await auditService.logAction(
      'USER_PASSWORD_CHANGE',
      'system',
      `User ${currentUser.email} updated their account password.`,
      currentUser.email
    )
  },

  /**
   * Changes the password for the currently logged-in user requiring current password re-auth.
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
   * Sends a password reset email to a specified user.
   */
  async sendPasswordReset(email: string, performedBy = 'System'): Promise<void> {
    if (!email || !email.trim()) {
      throw new Error('Email address is required to send password reset.')
    }

    await sendPasswordResetEmail(auth, email.trim())

    await auditService.logAction(
      'USER_PASSWORD_CHANGE',
      'system',
      `Sent password reset link to '${email.trim()}'`,
      performedBy,
      { email: email.trim() }
    )
  },

  /**
   * Helper to auto-link member identity to a user profile if missing.
   */
  async autoLinkMemberToProfile(profile: UserProfile, uid: string): Promise<UserProfile> {
    if (profile.memberId && profile.memberId.trim().length > 0) {
      return profile
    }

    try {
      const membersRef = collection(db, 'members')
      const snap = await getDocs(membersRef)
      const allMembers = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Member[]

      const userEmail = (profile.email || '').toLowerCase().trim()
      const userDisplay = (profile.displayName || profile.memberName || '').trim()

      let matched = allMembers.find(m => m.email && m.email.toLowerCase().trim() === userEmail)
      if (!matched && userDisplay) {
        const normDisplay = normalizeName(userDisplay)
        matched = allMembers.find(m => {
          const fn = (m.firstName || '').trim()
          const ln = (m.lastName || '').trim()
          const fullName1 = normalizeName(`${fn} ${ln}`)
          const fullName2 = normalizeName(`${ln} ${fn}`)
          return normDisplay === fullName1 || normDisplay === fullName2
        })
      }

      if (matched) {
        const fullMemberName = getFullName(matched)
        const updatePayload: Record<string, any> = {
          memberId: matched.id,
          memberName: fullMemberName,
          updatedAt: serverTimestamp()
        }
        if (!profile.assignedOrder && matched.order) {
          updatePayload.assignedOrder = matched.order
          profile.assignedOrder = matched.order as any
        }
        profile.memberId = matched.id
        profile.memberName = fullMemberName

        await setDoc(doc(db, 'users', uid), updatePayload, { merge: true })
      }
    } catch (err) {
      console.warn('Real-time auto-link profile error:', err)
    }

    return profile
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
        const profileData = userDoc.data() as UserProfile
        return await this.autoLinkMemberToProfile(profileData, uid)
      }

      // Fallback: search by email if no doc found at auth UID
      if (email) {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('email', '==', email.toLowerCase().trim()))
        const snap = await getDocs(q)
        if (!snap.empty) {
          const oldDoc = snap.docs[0]
          const profileData = oldDoc.data() as UserProfile
          // Auto-fix: re-save profile under the correct Auth UID
          try {
            await setDoc(doc(db, 'users', uid), {
              ...profileData,
              uid,
              updatedAt: serverTimestamp()
            }, { merge: true })

            // Clean up the legacy/duplicate document if its ID is different from UID
            if (oldDoc.id !== uid) {
              await deleteDoc(doc(db, 'users', oldDoc.id)).catch(delErr => console.warn('Could not delete legacy user doc:', delErr))
            }
          } catch (fixErr) {
            console.warn('Could not auto-fix UID mismatch:', fixErr)
          }
          return await this.autoLinkMemberToProfile({ ...profileData, uid }, uid)
        }
      }
    } catch (err) {
      console.warn('Could not fetch user profile from Firestore:', err)
    }

    return null
  }
}
