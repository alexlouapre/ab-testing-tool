<!-- Split Test — rtg-mini -->
<style id="split-hide">body{opacity:0!important}</style>
<script>
var SPLIT_CONFIG = {
  test: "rtg-mini",
  cookie: "split_rtg_mini",
  variants: {
    A: "https://info.poppins.io/rtg-1",
    B: "https://info.poppins.io/rtg-2"
  }
};
</script>
<script>
(function () {
  var API_URL = "https://split-api-one.vercel.app/api/assign?test=" + SPLIT_CONFIG.test;
  var COOKIE_NAME = SPLIT_CONFIG.cookie;
  var COOKIE_DAYS = 30;
  var VARIANTS = SPLIT_CONFIG.variants;
  var VARIANT_A_URL = VARIANTS.A;

  // Safety timeout — show page after 3s no matter what
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
    document.cookie =
      name +
      "=" +
      value +
      "; path=/; max-age=" +
      maxAge +
      "; SameSite=Lax; Secure";
  }

  function applyVariant(variantId) {
    clearTimeout(safetyTimer);
    var url = VARIANTS[variantId];
    if (!url) {
      showPage();
      return;
    }
    if (url === VARIANT_A_URL) {
      // Variant A — stay on this page
      showPage();
      return;
    }
    // Redirect to B or C — preserve all query params (fbclid, UTMs)
    // Also pass split cookie value as query param for cross-page tracking
    var params = new URLSearchParams(window.location.search);
    params.set(COOKIE_NAME, variantId);
    var redirectUrl = url + "?" + params.toString();
    window.location.replace(redirectUrl);
  }

  function fallbackRandom() {
    var keys = Object.keys(VARIANTS);
    var pick = keys[Math.floor(Math.random() * keys.length)];
    setCookie(COOKIE_NAME, pick, COOKIE_DAYS);
    applyVariant(pick);
  }

  // 1. Check cookie
  var existing = getCookie(COOKIE_NAME);
  if (existing && VARIANTS[existing]) {
    applyVariant(existing);
    return;
  }

  // 2. Fetch API with 2s timeout
  var controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  var fetchTimeout = setTimeout(function () {
    if (controller) controller.abort();
    fallbackRandom();
  }, 2000);

  fetch(API_URL, {
    signal: controller ? controller.signal : undefined,
  })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      clearTimeout(fetchTimeout);
      if (data && data.variant && VARIANTS[data.variant]) {
        setCookie(COOKIE_NAME, data.variant, COOKIE_DAYS);
        applyVariant(data.variant);
      } else {
        fallbackRandom();
      }
    })
    .catch(function () {
      clearTimeout(fetchTimeout);
      fallbackRandom();
    });
})();
</script>
