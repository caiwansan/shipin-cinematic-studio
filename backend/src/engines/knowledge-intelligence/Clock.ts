export interface Clock {
  now(): Date
}

export const SystemClock: Clock = {
  now: () => new Date(),
}

let currentClock: Clock = SystemClock

export function setClock(clock: Clock): void {
  currentClock = clock
}

export function getClock(): Clock {
  return currentClock
}
