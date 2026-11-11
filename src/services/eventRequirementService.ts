import { addDoc, collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import { MEMBER_RANKS, type MemberRank } from '@/types/member'
import type { EventRequirement, EventRequirementCheck, EventRequirementSettings, RequirementInput } from '@/types/eventRequirement'

const SETTINGS = 'eventRequirementSettings'
const REQUIREMENTS = 'eventRequirements'
const CHECKS = 'eventRequirementChecks'

function validateRanks(ranks: MemberRank[]) {
  if (new Set(ranks).size !== ranks.length || ranks.some(rank => !MEMBER_RANKS.includes(rank))) {
    throw new Error('Select valid, unique member ranks.')
  }
}

function validateInput(input: RequirementInput) {
  validateRanks(input.targetRanks)
  if (!input.title.trim() || input.title.trim().length > 150 || input.description.length > 2000) {
    throw new Error('Enter a title up to 150 characters and description up to 2000 characters.')
  }
  return { ...input, title: input.title.trim(), description: input.description.trim() }
}

async function log(eventId: string, message: string, actorName: string, details: Record<string, unknown>) {
  await auditService.logAction('EVENT_UPDATE', 'events', message, actorName, { eventId, ...details })
}

export const eventRequirementService = {
  async getTracker(eventId: string) {
    const [settings, requirements, checks] = await Promise.all([
      getDoc(doc(db, SETTINGS, eventId)),
      getDocs(query(collection(db, REQUIREMENTS), where('eventId', '==', eventId))),
      getDocs(query(collection(db, CHECKS), where('eventId', '==', eventId)))
    ])
    return {
      settings: settings.exists() ? settings.data() as EventRequirementSettings : null,
      requirements: requirements.docs.map(d => ({ ...d.data(), id: d.id }) as EventRequirement)
        .filter(r => !r.isArchived).sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0) || a.id.localeCompare(b.id)),
      checks: checks.docs.map(d => ({ ...d.data(), id: d.id }) as EventRequirementCheck)
    }
  },

  async saveSettings(eventId: string, selectedRanks: MemberRank[], actorUid: string, actorName: string) {
    validateRanks(selectedRanks)
    if (!selectedRanks.length) throw new Error('Select at least one tracker rank.')
    await setDoc(doc(db, SETTINGS, eventId), { eventId, selectedRanks, updatedByUid: actorUid, updatedAt: serverTimestamp() })
    await log(eventId, 'Updated requirements tracker ranks', actorName, { selectedRanks })
  },

  async saveRequirement(eventId: string, input: RequirementInput, actorUid: string, actorName: string, id?: string) {
    const payload = validateInput(input)
    if (id) {
      await updateDoc(doc(db, REQUIREMENTS, id), { ...payload, updatedAt: serverTimestamp() })
    } else {
      const created = await addDoc(collection(db, REQUIREMENTS), {
        ...payload, eventId, isArchived: false, createdByUid: actorUid,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      })
      id = created.id
    }
    await log(eventId, `Saved requirement '${payload.title}'`, actorName, { requirementId: id, ...payload })
  },

  async archiveRequirement(eventId: string, requirementId: string, actorName: string) {
    await updateDoc(doc(db, REQUIREMENTS, requirementId), { isArchived: true, updatedAt: serverTimestamp() })
    await log(eventId, 'Archived event requirement', actorName, { requirementId })
  },

  async resetTracker(eventId: string, actorName: string) {
    if (!eventId) throw new Error('Event ID is required.')
    let deletedRequirements = 0
    let deletedChecks = 0
    try {
      // Remove requirements first so in-flight check transactions cannot recreate checks.
      for (const collectionName of [REQUIREMENTS, CHECKS]) {
        const snapshot = await getDocs(query(collection(db, collectionName), where('eventId', '==', eventId)))
        for (let start = 0; start < snapshot.docs.length; start += 500) {
          const batch = writeBatch(db)
          const chunk = snapshot.docs.slice(start, start + 500)
          chunk.forEach(item => batch.delete(item.ref))
          await batch.commit()
          if (collectionName === REQUIREMENTS) deletedRequirements += chunk.length
          else deletedChecks += chunk.length
        }
      }
      // Clear selected ranks last; this removes the roster from this tab only.
      const settingsRef = doc(db, SETTINGS, eventId)
      const settings = await getDoc(settingsRef)
      if (settings.exists()) {
        const batch = writeBatch(db)
        batch.delete(settingsRef)
        await batch.commit()
      }
      await log(eventId, 'Reset event requirements tracker', actorName, { deletedRequirements, deletedChecks })
    } catch (error) {
      await log(eventId, 'Event requirements reset failed', actorName, { deletedRequirements, deletedChecks })
      const reason = error instanceof Error ? error.message : 'Could not reset requirements.'
      throw new Error(`Reset was not completed. ${reason} Refresh and retry to remove any remaining items.`)
    }
  },

  async setCompleted(eventId: string, requirementId: string, memberId: string, completed: boolean, actorUid: string, actorName: string) {
    await runTransaction(db, async transaction => {
      const [requirement, member, settings] = await Promise.all([
        transaction.get(doc(db, REQUIREMENTS, requirementId)),
        transaction.get(doc(db, 'members', memberId)),
        transaction.get(doc(db, SETTINGS, eventId))
      ])
      const r = requirement.data() as EventRequirement | undefined
      const m = member.data()
      const ranks = settings.data()?.selectedRanks as MemberRank[] | undefined
      if (!r || r.eventId !== eventId || r.isArchived || !m || m.status === 'archived' || !ranks?.includes(m.rank) || (r.targetRanks.length && !r.targetRanks.includes(m.rank))) {
        throw new Error('This requirement is no longer applicable. Refresh the tracker.')
      }
      transaction.set(doc(db, CHECKS, `${requirementId}_${memberId}`), {
        eventId, requirementId, memberId, completed, updatedByUid: actorUid, updatedAt: serverTimestamp()
      })
    })
    await log(eventId, `Marked requirement ${completed ? 'Done' : 'Pending'}`, actorName, { requirementId, memberId, completed })
  }
}
