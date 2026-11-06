<!-- Split Test : bascule-maison (A: asu-2-bm-a, Typeform / B: asu-2-bm-b, questionnaire maison) -->
<!-- Page d'entree : https://info.poppins.io/asu-2 (Custom Code > Head) -->
<!-- Prepare le 2026-11-05, a poser au lancement (95 % Typeform, 5 % maison, decision de Hugo du 05/11), parts reglees par les poids de lib/tests.js. -->
<!-- 06/11/2026 : le secours (API lente ou en panne) tire avec les memes poids que l'API (95 / 5), il tirait a 50 / 50. -->
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
  // Same weights as lib/tests.js: the fallback (API slow or down) must keep the 95 / 5 split.
  // Until 06/11/2026 it drew 50 / 50 and sent about 15 % of visitors to B (Framer Analytics, 05-06/11).
  weights: { A: 19, B: 1 }
};
</script>
<script>
(function () {
  var API_URL = "https://split-api-one.vercel.app/api/assign?test=" + SPLIT_CONFIG.test;
  var COOKIE_NAME = SPLIT_CONFIG.cookie;
  var COOKIE_DAYS = 30;
  var VARIANTS = SPLIT_CONFIG.variants;

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

  function applyVariant(variantId) {
    clearTimeout(safetyTimer);
    var url = VARIANTS[variantId];
    if (!url) { showPage(); return; }
    var params = new URLSearchParams(window.location.search);
    params.set(COOKIE_NAME, variantId);
    window.location.replace(url + "?" + params.toString());
  }

  function fallbackRandom() {
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
    applyVariant(pick);
  }

  var existing = getCookie(COOKIE_NAME);
  if (existing && VARIANTS[existing]) { applyVariant(existing); return; }

  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var fetchTimeout = setTimeout(function () {
    if (controller) controller.abort();
    fallbackRandom();
  }, 2000);

  fetch(API_URL, { signal: controller ? controller.signal : undefined })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      clearTimeout(fetchTimeout);
      if (data && data.variant && VARIANTS[data.variant]) {
        setCookie(COOKIE_NAME, data.variant, COOKIE_DAYS);
        applyVariant(data.variant);
      } else { fallbackRandom(); }
    })
    .catch(function () { clearTimeout(fetchTimeout); fallbackRandom(); });
})();
</script>
