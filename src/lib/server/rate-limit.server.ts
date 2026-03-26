import { env } from 'cloudflare:workers'

const MAX_PER_MINUTE = 5
const MAX_PER_DAY = 50

const todayKey = (sessionId: string) => {
  const date = new Date().toISOString().slice(0, 10)
  return `day:${sessionId}:${date}`
}

const minuteKey = (sessionId: string) => {
  const bucket = Math.floor(Date.now() / 60_000)
  return `min:${sessionId}:${bucket}`
}

const increment = async (key: string, ttl: number): Promise<number> => {
  const current = await env.RATE_LIMIT.get(key)
  const next = (current ? parseInt(current, 10) : 0) + 1
  await env.RATE_LIMIT.put(key, String(next), { expirationTtl: ttl })
  return next
}

export const beginRateLimitedRequest = async (sessionId: string) => {
  const [dayCount, minuteCount] = await Promise.all([
    env.RATE_LIMIT.get(todayKey(sessionId)).then((v) => (v ? parseInt(v, 10) : 0)),
    env.RATE_LIMIT.get(minuteKey(sessionId)).then((v) => (v ? parseInt(v, 10) : 0)),
  ])

  if (minuteCount >= MAX_PER_MINUTE) {
    throw new Error('429: You hit the free shared limit for this minute. Try again shortly or add your own API key.')
  }

  if (dayCount >= MAX_PER_DAY) {
    throw new Error('429: You hit the free shared limit for today. Add your own API key to keep going.')
  }

  await Promise.all([
    increment(todayKey(sessionId), 86_400),
    increment(minuteKey(sessionId), 120),
  ])
}

export const endRateLimitedRequest = () => {
  // no-op — KV doesn't need in-flight tracking
}
