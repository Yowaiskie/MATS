export interface SignatoryItem {
  id: string
  label: string            // e.g. "Requesting officer:", "Approved by:", "Released by:", "Noted by:"
  name: string             // e.g. "Bro. CHRYSLER DAVID"
  title: string            // e.g. "Treasurer, Ministry of Altar Servers"
  organization?: string    // e.g. "Sacred Heart of Jesus Parish - MBS"
  column: 1 | 2            // Column 1 (Left) or Column 2 (Right)
  signatureImageUrl?: string // Optional base64 or image URL
}

export interface SignatureConfig {
  enabled: boolean
  signatories: SignatoryItem[]
}

export interface SignaturePreset {
  id: string
  name: string
  signatories: SignatoryItem[]
}

export const COMMON_SIGNATURE_LABELS = [
  'Prepared by:',
  'Verified by:',
  'Checked by:',
  'Reviewed by:',
  'Audited by:',
  'Noted by:',
  'Approved by:',
  'Requesting officer:',
  'Released by:',
  'Received by:',
  'Confirmed by:',
  'Endorsed by:',
  'Attested by:'
] as const

export const DEFAULT_PARISH_NAME = 'Sacred Heart of Jesus Parish – MBS'
export const DEFAULT_MINISTRY_NAME = 'Ministry of Altar Servers'
export const DEFAULT_PARISH_PRIEST_NAME = 'Rev. Fr. ILDEFONSO DE GUZMAN JR.'
export const DEFAULT_PARISH_PRIEST_TITLE = 'Parish Priest'
export const DEFAULT_COORDINATOR_NAME = 'Bro. KYLE VINCENT MADRIAGA'
export const DEFAULT_COORDINATOR_TITLE = `Coordinator, ${DEFAULT_MINISTRY_NAME}`
export const DEFAULT_TREASURER_NAME = 'Bro. CHRYSLER DAVID'
export const DEFAULT_TREASURER_TITLE = `Treasurer, ${DEFAULT_MINISTRY_NAME}`

export const DEFAULT_FINANCE_SIGNATORIES: SignatoryItem[] = [
  {
    id: 'sig-1',
    label: 'Prepared by:',
    name: 'Bro. CHRYSLER DAVID',
    title: 'Treasurer, Ministry of Altar Servers',
    organization: DEFAULT_PARISH_NAME,
    column: 1
  },
  {
    id: 'sig-2',
    label: 'Noted by:',
    name: 'Bro. KYLE VINCENT MADRIAGA',
    title: 'Coordinator, Ministry of Altar Servers',
    organization: DEFAULT_PARISH_NAME,
    column: 2
  },
  {
    id: 'sig-3',
    label: 'Approved by:',
    name: 'Rev. Fr. ILDEFONSO DE GUZMAN JR.',
    title: 'Parish Priest',
    organization: DEFAULT_PARISH_NAME,
    column: 2
  }
]

export const DEFAULT_SIGNATURE_PRESETS: SignaturePreset[] = [
  {
    id: 'preset-general',
    name: 'General (Prepared & Noted)',
    signatories: [
      {
        id: 'preset-p1',
        label: 'Prepared by:',
        name: 'Bro. BENAIKA LORENZO PARONABLE',
        title: `Admin Officer, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'preset-p2',
        label: 'Noted by:',
        name: DEFAULT_COORDINATOR_NAME,
        title: DEFAULT_COORDINATOR_TITLE,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  },
  {
    id: 'preset-requisition',
    name: 'Requisition (2 Signatures)',
    signatories: [
      {
        id: 'preset-req-1',
        label: 'Requesting officer:',
        name: DEFAULT_TREASURER_NAME,
        title: DEFAULT_TREASURER_TITLE,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'preset-req-2',
        label: 'Approved by:',
        name: DEFAULT_COORDINATOR_NAME,
        title: DEFAULT_COORDINATOR_TITLE,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  },
  {
    id: 'preset-liquidation',
    name: 'Liquidation (3 Signatures)',
    signatories: [
      {
        id: 'preset-liq-1',
        label: 'Prepared by:',
        name: DEFAULT_TREASURER_NAME,
        title: DEFAULT_TREASURER_TITLE,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'preset-liq-2',
        label: 'Noted by:',
        name: DEFAULT_COORDINATOR_NAME,
        title: DEFAULT_COORDINATOR_TITLE,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      },
      {
        id: 'preset-liq-3',
        label: 'Approved by:',
        name: DEFAULT_PARISH_PRIEST_NAME,
        title: DEFAULT_PARISH_PRIEST_TITLE,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  },
  {
    id: 'preset-finance',
    name: 'Treasury Standard (3 Signatures)',
    signatories: DEFAULT_FINANCE_SIGNATORIES
  },
  {
    id: 'preset-audit-verification',
    name: 'Audit & Verification (4 Signatures)',
    signatories: [
      {
        id: 'preset-av1',
        label: 'Prepared by:',
        name: DEFAULT_TREASURER_NAME,
        title: DEFAULT_TREASURER_TITLE,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'preset-av2',
        label: 'Checked by:',
        name: 'Bro. BENAIKA LORENZO PARONABLE',
        title: `Admin Officer, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'preset-av3',
        label: 'Verified by:',
        name: DEFAULT_COORDINATOR_NAME,
        title: DEFAULT_COORDINATOR_TITLE,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      },
      {
        id: 'preset-av4',
        label: 'Approved by:',
        name: DEFAULT_PARISH_PRIEST_NAME,
        title: DEFAULT_PARISH_PRIEST_TITLE,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  },
  {
    id: 'preset-coordinator-only',
    name: 'Coordinator Approval',
    signatories: [
      {
        id: 'preset-a1',
        label: 'Approved by:',
        name: DEFAULT_COORDINATOR_NAME,
        title: DEFAULT_COORDINATOR_TITLE,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  },
  {
    id: 'preset-priest-only',
    name: 'Parish Priest Approval',
    signatories: [
      {
        id: 'preset-p1-priest',
        label: 'Approved by:',
        name: DEFAULT_PARISH_PRIEST_NAME,
        title: DEFAULT_PARISH_PRIEST_TITLE,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  }
]
