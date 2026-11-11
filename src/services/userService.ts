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
  serverTimestamp 
} from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { db, firebaseConfig } from '@/firebase/config'
import type { UserProfile, UserRole, UserPermissions } from '@/types/auth'
import type { OrderGroup } from '@/types/member'
import { auditService } from '@/services/auditService'
import { authService } from '@/services/authService'
import { memberService } from '@/services/memberService'
import { getFullName, getFirstNameFirst, normalizeName } from '@/utils/member'

const USERS_COLLECTION = 'users'

function parseTimestampMillis(ts: any): number {
  if (!ts) return 0
  if (typeof ts === 'number') return ts
  if (typeof ts.toMillis === 'function') return ts.toMillis()
  if (typeof ts.toDate === 'function') return ts.toDate().getTime()
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

export const userService = {
  /**
   * Fetches all registered user profiles from Firestore.
   * Automatically deduplicates any legacy duplicate records sharing the same email.
   */
  async getUsers(): Promise<UserProfile[]> {
    const usersRef = collection(db, USERS_COLLECTION)
    const snapshot = await getDocs(usersRef)
    const rawUsers = snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    })) as UserProfile[]

    const emailToUserMap = new Map<string, UserProfile>()
    const duplicateDocIdsToDelete: string[] = []

    for (const u of rawUsers) {
      const emailKey = (u.email || '').toLowerCase().trim()
      if (!emailKey) {
        emailToUserMap.set(u.uid, u)
        continue
      }

      if (!emailToUserMap.has(emailKey)) {
        emailToUserMap.set(emailKey, u)
      } else {
        const existing = emailToUserMap.get(emailKey)!
        // Prefer real Auth UID (non-user_ prefix) over synthetic UID
        const existingIsSynthetic = existing.uid.startsWith('user_')
        const newIsSynthetic = u.uid.startsWith('user_')

        let canonical: UserProfile = existing
        let redundant: UserProfile = u

        if (existingIsSynthetic && !newIsSynthetic) {
          canonical = u
          redundant = existing
        } else if (!existingIsSynthetic && newIsSynthetic) {
          canonical = existing
          redundant = u
        } else if (!existing.memberId && u.memberId) {
          canonical = u
          redundant = existing
        } else {
          // Compare updatedAt or createdAt timestamps
          const timeExisting = parseTimestampMillis(existing.updatedAt) || parseTimestampMillis(existing.createdAt)
          const timeNew = parseTimestampMillis(u.updatedAt) || parseTimestampMillis(u.createdAt)
          if (timeNew >= timeExisting) {
            canonical = u
            redundant = existing
          }
        }

        // Merge linked member info if missing on canonical
        if (!canonical.memberId && redundant.memberId) {
          canonical.memberId = redundant.memberId
          canonical.memberName = redundant.memberName
        }
        if (!canonical.assignedOrder && redundant.assignedOrder) {
          canonical.assignedOrder = redundant.assignedOrder
        }
        if (!canonical.permissions && redundant.permissions) {
          canonical.permissions = redundant.permissions
        }

        emailToUserMap.set(emailKey, canonical)
        duplicateDocIdsToDelete.push(redundant.uid)
      }
    }

    // Background cleanup of redundant duplicate documents in Firestore
    if (duplicateDocIdsToDelete.length > 0) {
      Promise.all(
        duplicateDocIdsToDelete.map(dupId => deleteDoc(doc(db, USERS_COLLECTION, dupId)).catch(e => console.warn('Clean dup err:', e)))
      ).catch(() => {})
    }

    const uniqueUsers = Array.from(emailToUserMap.values())
    return uniqueUsers.sort((a, b) => {
      const timeA = parseTimestampMillis(a.createdAt)
      const timeB = parseTimestampMillis(b.createdAt)
      if (timeB !== timeA) return timeB - timeA
      return (a.email || '').localeCompare(b.email || '')
    })
  },

  /**
   * Registers a new authentication user in Firebase Auth with password AND saves their profile in Firestore.
   * Uses a secondary app instance so the active admin session is NOT logged out.
   */
  async registerNewUserWithAuth(
    data: { 
      email: string
      password?: string
      displayName?: string
      role: UserRole
      assignedOrder?: OrderGroup
      memberId?: string
      memberName?: string
      permissions?: Partial<UserPermissions> 
    },
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
        memberId: data.memberId,
        memberName: data.memberName,
        permissions: data.permissions
      },
      performedBy
    )
  },

  /**
   * Creates or updates a user profile in Firestore.
   */
  async saveUserProfile(
    profileData: { 
      uid: string
      email: string
      displayName?: string
      role: UserRole
      assignedOrder?: OrderGroup
      memberId?: string
      memberName?: string
      permissions?: Partial<UserPermissions> 
    },
    performedBy = 'System'
  ): Promise<void> {
    const userDocRef = doc(db, USERS_COLLECTION, profileData.uid)
    const existingSnap = await getDoc(userDocRef)

    let effectiveMemberId = profileData.memberId || ''
    let effectiveMemberName = profileData.memberName || ''
    let effectiveOrder = profileData.assignedOrder || ''

    if (!effectiveMemberId) {
      try {
        const allMembers = await memberService.getMembers(true)
        const userEmail = (profileData.email || '').toLowerCase().trim()
        const userDisplay = (profileData.displayName || '').trim()

        let matched = allMembers.find(m => m.email && m.email.toLowerCase().trim() === userEmail)
        if (!matched && userDisplay) {
          const normDisplay = normalizeName(userDisplay)
          matched = allMembers.find(m => {
            const fullName1 = normalizeName(`${m.firstName} ${m.lastName}`)
            const fullName2 = normalizeName(`${m.lastName} ${m.firstName}`)
            return normDisplay === fullName1 || normDisplay === fullName2
          })
        }

        if (matched) {
          effectiveMemberId = matched.id
          effectiveMemberName = getFullName(matched)
          if (!effectiveOrder && matched.order) {
            effectiveOrder = matched.order
          }
        }
      } catch (linkErr) {
        console.warn('Auto-link during saveUserProfile fallback error:', linkErr)
      }
    }

    const payload = {
      uid: profileData.uid,
      email: profileData.email.toLowerCase().trim(),
      displayName: profileData.displayName?.trim() || '',
      role: profileData.role,
      assignedOrder: effectiveOrder,
      memberId: effectiveMemberId,
      memberName: effectiveMemberName,
      permissions: profileData.permissions || null,
      updatedAt: serverTimestamp(),
      ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() })
    }

    await setDoc(userDocRef, payload, { merge: true })

    // Ensure any legacy or duplicate user documents with the same email are cleaned up
    try {
      const normalizedEmail = (profileData.email || '').toLowerCase().trim()
      const usersRef = collection(db, USERS_COLLECTION)
      const q = query(usersRef, where('email', '==', normalizedEmail))
      const snap = await getDocs(q)
      if (!snap.empty) {
        for (const otherDoc of snap.docs) {
          if (otherDoc.id !== profileData.uid) {
            // Delete redundant duplicate document with the same email
            try {
              await deleteDoc(doc(db, USERS_COLLECTION, otherDoc.id))
            } catch (innerErr) {
              console.warn('Failed to delete duplicate user doc:', otherDoc.id, innerErr)
            }
          }
        }
      }
    } catch (syncErr) {
      console.warn('Error while cleaning up duplicate user documents by email:', syncErr)
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

    // Also delete any other duplicate docs with the same email
    try {
      if (email) {
        const usersRef = collection(db, USERS_COLLECTION)
        const q = query(usersRef, where('email', '==', email.toLowerCase().trim()))
        const snap = await getDocs(q)
        for (const d of snap.docs) {
          if (d.id !== uid) {
            await deleteDoc(doc(db, USERS_COLLECTION, d.id)).catch(() => {})
          }
        }
      }
    } catch (err) {
      console.warn('Error cleaning up remaining email docs on delete:', err)
    }

    await auditService.logAction(
      'SYSTEM_USER_DELETE' as any,
      'system',
      `Removed user account profile '${email}'`,
      performedBy,
      { uid, email }
    )
  },

  /**
   * Scans all user accounts in Firestore, identifies accounts with missing memberId,
   * matches them against altar server profiles via email and full name, and batch updates them.
   */
  async autoLinkAllUnlinkedUsers(performedBy = 'System'): Promise<{
    matchedCount: number
    totalUnlinked: number
    linkedUsers: { email: string; memberName: string; memberId: string }[]
  }> {
    const [allUsers, allMembers] = await Promise.all([
      this.getUsers(),
      memberService.getMembers(true)
    ])

    const unlinkedUsers = allUsers.filter(u => !u.memberId || u.memberId.trim() === '')
    const totalUnlinked = unlinkedUsers.length
    const linkedUsers: { email: string; memberName: string; memberId: string }[] = []

    if (totalUnlinked === 0 || allMembers.length === 0) {
      return { matchedCount: 0, totalUnlinked, linkedUsers: [] }
    }

    // Build lookup maps for fast and accurate matching
    const memberByEmail = new Map<string, typeof allMembers[0]>()
    allMembers.forEach(m => {
      if (m.email && m.email.trim().length > 0) {
        memberByEmail.set(m.email.trim().toLowerCase(), m)
      }
    })

    for (const u of unlinkedUsers) {
      const userEmail = (u.email || '').trim().toLowerCase()
      const userDisplay = (u.displayName || u.memberName || '').trim()

      let matchedMember: typeof allMembers[0] | undefined

      // Tier 1: Exact Email Match
      if (userEmail && memberByEmail.has(userEmail)) {
        matchedMember = memberByEmail.get(userEmail)
      }

      // Tier 2: Display / Full Name Match
      if (!matchedMember && userDisplay) {
        const normUserDisplay = normalizeName(userDisplay)

        matchedMember = allMembers.find(m => {
          const fn = (m.firstName || '').trim()
          const ln = (m.lastName || '').trim()
          const fullName1 = normalizeName(`${fn} ${ln}`)
          const fullName2 = normalizeName(`${ln} ${fn}`)
          const fullName3 = normalizeName(getFullName(m, false))
          const fullName4 = normalizeName(getFirstNameFirst(m, false))
          const nick = (m.nickname || '').trim().toLowerCase()

          return (
            normUserDisplay === fullName1 ||
            normUserDisplay === fullName2 ||
            normUserDisplay === fullName3 ||
            normUserDisplay === fullName4 ||
            (nick.length > 2 && normUserDisplay.includes(nick) && normUserDisplay.includes(ln.toLowerCase()))
          )
        })
      }

      // If matched, update user document in Firestore
      if (matchedMember) {
        const fullMemberName = getFullName(matchedMember)
        const updatePayload: Record<string, any> = {
          memberId: matchedMember.id,
          memberName: fullMemberName,
          updatedAt: serverTimestamp()
        }

        // Auto-assign order if user has none and member belongs to an order
        if (!u.assignedOrder && matchedMember.order) {
          updatePayload.assignedOrder = matchedMember.order
        }

        try {
          const userDocRef = doc(db, USERS_COLLECTION, u.uid)
          await updateDoc(userDocRef, updatePayload)

          linkedUsers.push({
            email: u.email,
            memberName: fullMemberName,
            memberId: matchedMember.id
          })
        } catch (err) {
          console.warn(`Failed to auto-link user ${u.email}:`, err)
        }
      }
    }

    if (linkedUsers.length > 0) {
      await auditService.logAction(
        'SYSTEM_USER_UPDATE' as any,
        'system',
        `Auto-linked ${linkedUsers.length} user accounts to member profiles`,
        performedBy,
        { linkedCount: linkedUsers.length, totalUnlinked }
      )
    }

    return {
      matchedCount: linkedUsers.length,
      totalUnlinked,
      linkedUsers
    }
  }
}
