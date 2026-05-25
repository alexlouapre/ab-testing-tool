import { Redis } from "@upstash/redis";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const testId = process.argv[2];
if (!testId) {
  console.error("Usage: node reset-test.mjs <testId>");
  process.exit(1);
}

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const patterns = [
  `counter:${testId}`,
  `stats:${testId}:*`,
  `events:${testId}:*`,
  `config:${testId}`,
];

let allKeys = [];
for (const pattern of patterns) {
  let cursor = "0";
  do {
    const [next, batch] = await redis.scan(cursor, { match: pattern, count: 100 });
    cursor = next;
    allKeys.push(...batch);
  } while (cursor !== "0");
}

allKeys = [...new Set(allKeys)];
console.log(`Found ${allKeys.length} keys for test "${testId}":`);
allKeys.forEach((k) => console.log("  " + k));

if (allKeys.length === 0) {
  console.log("Nothing to delete.");
  process.exit(0);
}

const deleted = await redis.del(...allKeys);
console.log(`\n✓ Deleted ${deleted} keys.`);
