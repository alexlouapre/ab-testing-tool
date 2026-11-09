<!-- Split Test : yt-maison (A: asu-2-yt-a, Typeform V5 / B: asu-2-yt-b, questionnaire maison) -->
<!-- Page d'entree : https://info.poppins.io/asu-2-yt (Custom Code > Start of head, page /asu-2-yt) -->
<!-- Prepare le 2026-11-09 : 50 % Typeform, 50 % maison (decision de Hugo du 09/11). Copie du script bascule-maison. -->
<!-- But : verifier que le tableau de bord du maison range les parcours YouTube a part de Meta (CADRAGE_SPLIT_YOUTUBE_2026-11-09.md). -->
<!-- Les poids ci-dessous doivent rester egaux a ceux de lib/tests.js : node scripts/verify-live.mjs yt-maison le controle. -->
<!-- Note : pas de logique VARIANT_A_URL ici, A est une page distincte de la page d'entree -->
<style id="split-hide">body{opacity:0!important}</style>
<script>
var SPLIT_CONFIG = {
  test: "yt-maison",
  cookie: "split_yt_maison",
  variants: {
    A: "https://info.poppins.io/asu-2-yt-a",
    B: "https://info.poppins.io/asu-2-yt-b"
  },
  // Same weights as lib/tests.js: the fallback (API slow or down) must keep the same split (50 / 50).
  weights: { A: 1, B: 1 }
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
