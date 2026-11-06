// Read-only check that what runs online matches the repo, for one split test.
// Usage: node scripts/verify-live.mjs <test-id>
// Run it after any change of weights, snippet or tracker, and before reading a test.
// It never calls /api/assign or /api/track (that would count a visit or a click).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TESTS } from "../lib/tests.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const testId = process.argv[2];
const test = TESTS[testId];
if (!test) {
  console.error(`Test inconnu : ${testId}. Tests : ${Object.keys(TESTS).join(", ")}`);
  process.exit(2);
}
if (!test.entry) {
  console.error(`Pas de page d'entree (champ entry) pour ${testId} dans lib/tests.js.`);
  process.exit(2);
}

const problems = [];
const ok = (msg) => console.log(`OK    ${msg}`);
const ko = (msg) => { problems.push(msg); console.log(`ERREUR ${msg}`); };

async function get(url) {
  const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
  return res.text();
}
const norm = (s) => s.replace(/\r\n/g, "\n").trim();

// 1. Snippet online = snippet of the repo
const snippetFile = path.join(here, `split-redirect-${testId}.js`);
const repoSnippet = fs.readFileSync(snippetFile, "utf8");
const entryHtml = await get(test.entry);
const repoScripts = [...repoSnippet.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => norm(m[1]));
const liveScripts = [...entryHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => norm(m[1]));
if (repoScripts.length && repoScripts.every((s) => liveScripts.includes(s))) {
  ok(`script de ${test.entry} identique a ${path.basename(snippetFile)}`);
} else {
  ko(`le script en ligne sur ${test.entry} differe de ${path.basename(snippetFile)} (coller la version du depot dans Framer, puis Publish)`);
}

// 2. Weights and variant URLs online = lib/tests.js
const configBlock = liveScripts.find((s) => s.includes("SPLIT_CONFIG") && s.includes(`"${testId}"`));
if (!configBlock) {
  ko(`SPLIT_CONFIG du test ${testId} introuvable sur ${test.entry}`);
} else {
  const config = new Function(`${configBlock}; return SPLIT_CONFIG;`)();
  for (const v of test.variants) {
    const liveWeight = (config.weights && config.weights[v.id]) || 1;
    const apiWeight = v.weight || 1;
    if (liveWeight === apiWeight) ok(`poids ${v.id} : ${apiWeight} dans l'outil et dans le script`);
    else ko(`poids ${v.id} : ${apiWeight} dans lib/tests.js, ${liveWeight} dans le script en ligne`);
    if (config.variants[v.id] === v.url) ok(`page ${v.id} : ${v.url}`);
    else ko(`page ${v.id} : ${v.url} dans lib/tests.js, ${config.variants[v.id]} dans le script en ligne`);
  }
}

// 3. Each variant page: tracker published, page mapped to its variant, button counted
const repoTracker = fs.readFileSync(path.join(here, "override-cta.tsx"), "utf8");
const regexSource = (src) => {
  const m = src.match(/SPLIT_CTA_RE\s*=\s*(\/.*\/[a-z]*)/);
  return m ? m[1].trim() : null;
};
const repoRe = regexSource(repoTracker);
for (const v of test.variants) {
  const html = await get(v.url);
  const pagePath = new URL(v.url).pathname;
  const trackerUrl = (html.match(/https:\/\/[^"']*Split_CTA_Tracker[^"']*\.mjs/) || [])[0];
  if (!trackerUrl) {
    ko(`${pagePath} : compteur Split_CTA_Tracker absent de la page`);
    continue;
  }
  const tracker = await get(trackerUrl);
  const liveRe = (tracker.match(/\/poppins\\\.io\\\/\(\?:[^,]*?\/i/) || [])[0];
  if (liveRe && repoRe && liveRe === repoRe) ok(`${pagePath} : regex des clics identique au depot`);
  else ko(`${pagePath} : regex des clics du compteur publie differente de override-cta.tsx (recopier dans Split_CTA_Tracker, puis Publish)`);
  const mapped = tracker.includes(`"${pagePath}"`) || tracker.includes(`\`${pagePath}\``);
  const mapsTest = tracker.includes(testId);
  if (mapped && mapsTest) ok(`${pagePath} : page reconnue par le compteur (arrivees et clics du bras ${v.id})`);
  else ko(`${pagePath} : page absente de PAGE_TESTS dans le compteur publie (arrivees non comptees)`);
  const re = repoRe ? new Function(`return ${repoRe}`)() : null;
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  const counted = re ? links.filter((l) => re.test(l)) : [];
  if (counted.length) ok(`${pagePath} : ${counted.length} bouton(s) compte(s), vers ${[...new Set(counted)].join(", ")}`);
  else ko(`${pagePath} : aucun lien de la page n'est reconnu par la regex des clics`);
}

console.log(problems.length ? `\n${problems.length} ecart(s) : ne pas lire le test avant de les corriger.` : "\nTout est conforme.");
process.exit(problems.length ? 1 : 0);
