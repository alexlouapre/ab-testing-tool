import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    await redis.ping();
    return res.json({ status: "ok" });
  } catch (err) {
    console.error("[health] Redis unreachable:", err);
    return res.status(503).json({ status: "error", message: "Redis unreachable" });
  }
}
