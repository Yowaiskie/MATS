import type { SchedulePublication } from '../src/types/publication.ts'

export interface MigrationCandidate {
  id: string
  name: string
  status: string
  existingDeadline: string
  proposedDeadlineMs: number
  proposedDeadlineIso: string
  manilaTime: string
}

export interface SkippedPublication {
  id: string
  name: string
  status: string
  reason: 'ALREADY_HAS_MS' | 'NO_DEADLINE'
  existingDeadlineMs?: number | null
}

export interface FlaggedPublication {
  id: string
  name: string
  status: string
  existingDeadline: string
  reason: string
}

export interface MigrationPlan {
  totalEvaluated: number
  toBeMigrated: MigrationCandidate[]
  skippedAlreadyValid: SkippedPublication[]
  skippedNoDeadline: SkippedPublication[]
  flaggedForManualReview: FlaggedPublication[]
  backupProcedure: string
  rollbackProcedure: string
}

export interface MigrationExecutionResult {
  executed: boolean
  dryRun: boolean
  migratedCount: number
  updatedIds: string[]
  errors?: string[]
}

/**
 * Normalizes and parses a deadline string to epoch milliseconds using Asia/Manila (UTC+8) standard.
 */
export function parseLegacyDeadlineToMs(
  deadlineStr?: string | null,
  timeZone = 'Asia/Manila'
): { ms: number | null; iso: string | null; manilaTime: string | null; error?: string } {
  if (!deadlineStr || !deadlineStr.trim()) {
    return { ms: null, iso: null, manilaTime: null, error: 'Empty or missing deadline string' }
  }

  const raw = deadlineStr.trim()

  // 1. Check if string already contains an explicit timezone designator (Z or +/-HH:MM)
  const hasTimezoneOffset = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw)

  let dateObj: Date
  if (hasTimezoneOffset) {
    dateObj = new Date(raw)
  } else {
    // Standardize datetime format: replace space with 'T'
    let normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
    
    // If date only (YYYY-MM-DD), set to end of day in Manila (23:59:59.999)
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      normalized = `${normalized}T23:59:59.999`
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
      // YYYY-MM-DDTHH:MM
      normalized = `${normalized}:00`
    }

    // Explicitly anchor to Asia/Manila (+08:00)
    const withManilaOffset = `${normalized}+08:00`
    dateObj = new Date(withManilaOffset)
  }

  const ms = dateObj.getTime()
  if (isNaN(ms)) {
    return { ms: null, iso: null, manilaTime: null, error: `Invalid date format: "${deadlineStr}"` }
  }

  const iso = dateObj.toISOString()
  let manilaTime = ''
  try {
    manilaTime = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(dateObj)
  } catch {
    manilaTime = iso
  }

  return { ms, iso, manilaTime }
}

/**
 * Evaluates publications and constructs a dry-run migration plan.
 */
export function planPublicationDeadlinesMigration(
  publications: Array<Partial<SchedulePublication>>,
  options: { parishTimeZone?: string } = {}
): MigrationPlan {
  const parishTimeZone = options.parishTimeZone || 'Asia/Manila'
  const toBeMigrated: MigrationCandidate[] = []
  const skippedAlreadyValid: SkippedPublication[] = []
  const skippedNoDeadline: SkippedPublication[] = []
  const flaggedForManualReview: FlaggedPublication[] = []

  for (const pub of publications) {
    const id = pub.id || 'unknown-id'
    const name = pub.name || 'Untitled Publication'
    const status = pub.status || 'draft'
    const deadlineStr = pub.submissionDeadline

    // Check if valid numeric submissionDeadlineMs already exists
    if (typeof pub.submissionDeadlineMs === 'number' && !isNaN(pub.submissionDeadlineMs)) {
      skippedAlreadyValid.push({
        id,
        name,
        status,
        reason: 'ALREADY_HAS_MS',
        existingDeadlineMs: pub.submissionDeadlineMs
      })
      continue
    }

    // Check if publication has no deadline configured
    if (!deadlineStr || !deadlineStr.trim()) {
      skippedNoDeadline.push({
        id,
        name,
        status,
        reason: 'NO_DEADLINE'
      })
      continue
    }

    // Attempt parsing
    const parsed = parseLegacyDeadlineToMs(deadlineStr, parishTimeZone)
    if (parsed.error || parsed.ms === null || !parsed.iso || !parsed.manilaTime) {
      flaggedForManualReview.push({
        id,
        name,
        status,
        existingDeadline: deadlineStr,
        reason: parsed.error || 'Unknown parsing failure'
      })
      continue
    }

    toBeMigrated.push({
      id,
      name,
      status,
      existingDeadline: deadlineStr,
      proposedDeadlineMs: parsed.ms,
      proposedDeadlineIso: parsed.iso,
      manilaTime: parsed.manilaTime
    })
  }

  const backupProcedure = [
    '=== FIRESTORE BACKUP PROCEDURE ===',
    'Before executing live migration, export the current schedulePublications collection:',
    '1. Run gcloud / firebase firestore export:',
    '   gcloud firestore export gs://<YOUR_BACKUP_BUCKET>/backups/publications-pre-migration-$(date +%Y%m%d%H%M%S) --collection-ids=schedulePublications',
    '2. Or download JSON snapshot using Firebase Admin SDK / Node script.',
    '3. Verify backup file exists and contains all active publication documents.'
  ].join('\n')

  const rollbackProcedure = [
    '=== FIRESTORE ROLLBACK PROCEDURE ===',
    'If migration needs to be rolled back for any publication:',
    '1. Set submissionDeadlineMs to null or delete the field using updateDoc:',
    '   await updateDoc(doc(db, "schedulePublications", id), { submissionDeadlineMs: deleteField() });',
    '2. Or restore from the backup bucket created in step 1:',
    '   gcloud firestore import gs://<YOUR_BACKUP_BUCKET>/backups/<BACKUP_NAME> --collection-ids=schedulePublications'
  ].join('\n')

  return {
    totalEvaluated: publications.length,
    toBeMigrated,
    skippedAlreadyValid,
    skippedNoDeadline,
    flaggedForManualReview,
    backupProcedure,
    rollbackProcedure
  }
}

/**
 * Executes migration in either dry-run or live mode against Firestore.
 */
export async function executePublicationDeadlinesMigration(
  db: any,
  plan: MigrationPlan,
  options: { execute?: boolean } = {}
): Promise<MigrationExecutionResult> {
  const isExecute = options.execute === true

  if (!isExecute) {
    return {
      executed: false,
      dryRun: true,
      migratedCount: plan.toBeMigrated.length,
      updatedIds: []
    }
  }

  const updatedIds: string[] = []
  const errors: string[] = []

  for (const item of plan.toBeMigrated) {
    try {
      if (typeof db.updateDoc === 'function') {
        await db.updateDoc('schedulePublications', item.id, {
          submissionDeadlineMs: item.proposedDeadlineMs
        })
      } else if (typeof db.doc === 'function') {
        const docRef = db.doc('schedulePublications', item.id)
        if (typeof docRef.update === 'function') {
          await docRef.update({ submissionDeadlineMs: item.proposedDeadlineMs })
        } else {
          // Firebase v9 modular style
          const { updateDoc } = await import('firebase/firestore')
          await updateDoc(docRef, { submissionDeadlineMs: item.proposedDeadlineMs })
        }
      }
      updatedIds.push(item.id)
    } catch (err: any) {
      errors.push(`Failed to migrate publication ${item.id}: ${err.message}`)
    }
  }

  return {
    executed: true,
    dryRun: false,
    migratedCount: updatedIds.length,
    updatedIds,
    errors: errors.length > 0 ? errors : undefined
  }
}

// CLI runner if executed directly
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('migratePublicationDeadlines')) {
  const isExecute = process.argv.includes('--execute')
  console.log('===============================================================')
  console.log(`MATS Legacy Publication Deadline Migration Tool [${isExecute ? 'LIVE EXECUTE' : 'DRY RUN'}]`)
  console.log('===============================================================\n')

  if (!isExecute) {
    console.log('NOTICE: Running in DRY-RUN mode by default. No Firestore changes will be committed.')
    console.log('Pass --execute flag to apply changes.\n')
  }
}
