export interface CalendarEvent {
  id: string
  title: string
  startDate: string // YYYY-MM-DD
  endDate?: string // Optional YYYY-MM-DD for multi-day calendar events
  startTime?: string // Optional HH:mm
  endTime?: string // Optional HH:mm
  location?: string
  notes?: string
  createdByUid: string
  createdByName: string
  createdAt: unknown
  updatedAt: unknown
}

export interface CalendarEventInput {
  title: string
  startDate: string
  endDate?: string
  startTime?: string
  endTime?: string
  location?: string
  notes?: string
}
