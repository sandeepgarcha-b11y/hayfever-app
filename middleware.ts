import { NextRequest, NextResponse } from "next/server";

// Rate limiting is optional. If Upstash env vars are not set the middleware
// is a no-op — you can add credentials later without any code changes.
// Get a free Upstash Redis instance at https://upstash.com

export async function middleware(req: NextRequest) {
  const redisUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return NextResponse.next();
  }

  // Dynamically import so the module only loads when credentials are present.
  const { Ratelimit } = await import("@upstash/ratelimit");
  const { Redis }     = await import("@upstash/redis");

  const redis = new Redis({ url: redisUrl, token: redisToken });

  const ratelimit = new Ratelimit({
    redis,
    // 20 requests per hour per IP — generous for a real user, strict for a bot.
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    analytics: true,
    prefix: "hayfever:rl",
  });

  // Use the first IP in x-forwarded-for (set by Vercel) or fall back to a
  // generic key so the middleware doesn't break in local dev.
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

  const { success, limit, remaining, reset } = await ratelimit.limit(ip);

  if (!success) {
    return new NextResponse("Too many requests — try again later.", {
      status: 429,
      headers: {
        "X-RateLimit-Limit":     String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset":     String(reset),
        "Retry-After":           String(Math.ceil((reset - Date.now()) / 1000)),
      },
    });
  }

  const res = NextResponse.next();
  res.headers.set("X-RateLimit-Limit",     String(limit));
  res.headers.set("X-RateLimit-Remaining", String(remaining));
  res.headers.set("X-RateLimit-Reset",     String(reset));
  return res;
}

export const config = {
  matcher: "/api/conditions",
};
