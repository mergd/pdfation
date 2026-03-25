interface RateWindow {
  minuteTimestamps: number[]
  dayWindowStartedAt: number
  dayCount: number
  inFlight: number
}

const MAX_PER_MINUTE = 5
const MAX_PER_DAY = 40
const MAX_IN_FLIGHT = 1
const ONE_MINUTE = 60 * 1000
const ONE_DAY = 24 * 60 * 60 * 1000

const windows = new Map<string, RateWindow>()

const getWindow = (sessionId: string) => {
  const now = Date.now()
  const existing = windows.get(sessionId)

  if (!existing) {
    const next: RateWindow = {
      minuteTimestamps: [],
      dayWindowStartedAt: now,
      dayCount: 0,
      inFlight: 0,
    }
    windows.set(sessionId, next)

    return next
  }

  existing.minuteTimestamps = existing.minuteTimestamps.filter(
    (timestamp) => now - timestamp < ONE_MINUTE,
  )

  if (now - existing.dayWindowStartedAt >= ONE_DAY) {
    existing.dayWindowStartedAt = now
    existing.dayCount = 0
  }

  return existing
}

export const beginRateLimitedRequest = (sessionId: string) => {
  const windowState = getWindow(sessionId)

  if (windowState.inFlight >= MAX_IN_FLIGHT) {
    throw new Error('429: You already have a shared request in flight. Wait for it to finish.')
  }

  if (windowState.minuteTimestamps.length >= MAX_PER_MINUTE) {
    throw new Error('429: You hit the free shared limit for this minute. Try again shortly or add your own OpenRouter key.')
  }

  if (windowState.dayCount >= MAX_PER_DAY) {
    throw new Error('429: You hit the free shared limit for today. Add your own OpenRouter key to keep going.')
  }

  windowState.minuteTimestamps.push(Date.now())
  windowState.dayCount += 1
  windowState.inFlight += 1
}

export const endRateLimitedRequest = (sessionId: string) => {
  const windowState = windows.get(sessionId)

  if (!windowState) {
    return
  }

  windowState.inFlight = Math.max(0, windowState.inFlight - 1)
}
