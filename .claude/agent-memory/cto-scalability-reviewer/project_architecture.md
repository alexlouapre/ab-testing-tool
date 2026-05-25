---
name: Split URL Tool Architecture
description: Architecture overview of the A/B split URL testing tool - Vercel serverless + Upstash Redis + Framer snippet
type: project
---

Split URL A/B testing tool for poppins.io. Three components:
1. Framer snippet (client-side JS in page head) - does cookie check, calls API, redirects
2. Vercel serverless API (3 endpoints: assign, config, stats) using Upstash Redis
3. Static dashboard (dashboard.html) polling stats every 10s

**Why:** Used for A/B testing landing pages (asu-2 test with 3 variants A/B/C)
**How to apply:** When reviewing changes, consider all 3 components. Test config is duplicated in 4 places (assign.js, dashboard.html, framer snippets, config/tests.json). The config/tests.json file is NOT actually used by any code.

Key technical details:
- Traffic splitting: atomic Redis INCR round-robin counter
- Upstash Redis via HTTP (not TCP) - adds ~50-100ms per call
- Vercel Hobby plan, deployed as split-api-one.vercel.app
- No rate limiting, no health check, no structured logging, no alerting
- Can handle 5K visitors/day comfortably; breaking point ~50-100K/day
