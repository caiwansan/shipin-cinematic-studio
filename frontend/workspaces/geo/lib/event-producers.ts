/**
 * Producer Registry — SSOT for all event producers and consumers.
 *
 * Every event must be declared here before first emission.
 * Events not in this table are considered unauthorized.
 *
 * Convention:
 *   Producer: the file/component that emits the event
 *   Consumer: the file/component that listens for the event
 *   No event should exist without at least one producer and one consumer.
 */

export type EventRoute = {
  event: string
  producer: string
  consumer: string
  status: 'active' | 'planned' | 'deprecated'
  notes?: string
}

export const EVENT_ROUTES: EventRoute[] = [
  // ── Project ──
  {
    event: 'PROJECT:CREATED',
    producer: 'useGeoProjectStore.ts (createProject)',
    consumer: 'useSemanticRouter.ts (orchestration)',
    status: 'active',
    notes: 'Business trigger: PROJECT_CREATED → semantic ENTRY_START',
  },

  // ── System ──
  {
    event: 'SYSTEM:READY',
    producer: 'TBD (planned S1.2C)',
    consumer: 'TimelineRepository',
    status: 'planned',
    notes: 'App lifecycle — emits when GEO workspace bootstraps',
  },
  {
    event: 'SYSTEM:ERROR',
    producer: 'TBD (error boundary)',
    consumer: 'TimelineRepository',
    status: 'planned',
  },

  // ── Mission ──
  {
    event: 'MISSION:LOADING',
    producer: 'MissionCenterShell.vue (loadData)',
    consumer: 'TimelineRepository',
    status: 'active',
    notes: 'Emitted when dashboard mission data fetch starts',
  },
  {
    event: 'MISSION:LOADED',
    producer: 'MissionCenterShell.vue (loadData success)',
    consumer: 'TimelineRepository',
    status: 'active',
    notes: 'Emitted when mission data loads successfully',
  },
  {
    event: 'MISSION:ERROR',
    producer: 'MissionCenterShell.vue (loadData error)',
    consumer: 'TimelineRepository',
    status: 'active',
    notes: 'Emitted when mission data fetch fails',
  },
  {
    event: 'MISSION:APPEND',
    producer: 'TBD (planned S1.2C)',
    consumer: 'TimelineRepository',
    status: 'planned',
    notes: 'Appends an entry to mission timeline',
  },
  {
    event: 'MISSION:COMPLETED',
    producer: 'TBD (planned S1.2C)',
    consumer: 'TBD (planned S1.2C — Verification readiness)',
    status: 'planned',
    notes: 'Triggers VERIFICATION:READY for cross-page flow',
  },

  // ── Discovery ──
  {
    event: 'DISCOVERY:COMPLETED',
    producer: 'TBD (planned S1.2C)',
    consumer: 'TBD (planned S1.2C — Recommendations generation)',
    status: 'planned',
    notes: 'Discovery report generated → triggers recommendation',
  },

  // ── Recommendation ──
  {
    event: 'RECOMMENDATION:GENERATED',
    producer: 'TBD (planned S1.2C)',
    consumer: 'TBD (planned S1.2C — Mission creation)',
    status: 'planned',
    notes: 'Recommendations ready → creates Mission',
  },

  // ── Verification ──
  {
    event: 'VERIFY:COMPLETED',
    producer: 'TBD (planned S1.2C)',
    consumer: 'TBD (planned S1.2C — Knowledge/Publish)',
    status: 'planned',
    notes: 'Verification done → can proceed to Knowledge/Publish',
  },

  // ── Task (for future execution engine) ──
  {
    event: 'TASK:STARTED',
    producer: 'TBD',
    consumer: 'TimelineRepository',
    status: 'planned',
  },
  {
    event: 'TASK:UPDATED',
    producer: 'TBD',
    consumer: 'TimelineRepository',
    status: 'planned',
  },
  {
    event: 'TASK:FINISHED',
    producer: 'TBD',
    consumer: 'TimelineRepository',
    status: 'planned',
  },
]

/**
 * Quick lookup helpers.
 */
export const activeEvents = EVENT_ROUTES.filter(r => r.status === 'active')
export const plannedEvents = EVENT_ROUTES.filter(r => r.status === 'planned')

export function getProducer(event: string): string | undefined {
  return EVENT_ROUTES.find(r => r.event === event)?.producer
}

export function getConsumer(event: string): string | undefined {
  return EVENT_ROUTES.find(r => r.event === event)?.consumer
}
