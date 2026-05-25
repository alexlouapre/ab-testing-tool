import { Redis } from "@upstash/redis";
import { TESTS } from "../lib/tests.js";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://info.poppins.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req, res) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const { test: testId } = req.query;
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

  // GET — read current config
  if (req.method === "GET") {
    const configData = await redis.get(`config:${testId}`);
    return res.json(configData || { enabled: true, forcedVariant: null });
  }

  // POST — update config
  if (req.method === "POST") {
    const body = req.body;

    const newConfig = {
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      forcedVariant: body.forcedVariant || null,
    };

    const validVariants = test.variants.map((v) => v.id);
    if (newConfig.forcedVariant && !validVariants.includes(newConfig.forcedVariant)) {
      return res
        .status(400)
        .json({ error: `Invalid variant. Must be ${validVariants.join(", ")}.` });
    }

    await redis.set(`config:${testId}`, newConfig);

    return res.json({ success: true, config: newConfig });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
