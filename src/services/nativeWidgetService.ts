import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { UserProfile } from '@/types/auth'
import { auth } from '@/firebase/config'
import { authService } from './authService'
import { scheduleService } from './scheduleService'
import { memberService } from './memberService'
import { formatTime12Hour } from '@/utils/scheduleUtils'
import { getFullName, getFirstNameFirst, normalizeName } from '@/utils/member'

interface WidgetBridgePluginType {
  updateWidgetData(options: { widgetJson: string }): Promise<{ success: boolean }>
}

const WidgetBridge = registerPlugin<WidgetBridgePluginType>('WidgetBridge')
let latestSyncRequest = 0

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
    const requestId = ++latestSyncRequest
    const currentUser = auth.currentUser
    const currentUid = currentUser?.uid ?? null
    const isCurrentSync = () =>
      requestId === latestSyncRequest && (auth.currentUser?.uid ?? null) === currentUid

    try {
      const now = new Date()
      // Clear personal duty without requiring network access during logout.
      if (providedProfile === null) {
        let items: FormattedWidgetMassItem[] = []
        try {
          const cached = JSON.parse(localStorage.getItem('mats_native_widget_cache') || '{}')
          if (Array.isArray(cached.items)) {
            items = cached.items.map((item: FormattedWidgetMassItem) => ({ ...item, isUserAssigned: false }))
          }
        } catch {}
        const widgetJson = JSON.stringify({
          lastUpdated: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          userDuty: { isAssigned: false, dutyText: 'No assigned schedule today or tomorrow', time: '', title: '', isToday: false },
          items
        })
        if (!isCurrentSync()) return
        try {
          localStorage.setItem('mats_native_widget_cache', widgetJson)
        } catch {}
        if (Capacitor.isNativePlatform()) {
          await WidgetBridge.updateWidgetData({ widgetJson })
        }
        return
      }
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

      // 2. Fetch members map if not provided (always include archived for accurate historical lookups)
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

      // 3. Resolve only the authenticated account's profile. Explicit null clears identity.
      let profile: UserProfile | null = providedProfile ?? null
      if (providedProfile === undefined && currentUser) {
        try {
          const rawProfile = localStorage.getItem('mats_current_profile')
          const cachedProfile = rawProfile ? JSON.parse(rawProfile) as UserProfile : null
          if (cachedProfile?.uid === currentUid) {
            profile = cachedProfile
          }
        } catch {
          profile = null
        }

        if (!profile) {
          try {
            profile = await authService.getUserProfile(currentUser.uid, currentUser.email)
          } catch {
            profile = null
          }
        }
      }

      if (!currentUid || profile?.uid !== currentUid) {
        profile = null
      }

      // 4. Resolve exact linked member ID with robust multi-tier fallback (email & name match)
      let resolvedMemberId = profile?.memberId || ''
      if (!resolvedMemberId && (profile || currentUser) && members.length > 0) {
        const userEmail = (profile?.email || currentUser?.email || '').trim().toLowerCase()
        const userDisplay = (profile?.displayName || profile?.memberName || currentUser?.displayName || '').trim()

        if (userEmail) {
          const byEmail = members.find(m => m.email && m.email.trim().toLowerCase() === userEmail)
          if (byEmail) resolvedMemberId = byEmail.id
        }

        if (!resolvedMemberId && userDisplay) {
          const normUserDisplay = normalizeName(userDisplay)
          const byName = members.find(m => {
            const fn = (m.firstName || '').trim()
            const ln = (m.lastName || '').trim()
            return (
              normUserDisplay === normalizeName(`${fn} ${ln}`) ||
              normUserDisplay === normalizeName(`${ln} ${fn}`) ||
              normUserDisplay === normalizeName(getFullName(m, false)) ||
              normUserDisplay === normalizeName(getFirstNameFirst(m, false))
            )
          })
          if (byName) resolvedMemberId = byName.id
        }
      }

      const isScheduleAssignedToUser = (sch: Schedule): boolean => {
        if (!resolvedMemberId) return false
        return Boolean(sch.assignedMembers && sch.assignedMembers.includes(resolvedMemberId))
      }

      // 5. Filter schedules for today and tomorrow for the main widget list
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

        // Resolve assigned servers cleanly without raw hash leaks
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
            } else if (typeof id === 'string' && id.trim().length > 0) {
              if (id.includes(' ') && id.length < 30) {
                assignedNames.push(id)
              } else {
                assignedNames.push('Altar Server')
              }
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

      // 8. Compute user personal upcoming schedule (searches all upcoming duties starting from today)
      let userDuty: WidgetUserDuty | null = null
      const userAssignedSchedules = (schedules || []).filter((s) => {
        const sDate = normalizeDateStr(s.date)
        return sDate >= todayStr &&
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
        const sDate = normalizeDateStr(firstDuty.date)
        const isToday = sDate === todayStr
        const isTomorrow = sDate === tomorrowStr
        const formattedTime = formatTime12Hour(firstDuty.startTime)

        let dutyText = ''
        if (isToday) {
          dutyText = `Your Schedule: Today at ${formattedTime}`
        } else if (isTomorrow) {
          dutyText = `Your Schedule: Tomorrow at ${formattedTime}`
        } else {
          try {
            const [y, m, d] = sDate.split('-').map(Number)
            const dutyDateObj = new Date(y, m - 1, d)
            const dayLabel = dutyDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            dutyText = `Next Duty: ${dayLabel} at ${formattedTime}`
          } catch {
            dutyText = `Next Duty: ${sDate} at ${formattedTime}`
          }
        }

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
          dutyText: 'No upcoming scheduled duties',
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

      // Discard results from an old account or a superseded sync.
      if (!isCurrentSync()) return

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
