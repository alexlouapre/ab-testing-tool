/**
 * E2E test script for the split URL flow.
 * Tests the full pipeline: force variant → assign → track CTA → verify stats
 * for all variants.
 *
 * Usage: node split-api/scripts/test-e2e.mjs [testId] [variants] [vercelHost]
 *   testId    — test ID (default: asu-2-tt)
 *   variants  — comma-separated variant IDs (default: A,B,C)
 *   vercelHost — Vercel deploy host (default: split-api-one.vercel.app)
 *
 * Examples:
 *   node split-api/scripts/test-e2e.mjs
 *   node split-api/scripts/test-e2e.mjs landing-v3 A,B
 *   node split-api/scripts/test-e2e.mjs landing-v3 A,B,C my-deploy.vercel.app
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Config (from CLI args or defaults) ---
const args = process.argv.slice(2);
const TEST_ID = args[0] || "asu-2-tt";
const VARIANTS = args[1] ? args[1].split(",") : ["A", "B", "C"];
const EVENT = "clic_main_cta";
const BASE_URL = `https://${args[2] || "split-api-one.vercel.app"}`;

// --- Load ADMIN_TOKEN from .env.local ---
function loadToken() {
  const envPath = resolve(__dirname, "../.env.local");
  const content = readFileSync(envPath, "utf-8");
  const match = content.match(/^ADMIN_TOKEN=(.+)$/m);
  if (!match) {
    console.error("ADMIN_TOKEN not found in .env.local");
    process.exit(1);
  }
  return match[1].trim().replace(/^["']|["']$/g, "");
}

const TOKEN = loadToken();

// --- Helpers ---
async function api(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const opts = {
    method,
    headers: { Authorization: `Bearer ${TOKEN}` },
  };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiGet(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

function log(label, data) {
  console.log(`\n[${label}]`, typeof data === "object" ? JSON.stringify(data, null, 2) : data);
}

// --- Main ---
async function run() {
  console.log(`\n=== E2E Test: ${TEST_ID} — variants ${VARIANTS.join(", ")} ===\n`);

  // 1. Snapshot stats BEFORE (all variants)
  log("1. Stats BEFORE", "fetching...");
  const before = await api("GET", `/api/stats?test=${TEST_ID}`);
  const snapshotBefore = {};
  for (const v of VARIANTS) {
    snapshotBefore[v] = {
      assigns: before[v] ?? 0,
      cta: before.events?.clic_main_cta?.[v] ?? 0,
    };
  }
  log("Stats BEFORE", snapshotBefore);

  // 2. For each variant: force → assign → track → reset
  for (const variant of VARIANTS) {
    console.log(`\n--- Variant ${variant} ---`);

    // 2a. Force variant
    log(`Force ${variant}`, `Setting forcedVariant=${variant}...`);
    await api("POST", `/api/config?test=${TEST_ID}`, { forcedVariant: variant });

    // 2b. Assign
    const assign = await apiGet(`/api/assign?test=${TEST_ID}`);
    if (assign.variant !== variant) {
      console.error(`\n✗ FAIL: Expected variant ${variant}, got ${assign.variant}`);
      await api("POST", `/api/config?test=${TEST_ID}`, { forcedVariant: null });
      process.exit(1);
    }
    console.log(`✓ Assign returned variant ${variant}`);

    // 2c. Track CTA
    const track = await apiGet(
      `/api/track?test=${TEST_ID}&variant=${variant}&event=${EVENT}`
    );
    if (!track.ok) {
      console.error(`\n✗ FAIL: Track did not return { ok: true } for variant ${variant}`);
      await api("POST", `/api/config?test=${TEST_ID}`, { forcedVariant: null });
      process.exit(1);
    }
    console.log(`✓ Track returned ok for variant ${variant}`);

    // 2d. Reset config
    await api("POST", `/api/config?test=${TEST_ID}`, { forcedVariant: null });
    console.log(`✓ Config reset after variant ${variant}`);
  }

  // 3. Snapshot stats AFTER (all variants)
  log("3. Stats AFTER", "fetching...");
  const after = await api("GET", `/api/stats?test=${TEST_ID}`);
  const snapshotAfter = {};
  for (const v of VARIANTS) {
    snapshotAfter[v] = {
      assigns: after[v] ?? 0,
      cta: after.events?.clic_main_cta?.[v] ?? 0,
    };
  }
  log("Stats AFTER", snapshotAfter);

  // 4. Compare — recap table
  console.log("\n=== Results ===\n");
  console.log("Variant | Assigns (before → after) | CTA (before → after) | Status");
  console.log("--------|--------------------------|----------------------|-------");

  let allPassed = true;
  for (const v of VARIANTS) {
    const assignDelta = snapshotAfter[v].assigns - snapshotBefore[v].assigns;
    const ctaDelta = snapshotAfter[v].cta - snapshotBefore[v].cta;
    const pass = assignDelta >= 1 && ctaDelta >= 1;
    if (!pass) allPassed = false;
    const status = pass ? "✓ PASS" : "✗ FAIL";
    console.log(
      `   ${v}    | ${snapshotBefore[v].assigns} → ${snapshotAfter[v].assigns} (Δ ${assignDelta})`.padEnd(40) +
      `| ${snapshotBefore[v].cta} → ${snapshotAfter[v].cta} (Δ ${ctaDelta})`.padEnd(23) +
      `| ${status}`
    );
  }

  if (allPassed) {
    console.log(`\n✓ PASS — CTA tracking pipeline works end-to-end for all ${VARIANTS.length} variants`);
    process.exit(0);
  } else {
    console.error("\n✗ FAIL — Expected at least +1 on both assigns and CTA for each variant");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("\n✗ FATAL:", err.message);
  // Attempt config reset on crash
  api("POST", `/api/config?test=${TEST_ID}`, { forcedVariant: null })
    .catch(() => {})
    .finally(() => process.exit(1));
});
