import { env } from "cloudflare:workers";

const MAX_PER_MINUTE = 5;

export const beginRateLimitedRequest = async (sessionId: string) => {
  const { success } = await env.SHARED_AI_RATE_LIMIT.limit({
    key: `shared-ai:${sessionId}`,
  });

  if (!success) {
    throw new Error(
      "429: You hit the free shared limit for this minute. Try again shortly or add your own API key.",
    );
  }
};

export const endRateLimitedRequest = () => {
  // no-op — native rate limiting does not require request teardown
};
