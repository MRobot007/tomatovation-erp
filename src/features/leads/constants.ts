import type { LeadPriority, LeadSource, LeadStatus } from './api/leads.api'

/**
 * Pipeline order is meaningful: the kanban columns, the conversion funnel in
 * analytics, and the status picker all read from this one array so they cannot
 * disagree about the shape of the pipeline.
 */
export const PIPELINE: readonly LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
]

/** Stages a lead passes through on the way to a decision, excluding outcomes. */
export const OPEN_STAGES: readonly LeadStatus[] = PIPELINE.filter(
  (status) => status !== 'won' && status !== 'lost',
)

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
}

export const STATUS_TONE: Record<LeadStatus, 'neutral' | 'info' | 'brand' | 'warning' | 'success' | 'danger'> = {
  new: 'neutral',
  contacted: 'info',
  qualified: 'brand',
  proposal: 'warning',
  negotiation: 'warning',
  won: 'success',
  lost: 'danger',
}

export const PRIORITY_LABEL: Record<LeadPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const PRIORITY_TONE: Record<LeadPriority, 'neutral' | 'info' | 'danger'> = {
  low: 'neutral',
  medium: 'info',
  high: 'danger',
}

export const SOURCE_LABEL: Record<LeadSource, string> = {
  website: 'Website',
  referral: 'Referral',
  cold_call: 'Cold call',
  email_campaign: 'Email campaign',
  social: 'Social',
  event: 'Event',
  partner: 'Partner',
  other: 'Other',
}

export const ACTIVITY_LABEL = {
  note: 'Note',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  status_change: 'Status change',
  assignment: 'Assignment',
  followup_scheduled: 'Follow-up scheduled',
} as const
