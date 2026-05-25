# Templates Framer Snippets

## Template: split-redirect

Placeholders: `{{TEST_ID}}`, `{{COOKIE_NAME}}`, `{{COOKIE_DAYS}}`, `{{VARIANTS_JSON}}`, `{{DEPLOY_URL}}`

```html
<!-- Split Test ({{TEST_ID}}) — Coller dans Framer > Custom Code > Head -->
<style id="split-hide">body{opacity:0!important}</style>
<script>
var SPLIT_CONFIG = {
  test: "{{TEST_ID}}",
  cookie: "{{COOKIE_NAME}}",
  variants: {
{{VARIANTS_JSON}}
  }
};
</script>
<script>
(function () {
  var API_URL = "https://{{DEPLOY_URL}}/api/assign?test=" + SPLIT_CONFIG.test;
  var COOKIE_NAME = SPLIT_CONFIG.cookie;
  var COOKIE_DAYS = {{COOKIE_DAYS}};
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
      // Source variant — stay on this page
      showPage();
      return;
    }
    // Redirect — preserve all query params (fbclid, UTMs)
    var redirectUrl = url + window.location.search;
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
```

`VARIANTS_JSON` is generated as one line per variant:
```
    A: "https://example.com/page-a",
    B: "https://example.com/page-b",
```

## Override CTA

L'override CTA est universel et partage : `split-api/tests/shared/override-cta.tsx`.
Il detecte automatiquement tous les cookies `split_*` par convention (pas de mapping explicite).
**Aucun fichier a generer** pour le CTA lors d'un nouveau test.
