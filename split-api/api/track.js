import { Redis } from "@upstash/redis";
import { TESTS } from "../lib/tests.js";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ALLOWED_EVENTS = ["clic_main_cta"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { test: testId, variant, event } = req.query;

  if (!testId) {
    return res.status(400).json({ error: "Missing test parameter" });
  }

  const test = TESTS[testId];
  if (!test) {
    return res.status(400).json({ error: "Unknown test" });
  }

  const validVariants = test.variants.map((v) => v.id);
  if (!variant || !validVariants.includes(variant)) {
    return res
      .status(400)
      .json({ error: `Invalid variant (${validVariants.join(", ")})` });
  }

  if (!event || !ALLOWED_EVENTS.includes(event)) {
    return res.status(400).json({ error: "Invalid event" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const p = redis.pipeline();
  p.incr(`events:${testId}:${variant}:${event}`);
  p.incr(`events:${testId}:${variant}:${event}:d:${today}`);
  await p.exec();

  return res.json({ ok: true });
}
