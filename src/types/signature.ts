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

export const DEFAULT_FINANCE_SIGNATORIES: SignatoryItem[] = [
  {
    id: 'sig-1',
    label: 'Requesting officer:',
    name: 'Bro. CHRYSLER DAVID',
    title: 'Treasurer, Ministry of Altar Servers',
    organization: DEFAULT_PARISH_NAME,
    column: 1
  },
  {
    id: 'sig-2',
    label: 'Approved by:',
    name: 'Bro. KYLE VINCENT MADRIAGA',
    title: 'Coordinator, Ministry of Altar Servers',
    organization: DEFAULT_PARISH_NAME,
    column: 2
  },
  {
    id: 'sig-3',
    label: 'Released by:',
    name: 'Bro. BENAIKA LORENZO PARONABLE',
    title: 'Admin Officer, Ministry of Altar Servers',
    organization: DEFAULT_PARISH_NAME,
    column: 2
  }
]

export const DEFAULT_SIGNATURE_PRESETS: SignaturePreset[] = [
  {
    id: 'preset-finance',
    name: 'Treasury Standard (3 Signatures)',
    signatories: DEFAULT_FINANCE_SIGNATORIES
  },
  {
    id: 'preset-prepared-noted',
    name: 'General (Prepared & Noted)',
    signatories: [
      {
        id: 'preset-p1',
        label: 'Prepared by:',
        name: '',
        title: DEFAULT_MINISTRY_NAME,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'preset-p2',
        label: 'Noted by:',
        name: 'Bro. KYLE VINCENT MADRIAGA',
        title: `Coordinator, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  },
  {
    id: 'preset-audit-verification',
    name: 'Audit & Verification (4 Signatures)',
    signatories: [
      {
        id: 'preset-av1',
        label: 'Prepared by:',
        name: '',
        title: DEFAULT_MINISTRY_NAME,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'preset-av2',
        label: 'Checked by:',
        name: '',
        title: `Officer, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'preset-av3',
        label: 'Verified by:',
        name: '',
        title: `Auditor, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      },
      {
        id: 'preset-av4',
        label: 'Approved by:',
        name: 'Bro. KYLE VINCENT MADRIAGA',
        title: `Coordinator, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  },
  {
    id: 'preset-verified-approved',
    name: 'Verification & Approval (3 Signatures)',
    signatories: [
      {
        id: 'preset-va1',
        label: 'Prepared by:',
        name: '',
        title: DEFAULT_MINISTRY_NAME,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'preset-va2',
        label: 'Verified by:',
        name: '',
        title: `Officer, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      },
      {
        id: 'preset-va3',
        label: 'Approved by:',
        name: 'Bro. KYLE VINCENT MADRIAGA',
        title: `Coordinator, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  },
  {
    id: 'preset-approved-only',
    name: 'Single Approval (Approved by)',
    signatories: [
      {
        id: 'preset-a1',
        label: 'Approved by:',
        name: 'Bro. KYLE VINCENT MADRIAGA',
        title: `Coordinator, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  }
]
