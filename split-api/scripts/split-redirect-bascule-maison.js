<!-- Split Test : bascule-maison (A: asu-2-bm-a, Typeform / B: asu-2-bm-b, questionnaire maison) -->
<!-- Page d'entree : https://info.poppins.io/asu-2 (Custom Code > Head) -->
<!-- Prepare le 2026-11-05, a poser au lancement (95 % Typeform, 5 % maison, decision de Hugo du 05/11), parts reglees par les poids de lib/tests.js. -->
<!-- 06/11/2026 : le secours (API lente ou en panne) tire avec les memes poids que l'API (95 / 5), il tirait a 50 / 50. -->
<!-- 06/11/2026 (2) : un seul tirage par visite (le secours tirait deux fois), et chaque tirage du secours est signale a l'outil (evenement "secours"). -->
<!-- 06/11/2026 (3) : passage a 90 % Typeform, 10 % maison (decision de Hugo), poids 9 contre 1. -->
<!-- 09/11/2026 : passage a 80 % Typeform, 20 % maison (decision de Hugo), poids 4 contre 1. -->
<!-- Les poids ci-dessous doivent rester egaux a ceux de lib/tests.js : node scripts/verify-live.mjs bascule-maison le controle. -->
<!-- Note : pas de logique VARIANT_A_URL ici, A est une page distincte de la page d'entree -->
<style id="split-hide">body{opacity:0!important}</style>
<script>
var SPLIT_CONFIG = {
  test: "bascule-maison",
  cookie: "split_bascule-maison",
  variants: {
    A: "https://info.poppins.io/asu-2-bm-a",
    B: "https://info.poppins.io/asu-2-bm-b"
  },
  // Same weights as lib/tests.js: the fallback (API slow or down) must keep the same split (80 / 20 since 09/11/2026).
  // Until 06/11/2026 it drew 50 / 50 and sent about 15 % of visitors to B (Framer Analytics, 05-06/11).
  weights: { A: 4, B: 1 }
};
</script>
<script>
(function () {
  var API_URL = "https://split-api-one.vercel.app/api/assign?test=" + SPLIT_CONFIG.test;
  var COOKIE_NAME = SPLIT_CONFIG.cookie;
  var COOKIE_DAYS = 30;
  var VARIANTS = SPLIT_CONFIG.variants;
  var TRACK_URL = "https://split-api-one.vercel.app/api/track?test=" + SPLIT_CONFIG.test;
  // First decision wins: the timeout, the aborted request and a late answer
  // could each draw and redirect again.
  var decided = false;

  var safetyTimer = setTimeout(showPage, 3000);

  function showPage() {
    var el = document.getElementById("split-hide");
    if (el) el.remove();
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? match[2] : null;
  }

  function setCookie(name, value, days) {
    var maxAge = days * 24 * 60 * 60;
    document.cookie = name + "=" + value + "; path=/; max-age=" + maxAge + "; SameSite=Lax; Secure";
  }

  function trackFallback(variantId) {
    var url = TRACK_URL + "&variant=" + variantId + "&event=secours";
    try { if (navigator.sendBeacon && navigator.sendBeacon(url)) return; } catch (e) {}
    try { fetch(url, { method: "GET", keepalive: true, mode: "no-cors" }).catch(function () {}); } catch (e) {}
  }

  function applyVariant(variantId) {
    if (decided) return;
    decided = true;
    clearTimeout(safetyTimer);
    var url = VARIANTS[variantId];
    if (!url) { showPage(); return; }
    var params = new URLSearchParams(window.location.search);
    params.set(COOKIE_NAME, variantId);
    window.location.replace(url + "?" + params.toString());
  }

  function fallbackRandom() {
    if (decided) return;
    var keys = Object.keys(VARIANTS);
    var weights = SPLIT_CONFIG.weights || {};
    var total = 0;
    for (var i = 0; i < keys.length; i++) total += weights[keys[i]] || 1;
    var r = Math.random() * total;
    var pick = keys[keys.length - 1];
    for (var j = 0; j < keys.length; j++) {
      r -= weights[keys[j]] || 1;
      if (r < 0) { pick = keys[j]; break; }
    }
    setCookie(COOKIE_NAME, pick, COOKIE_DAYS);
    trackFallback(pick);
    applyVariant(pick);
  }

  var existing = getCookie(COOKIE_NAME);
  if (existing && VARIANTS[existing]) { applyVariant(existing); return; }

  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var fetchTimeout = setTimeout(function () {
    if (controller) controller.abort();
    fallbackRandom();
  }, 2000);

  fetch(API_URL, { signal: controller ? controller.signal : undefined, cache: "no-store" })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      clearTimeout(fetchTimeout);
      if (decided) return;
      if (data && data.variant && VARIANTS[data.variant]) {
        setCookie(COOKIE_NAME, data.variant, COOKIE_DAYS);
        // Redis down: the API sent A without counting it, count it as a fallback.
        if (data.fallback) trackFallback(data.variant);
        applyVariant(data.variant);
      } else { fallbackRandom(); }
    })
    .catch(function () { clearTimeout(fetchTimeout); fallbackRandom(); });
})();
</script>
