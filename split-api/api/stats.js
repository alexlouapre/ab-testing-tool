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

function getDaysInRange(from, to) {
  const days = [];
  const cur = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { test: testId, from, to } = req.query;
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!testId) {
    return res.status(400).json({ error: "Missing test parameter" });
  }

  const test = TESTS[testId];
  if (!test) {
    return res.status(400).json({ error: "Unknown test" });
  }

  const hasDateRange = from && to;

  // Always fetch global totals
  const statsKeys = test.variants.map((v) => `stats:${testId}:${v.id}`);
  const eventKeys = test.variants.map(
    (v) => `events:${testId}:${v.id}:clic_main_cta`
  );
  const globalValues = await Promise.all(
    [...statsKeys, ...eventKeys].map((k) => redis.get(k))
  );

  const variantCount = test.variants.length;
  const stats = {};
  let total = 0;
  const ctaEvents = {};

  test.variants.forEach((v, i) => {
    const count = globalValues[i] || 0;
    stats[v.id] = count;
    total += count;
    ctaEvents[v.id] = globalValues[variantCount + i] || 0;
  });

  const result = {
    ...stats,
    total,
    events: {
      clic_main_cta: ctaEvents,
    },
  };

  // If date range requested, fetch daily keys
  if (hasDateRange) {
    const days = getDaysInRange(from, to);
    // Build all daily keys: visits + cta events for each variant for each day
    const dailyKeys = [];
    for (const day of days) {
      for (const v of test.variants) {
        dailyKeys.push(`stats:${testId}:${v.id}:d:${day}`);
        dailyKeys.push(`events:${testId}:${v.id}:clic_main_cta:d:${day}`);
      }
    }

    const dailyValues = dailyKeys.length > 0
      ? await Promise.all(dailyKeys.map((k) => redis.get(k)))
      : [];

    const daily = {};
    let idx = 0;
    for (const day of days) {
      daily[day] = {};
      for (const v of test.variants) {
        daily[day][v.id] = {
          visits: dailyValues[idx] || 0,
          clic_main_cta: dailyValues[idx + 1] || 0,
        };
        idx += 2;
      }
    }

    result.daily = daily;
  }

  return res.json(result);
}
