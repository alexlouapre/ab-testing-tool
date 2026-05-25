import { Redis } from "@upstash/redis";
import { TESTS } from "../lib/tests.js";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://info.poppins.io",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req, res) {
  // Set CORS headers
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const testId = req.query.test;

  if (!testId || !TESTS[testId]) {
    return res.status(400).json({ error: "Unknown test" });
  }

  const test = TESTS[testId];

  try {
    // Check kill switch / forced config
    const configData = await redis.get(`config:${testId}`);
    if (configData) {
      if (configData.enabled === false) {
        const fallback = test.variants[0];
        return res.json({ variant: fallback.id, url: fallback.url });
      }
      if (configData.forcedVariant) {
        const forced = test.variants.find(
          (v) => v.id === configData.forcedVariant
        );
        if (forced) {
          try {
            const today = new Date().toISOString().slice(0, 10);
            const p = redis.pipeline();
            p.incr(`stats:${testId}:${forced.id}`);
            p.incr(`stats:${testId}:${forced.id}:d:${today}`);
            await p.exec();
          } catch (statsErr) {
            console.error(`[assign] Stats incr failed for ${testId}:${forced.id}:`, statsErr);
          }
          return res.json({ variant: forced.id, url: forced.url });
        }
      }
    }

    // Atomic round-robin counter
    const counter = await redis.incr(`counter:${testId}`);
    const index = (counter - 1) % test.variants.length;
    const variant = test.variants[index];

    // Increment per-variant stats (global + daily)
    try {
      const today = new Date().toISOString().slice(0, 10);
      const p = redis.pipeline();
      p.incr(`stats:${testId}:${variant.id}`);
      p.incr(`stats:${testId}:${variant.id}:d:${today}`);
      await p.exec();
    } catch (statsErr) {
      console.error(`[assign] Stats incr failed for ${testId}:${variant.id}:`, statsErr);
    }

    return res.json({ variant: variant.id, url: variant.url });
  } catch (err) {
    console.error(`[assign] Redis error for test ${testId}:`, err);
    const fallback = test.variants[0];
    return res.json({ variant: fallback.id, url: fallback.url, fallback: true });
  }
}
