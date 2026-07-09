import { Redis } from "@upstash/redis";
import { TESTS } from "../lib/tests.js";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { test: testId, date } = req.query;

  if (!testId || !TESTS[testId]) {
    return res.status(400).json({ error: "Unknown test" });
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Missing/invalid date parameter (YYYY-MM-DD)" });
  }

  const test = TESTS[testId];
  const keysToDelete = [];

  for (const v of test.variants) {
    keysToDelete.push(`stats:${testId}:${v.id}:d:${date}`);
    keysToDelete.push(`events:${testId}:${v.id}:clic_main_cta:d:${date}`);
  }

  await redis.del(...keysToDelete);

  return res.json({ success: true, deletedKeys: keysToDelete });
}
