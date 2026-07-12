/**
 * GEO Event Bus — Replay Utility
 *
 * Records and replays event sequences for debugging.
 * Events are recorded via the replay middleware.
 *
 * Usage:
 *   import { useEventBus } from '~/workspaces/geo/composables/useEventBus'
 *   import { createReplayMiddleware, eventRecorder } from '~/workspaces/geo/lib/replay'
 *
 *   // In app bootstrap:
 *   eventRecorder.start()
 *
 *   // In dev tools:
 *   eventRecorder.export()          // → JSON export for replay
 *   eventRecorder.replay(session)   // → re-emit all events
 *   eventRecorder.clear()
 *
 *   // CLI replay:
 *   // npm run replay -- --session=<id>
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventRecord = { event: string; payload: any; timestamp: number }

interface ReplaySession {
  id: string
  startedAt: number
  events: EventRecord[]
}

function createRecorder() {
  let session: ReplaySession | null = null
  const MAX_EVENTS = 1000

  return {
    start() {
      if (session) return session.id
      session = {
        id: `replay_${Date.now()}`,
        startedAt: Date.now(),
        events: [],
      }
      return session.id
    },

    record(event: string, payload: unknown, timestamp: number) {
      if (!session) return
      if (session.events.length >= MAX_EVENTS) return
      session.events.push({ event, payload, timestamp })
    },

    export(): ReplaySession | null {
      return session ? { ...session, events: [...session.events] } : null
    },

    clear() {
      session = null
    },

    isRecording(): boolean {
      return session !== null
    },

    /** Replay recorded events into an event bus emit function */
    replay(emitFn: (event: string, payload: unknown) => void, sessionData?: ReplaySession) {
      const data = sessionData || session
      if (!data) return
      for (const record of data.events) {
        emitFn(record.event, record.payload)
      }
    },
  }
}

/** Global recorder instance */
export const eventRecorder = createRecorder()

/**
 * Creates a middleware that records events for replay.
 */
export function createReplayMiddleware() {
  return {
    name: 'replay',
    afterEmit(event: string, payload: unknown) {
      eventRecorder.record(event, payload, Date.now())
    },
  }
}
