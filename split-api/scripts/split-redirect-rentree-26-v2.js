<!-- Split Test — rentree-26-v2 (A: rentree-26-bofu-dir / B: rentree-26-bofu-tf) -->
<!-- Pages d'entree : https://info.poppins.io/rentree-26-bofu ET https://info.poppins.io/sp-26 -->
<!-- Le MEME snippet est colle sur les deux entrees (decide le 2026-09-21). Les deux -->
<!-- campagnes Meta convergent vers le meme test sans que leurs URL d'ads changent. -->
<!-- Lance le 2026-09-21. -->
<!-- Note : pas de logique VARIANT_A_URL ici, A est une page distincte des pages d'entree -->
<style id="split-hide">body{opacity:0!important}</style>
<script>
var SPLIT_CONFIG = {
  test: "rentree-26-v2",
  cookie: "split_rentree_26_v2",
  variants: {
    A: "https://info.poppins.io/rentree-26-bofu-dir",
    B: "https://info.poppins.io/rentree-26-bofu-tf"
  }
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
    var pick = keys[Math.floor(Math.random() * keys.length)];
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
