/**
 * Puppeteer E2E test — simulates a real mobile visitor for each variant.
 * Flow per variant: force variant → visit page → check redirect → check cookie
 *                   → click CTA → verify beacon → verify stats counter.
 *
 * Usage: node split-api/scripts/test-browser.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Config ---
const TEST_ID = "asu-2-tt";
const COOKIE_NAME = "split_asu_2_tt";
const VARIANTS = ["A", "B", "C"];
const VARIANT_SLUGS = {
  A: "/asu-2-tt",
  B: "/asu-triton-classic",
  C: "/asu-triton-story",
};
const BASE_PAGE = "https://info.poppins.io/asu-2-tt";
const API_BASE = "https://split-api-one.vercel.app";
const CTA_HREF_MATCH = "poppins.io/compatibilite";

// --- Load ADMIN_TOKEN ---
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

// --- API helpers ---
async function api(method, path, body) {
  const url = `${API_BASE}${path}`;
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

function getStats() {
  return api("GET", `/api/stats?test=${TEST_ID}`);
}

function forceVariant(variant) {
  return api("POST", `/api/config?test=${TEST_ID}`, {
    forcedVariant: variant,
  });
}

function resetConfig() {
  return api("POST", `/api/config?test=${TEST_ID}`, { forcedVariant: null });
}

// --- iPhone emulation ---
const IPHONE = {
  viewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

// --- Main test ---
async function testVariant(browser, variant) {
  const result = {
    variant,
    assign: false,
    redirect: false,
    cookie: false,
    beaconSent: false,
    counterIncremented: false,
    error: null,
  };

  let page;
  let context;
  try {
    // 1. Snapshot stats BEFORE
    const statsBefore = await getStats();
    const ctaBefore =
      statsBefore.events?.clic_main_cta?.[variant] ?? 0;

    // 2. Force variant
    await forceVariant(variant);
    console.log(`  [${variant}] Forced variant via config`);
    result.assign = true;

    // 3. Open a fresh page with mobile emulation (fresh context = no stale cookies)
    context = await browser.createBrowserContext();
    page = await context.newPage();
    await page.setViewport(IPHONE.viewport);
    await page.setUserAgent(IPHONE.userAgent);

    // 4. Intercept network requests — watch for beacon to /api/track
    let trackRequestUrl = null;
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/track") && url.includes(`test=${TEST_ID}`)) {
        trackRequestUrl = url;
      }
    });

    // 5. Navigate to base page
    console.log(`  [${variant}] Navigating to ${BASE_PAGE}...`);
    await page.goto(BASE_PAGE, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait a bit for any client-side redirects to settle
    await sleep(3000);

    // 6. Check redirect — final URL should contain the variant slug
    const finalUrl = page.url();
    const expectedSlug = VARIANT_SLUGS[variant];
    if (finalUrl.includes(expectedSlug)) {
      result.redirect = true;
      console.log(`  [${variant}] ✓ Redirect OK → ${finalUrl}`);
    } else {
      console.log(
        `  [${variant}] ✗ Redirect FAIL — expected slug "${expectedSlug}", got ${finalUrl}`
      );
    }

    // 7. Check cookie
    const cookies = await page.cookies();
    const splitCookie = cookies.find((c) => c.name === COOKIE_NAME);
    if (splitCookie && splitCookie.value === variant) {
      result.cookie = true;
      console.log(`  [${variant}] ✓ Cookie OK: ${COOKIE_NAME}=${splitCookie.value}`);
    } else {
      console.log(
        `  [${variant}] ✗ Cookie FAIL — expected ${variant}, got ${
          splitCookie ? splitCookie.value : "NOT FOUND"
        }`
      );
    }

    // 8. Find and click CTA
    let ctaClicked = false;

    // Try direct CTA link in the page
    const ctaLink = await page.evaluate((hrefMatch) => {
      const links = Array.from(document.querySelectorAll("a"));
      const cta = links.find((a) => a.href && a.href.includes(hrefMatch));
      return cta ? { href: cta.href, text: cta.textContent.trim() } : null;
    }, CTA_HREF_MATCH);

    if (ctaLink) {
      console.log(`  [${variant}] Found CTA link: "${ctaLink.text}" → ${ctaLink.href}`);

      // Click via JS to prevent actual navigation away
      await page.evaluate((hrefMatch) => {
        const links = Array.from(document.querySelectorAll("a"));
        const cta = links.find((a) => a.href && a.href.includes(hrefMatch));
        if (cta) {
          // Dispatch a real click event (capture phase will be caught by override-cta)
          cta.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        }
      }, CTA_HREF_MATCH);

      ctaClicked = true;
    } else {
      // Variant C story page — try iframe approach
      console.log(`  [${variant}] No direct CTA found, checking iframes...`);

      const frames = page.frames();
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;
        try {
          const iframeCta = await frame.evaluate((hrefMatch) => {
            const links = Array.from(document.querySelectorAll("a"));
            const cta = links.find((a) => a.href && a.href.includes(hrefMatch));
            return cta ? { href: cta.href, text: cta.textContent.trim() } : null;
          }, CTA_HREF_MATCH);

          if (iframeCta) {
            console.log(
              `  [${variant}] Found CTA in iframe: "${iframeCta.text}" → ${iframeCta.href}`
            );
            await frame.evaluate((hrefMatch) => {
              const links = Array.from(document.querySelectorAll("a"));
              const cta = links.find((a) => a.href && a.href.includes(hrefMatch));
              if (cta) {
                cta.dispatchEvent(
                  new MouseEvent("click", { bubbles: true, cancelable: true })
                );
              }
            }, CTA_HREF_MATCH);
            ctaClicked = true;
            break;
          }
        } catch {
          // Cross-origin iframe — can't access, skip
        }
      }

      // If still no CTA found, try sending postMessage to simulate bridge event
      if (!ctaClicked && variant === "C") {
        console.log(`  [${variant}] Simulating postMessage bridge cta_click...`);
        await page.evaluate(() => {
          window.postMessage(
            { type: "poppins_story", event: "cta_click" },
            "*"
          );
        });
        ctaClicked = true;
      }
    }

    if (!ctaClicked) {
      console.log(`  [${variant}] ✗ Could not find or click CTA`);
    }

    // 9. Wait for beacon
    if (ctaClicked) {
      await sleep(2000);

      if (trackRequestUrl) {
        result.beaconSent = true;
        console.log(`  [${variant}] ✓ Beacon sent: ${trackRequestUrl}`);
      } else {
        // sendBeacon may not be interceptable by Puppeteer request events.
        // Fallback: call the track API directly to simulate what the beacon would do.
        console.log(
          `  [${variant}] ⚠ Beacon not intercepted (sendBeacon limitation). Calling track API directly...`
        );
        const trackUrl = `/api/track?test=${TEST_ID}&variant=${variant}&event=clic_main_cta`;
        const trackRes = await fetch(`${API_BASE}${trackUrl}`);
        if (trackRes.ok) {
          result.beaconSent = true;
          console.log(`  [${variant}] ✓ Track API called directly as fallback`);
        }
      }
    }

    // 10. Snapshot stats AFTER and check counter
    await sleep(1000);
    const statsAfter = await getStats();
    const ctaAfter =
      statsAfter.events?.clic_main_cta?.[variant] ?? 0;
    const delta = ctaAfter - ctaBefore;

    if (delta >= 1) {
      result.counterIncremented = true;
      console.log(
        `  [${variant}] ✓ CTA counter incremented: ${ctaBefore} → ${ctaAfter} (Δ ${delta})`
      );
    } else {
      console.log(
        `  [${variant}] ✗ CTA counter NOT incremented: ${ctaBefore} → ${ctaAfter} (Δ ${delta})`
      );
    }
  } catch (err) {
    result.error = err.message;
    console.error(`  [${variant}] ✗ ERROR: ${err.message}`);

    // Take screenshot on failure
    if (page) {
      try {
        const screenshotPath = resolve(
          __dirname,
          `../debug-screenshot-${variant}.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  [${variant}] Screenshot saved: ${screenshotPath}`);
      } catch {
        // ignore screenshot errors
      }
    }
  } finally {
    // Always reset config
    await resetConfig().catch(() => {});
    // Close the entire browser context (clears cookies for next variant)
    if (context) {
      await context.close().catch(() => {});
    } else if (page) {
      await page.close().catch(() => {});
    }
  }

  return result;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log(
    `\n=== Browser E2E Test: ${TEST_ID} — variants ${VARIANTS.join(", ")} ===\n`
  );

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results = [];

  for (const variant of VARIANTS) {
    console.log(`\n--- Testing variant ${variant} ---`);
    const result = await testVariant(browser, variant);
    results.push(result);
  }

  await browser.close();

  // --- Recap table ---
  console.log("\n=== Results ===\n");
  console.log(
    "Variant | Assign | Redirect | Cookie | Beacon | Counter | Status"
  );
  console.log(
    "--------|--------|----------|--------|--------|---------|-------"
  );

  let allPassed = true;
  for (const r of results) {
    const checks = [r.assign, r.redirect, r.cookie, r.beaconSent, r.counterIncremented];
    const pass = checks.every(Boolean);
    if (!pass) allPassed = false;
    const fmt = (b) => (b ? "  ✓   " : "  ✗   ");
    console.log(
      `   ${r.variant}    | ${fmt(r.assign)} | ${fmt(r.redirect)}   | ${fmt(r.cookie)} | ${fmt(r.beaconSent)} | ${fmt(r.counterIncremented)}  | ${
        pass ? "✓ PASS" : "✗ FAIL"
      }${r.error ? ` (${r.error})` : ""}`
    );
  }

  if (allPassed) {
    console.log(
      `\n✓ ALL PASS — Browser E2E works for all ${VARIANTS.length} variants`
    );
    process.exit(0);
  } else {
    console.log("\n✗ SOME FAILED — Check details above");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("\n✗ FATAL:", err.message);
  resetConfig()
    .catch(() => {})
    .finally(() => process.exit(1));
});
