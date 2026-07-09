import { Redis } from "@upstash/redis";
import { TESTS } from "../lib/tests.js";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function getDaysFrom(from) {
  const days = [];
  const cur = new Date(from + "T00:00:00Z");
  const end = new Date();
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { test: testId, from } = req.query;

  if (!testId || !TESTS[testId]) {
    return res.status(400).json({ error: "Unknown test" });
  }

  if (!from) {
    return res.status(400).json({ error: "Missing from parameter (YYYY-MM-DD)" });
  }

  const test = TESTS[testId];
  const days = getDaysFrom(from);

  const before = {};
  const after = {};

  for (const v of test.variants) {
    const visitKeys = days.map((d) => `stats:${testId}:${v.id}:d:${d}`);
    const eventKeys = days.map(
      (d) => `events:${testId}:${v.id}:clic_main_cta:d:${d}`
    );

    const [oldVisits, oldEvents, visitValues, eventValues] = await Promise.all([
      redis.get(`stats:${testId}:${v.id}`),
      redis.get(`events:${testId}:${v.id}:clic_main_cta`),
      Promise.all(visitKeys.map((k) => redis.get(k))),
      Promise.all(eventKeys.map((k) => redis.get(k))),
    ]);

    const newVisits = visitValues.reduce((sum, val) => sum + (val || 0), 0);
    const newEvents = eventValues.reduce((sum, val) => sum + (val || 0), 0);

    before[v.id] = { visits: oldVisits || 0, clic_main_cta: oldEvents || 0 };
    after[v.id] = { visits: newVisits, clic_main_cta: newEvents };

    await redis.set(`stats:${testId}:${v.id}`, newVisits);
    await redis.set(`events:${testId}:${v.id}:clic_main_cta`, newEvents);
  }

  return res.json({ success: true, from, days, before, after });
}
