import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { UserProfile } from '@/types/auth'
import { auth } from '@/firebase/config'
import { authService } from './authService'
import { scheduleService } from './scheduleService'
import { memberService } from './memberService'
import { isUserMatchedWithServer } from './notificationService'
import { formatTime12Hour } from '@/utils/scheduleUtils'
import { getFullName } from '@/utils/member'

interface WidgetBridgePluginType {
  updateWidgetData(options: { widgetJson: string }): Promise<{ success: boolean }>
}

const WidgetBridge = registerPlugin<WidgetBridgePluginType>('WidgetBridge')

export interface FormattedWidgetMassItem {
  badge: string
  title: string
  servers: string
  date: string
  startTime: string
  isUserAssigned: boolean
}

export interface WidgetUserDuty {
  isAssigned: boolean
  dutyText: string
  time: string
  title: string
  isToday: boolean
}

export const nativeWidgetService = {
  /**
   * Syncs Today's and Tomorrow's masses to the native Android Home Screen widget.
   */
  async syncUpcomingMassesWidget(
    providedSchedules?: Schedule[],
    providedMembers?: Member[],
    providedProfile?: UserProfile | null
  ): Promise<void> {
    try {
      const now = new Date()
      const formatYMD = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      const todayStr = formatYMD(now)
      const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      const tomorrowStr = formatYMD(tomorrowDate)

      const normalizeDateStr = (dateStr?: string): string => {
        if (!dateStr) return ''
        const trimmed = dateStr.trim()
        if (trimmed.includes('T')) {
          return trimmed.split('T')[0]
        }
        const parts = trimmed.split(/[-/]/)
        if (parts.length === 3) {
          const year = parts[0].length === 4 ? parts[0] : parts[2]
          const month = (parts[0].length === 4 ? parts[1] : parts[0]).padStart(2, '0')
          const day = (parts[0].length === 4 ? parts[2] : parts[1]).padStart(2, '0')
          return `${year}-${month}-${day}`
        }
        return trimmed
      }

      // 1. Fetch schedules if not provided
      let schedules = providedSchedules
      if (!schedules || schedules.length === 0) {
        schedules = await scheduleService.getSchedules()
      }

      // 2. Fetch members map if not provided
      let members = providedMembers
      if (!members || members.length === 0) {
        try {
          members = await memberService.getMembers(true)
        } catch {
          members = []
        }
      }

      const memberMap = new Map<string, Member>()
      members.forEach((m) => memberMap.set(m.id, m))

      // 3. Resolve current user profile
      let profile = providedProfile
      if (profile === undefined || profile === null) {
        try {
          const rawProfile = localStorage.getItem('mats_current_profile')
          if (rawProfile) {
            profile = JSON.parse(rawProfile) as UserProfile
          }
        } catch {
          profile = null
        }
      }

      // If still missing and currentUser is logged in, fetch from authService
      if (!profile && auth.currentUser) {
        try {
          profile = await authService.getUserProfile(auth.currentUser.uid, auth.currentUser.email)
          if (profile) {
            try {
              localStorage.setItem('mats_current_profile', JSON.stringify(profile))
            } catch {}
          }
        } catch {
          // Fallback minimal profile from auth.currentUser
          if (auth.currentUser) {
            profile = {
              uid: auth.currentUser.uid,
              email: auth.currentUser.email || '',
              displayName: auth.currentUser.displayName || '',
              role: 'user'
            }
          }
        }
      }

      // 4. Resolve all candidate identifiers for current user
      const candidateEmails = new Set<string>()
      const candidateNames = new Set<string>()
      const candidateAlphaNames = new Set<string>()
      const matchedMemberIds = new Set<string>()

      const addCandidateName = (str?: string) => {
        if (!str) return
        const clean = str.toLowerCase().trim()
        if (!clean) return
        candidateNames.add(clean)
        const alphaOnly = clean.replace(/[^a-z0-9]/g, '')
        if (alphaOnly.length >= 2) {
          candidateAlphaNames.add(alphaOnly)
        }
        // Split by whitespace
        clean.split(/\s+/).forEach((w) => {
          if (w.length >= 2) {
            candidateNames.add(w)
            candidateAlphaNames.add(w.replace(/[^a-z0-9]/g, ''))
          }
        })
      }

      if (profile?.memberId) {
        matchedMemberIds.add(String(profile.memberId).trim())
        matchedMemberIds.add(String(profile.memberId).toLowerCase().trim())
      }
      if (profile?.uid) {
        matchedMemberIds.add(String(profile.uid).trim())
        matchedMemberIds.add(String(profile.uid).toLowerCase().trim())
      }
      if (auth.currentUser?.uid) {
        matchedMemberIds.add(String(auth.currentUser.uid).trim())
        matchedMemberIds.add(String(auth.currentUser.uid).toLowerCase().trim())
      }

      if (profile?.email) {
        candidateEmails.add(profile.email.toLowerCase().trim())
      }
      if (auth.currentUser?.email) {
        candidateEmails.add(auth.currentUser.email.toLowerCase().trim())
      }

      addCandidateName(profile?.memberName)
      addCandidateName(profile?.displayName)
      addCandidateName(auth.currentUser?.displayName || '')

      // Check email prefixes (e.g., 'kyle' from 'kyle@mas.com')
      candidateEmails.forEach((em) => {
        const prefix = em.split('@')[0]
        if (prefix && prefix.length >= 2) {
          addCandidateName(prefix)
        }
      })

      // Match against members records
      members.forEach((m) => {
        if (m.email && candidateEmails.has(m.email.toLowerCase().trim())) {
          matchedMemberIds.add(m.id)
        }
        const fullName = getFullName(m).toLowerCase().trim()
        const first = (m.firstName || '').toLowerCase().trim()
        const last = (m.lastName || '').toLowerCase().trim()
        const nick = (m.nickname || '').toLowerCase().trim()
        const mFullAlpha = fullName.replace(/[^a-z0-9]/g, '')
        const mNickAlpha = nick.replace(/[^a-z0-9]/g, '')
        const mFirstAlpha = first.replace(/[^a-z0-9]/g, '')

        candidateNames.forEach((name) => {
          if (!name) return
          if (
            fullName === name ||
            nick === name ||
            first === name ||
            last === name ||
            `${first} ${last}` === name ||
            `${last} ${first}` === name ||
            (fullName && name.length >= 3 && fullName.includes(name)) ||
            (nick && name.length >= 3 && nick.includes(name))
          ) {
            matchedMemberIds.add(m.id)
          }
        })

        candidateAlphaNames.forEach((alpha) => {
          if (!alpha) return
          if (
            mFullAlpha === alpha ||
            mNickAlpha === alpha ||
            mFirstAlpha === alpha ||
            (mFullAlpha.length >= 4 && (mFullAlpha.includes(alpha) || alpha.includes(mFullAlpha)))
          ) {
            matchedMemberIds.add(m.id)
          }
        })
      })

      // Helper to determine if a schedule belongs to the current user
      const isScheduleAssignedToUser = (sch: Schedule): boolean => {
        const assignedList = sch.assignedMembers || []
        if (assignedList.length === 0) return false

        // 1. Direct candidate ID match
        if (assignedList.some((id) => matchedMemberIds.has(id) || matchedMemberIds.has(String(id).toLowerCase().trim()))) {
          return true
        }

        // 2. Comprehensive notificationService matching
        if (profile) {
          const isMatched = assignedList.some((mId) => {
            const memberObj = memberMap.get(mId)
            return isUserMatchedWithServer(profile!, memberObj, mId)
          })
          if (isMatched) return true

          // 3. Order group matching: If user is an Order Leader / Order Member
          if (profile.assignedOrder) {
            const cleanOrder = profile.assignedOrder.toLowerCase().trim()
            const hasOrderMembers = assignedList.some((mId) => {
              const memberObj = memberMap.get(mId)
              return memberObj?.order && memberObj.order.toLowerCase().trim() === cleanOrder
            })
            if (hasOrderMembers) return true
          }
        }

        // 4. Candidate name match against assigned member objects and raw string IDs
        const hasNameMatch = assignedList.some((mId) => {
          const cleanMid = String(mId).toLowerCase().trim()
          const cleanMidAlpha = cleanMid.replace(/[^a-z0-9]/g, '')

          if (candidateNames.has(cleanMid) || candidateAlphaNames.has(cleanMidAlpha)) {
            return true
          }

          const memberObj = memberMap.get(mId)
          if (!memberObj) return false
          const mFull = getFullName(memberObj).toLowerCase().trim()
          const mNick = (memberObj.nickname || '').toLowerCase().trim()
          const mFirst = (memberObj.firstName || '').toLowerCase().trim()
          const mFullAlpha = mFull.replace(/[^a-z0-9]/g, '')
          const mNickAlpha = mNick.replace(/[^a-z0-9]/g, '')
          const mFirstAlpha = mFirst.replace(/[^a-z0-9]/g, '')

          for (const cand of Array.from(candidateNames)) {
            if (!cand || cand.length < 2) continue
            if (mFull === cand || mNick === cand || mFirst === cand || mFull.includes(cand)) {
              return true
            }
          }

          for (const candAlpha of Array.from(candidateAlphaNames)) {
            if (!candAlpha || candAlpha.length < 3) continue
            if (mFullAlpha === candAlpha || mNickAlpha === candAlpha || mFirstAlpha === candAlpha || mFullAlpha.includes(candAlpha)) {
              return true
            }
          }

          return false
        })

        return hasNameMatch
      }

      // 5. Filter schedules for today and tomorrow
      const matching = (schedules || []).filter((s) => {
        const sDate = normalizeDateStr(s.date)
        return (sDate === todayStr || sDate === tomorrowStr) && s.status !== 'cancelled'
      })

      // 6. Sort chronologically
      matching.sort((a, b) => {
        const dateA = normalizeDateStr(a.date)
        const dateB = normalizeDateStr(b.date)
        const dateComp = dateA.localeCompare(dateB)
        if (dateComp !== 0) return dateComp
        return (a.startTime || '').localeCompare(b.startTime || '')
      })

      // 7. Format upcoming items for scrollable widget display
      const items: FormattedWidgetMassItem[] = matching.slice(0, 20).map((sch) => {
        const sDate = normalizeDateStr(sch.date)
        const isToday = sDate === todayStr
        const timeFormatted = formatTime12Hour(sch.startTime)
        const badge = isToday ? `TODAY • ${timeFormatted}` : `TOMORROW • ${timeFormatted}`

        const isUserAssigned = isScheduleAssignedToUser(sch)

        // Resolve assigned servers
        let serverText = 'No servers assigned'
        if (sch.assignedMembers && sch.assignedMembers.length > 0) {
          const assignedNames: string[] = []
          const orderSet = new Set<string>()

          sch.assignedMembers.forEach((id) => {
            const m = memberMap.get(id)
            if (m) {
              assignedNames.push(m.nickname || m.firstName || getFullName(m))
              if (m.order) {
                orderSet.add(m.order)
              }
            } else if (typeof id === 'string' && id.length > 0) {
              assignedNames.push(id)
            }
          })

          if (orderSet.size === 1) {
            const singleOrder = Array.from(orderSet)[0]
            serverText = `${singleOrder} (${assignedNames.slice(0, 3).join(', ')}${assignedNames.length > 3 ? '...' : ''})`
          } else if (assignedNames.length > 0) {
            serverText = `Assigned: ${assignedNames.slice(0, 3).join(', ')}${assignedNames.length > 3 ? ` +${assignedNames.length - 3}` : ''}`
          }
        }

        return {
          badge,
          title: sch.title || 'Mass Schedule',
          servers: serverText,
          date: sch.date,
          startTime: sch.startTime,
          isUserAssigned
        }
      })

      // 8. Compute user personal upcoming schedule
      let userDuty: WidgetUserDuty | null = null
      const userAssignedSchedules = (schedules || []).filter((s) => {
        const sDate = normalizeDateStr(s.date)
        return (sDate === todayStr || sDate === tomorrowStr) &&
               s.status !== 'cancelled' &&
               isScheduleAssignedToUser(s)
      })

      userAssignedSchedules.sort((a, b) => {
        const dateA = normalizeDateStr(a.date)
        const dateB = normalizeDateStr(b.date)
        const dateComp = dateA.localeCompare(dateB)
        if (dateComp !== 0) return dateComp
        return (a.startTime || '').localeCompare(b.startTime || '')
      })

      if (userAssignedSchedules.length > 0) {
        const firstDuty = userAssignedSchedules[0]
        const sDate = (firstDuty.date || '').trim().slice(0, 10)
        const isToday = sDate === todayStr
        const formattedTime = formatTime12Hour(firstDuty.startTime)
        const dutyText = isToday
          ? `Your Schedule: Today at ${formattedTime}`
          : `Your Schedule: Tomorrow at ${formattedTime}`

        userDuty = {
          isAssigned: true,
          dutyText,
          time: formattedTime,
          title: firstDuty.title || 'Mass Schedule',
          isToday
        }
      } else {
        userDuty = {
          isAssigned: false,
          dutyText: 'No assigned schedule today or tomorrow',
          time: '',
          title: '',
          isToday: false
        }
      }

      const lastUpdatedStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      const payload = {
        lastUpdated: lastUpdatedStr,
        userDuty,
        items
      }

      // Always save to localStorage for offline cache
      try {
        localStorage.setItem('mats_native_widget_cache', JSON.stringify(payload))
      } catch {
        // Ignore storage error
      }

      // 9. Push to native Android AppWidget if running on native device
      if (Capacitor.isNativePlatform()) {
        await WidgetBridge.updateWidgetData({
          widgetJson: JSON.stringify(payload)
        })
      }
    } catch (err) {
      console.warn('Native widget sync warning:', err)
    }
  }
}
