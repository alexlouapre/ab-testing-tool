<!-- Story page bridge — CHANGE_ME -->
<!-- Coller dans Framer > Custom Code > Start of head tag de la page story -->
<!-- Gère : postMessage bridge iframe ↔ parent + sendBeacon CTA tracking -->
<script>
(function () {
  var COOKIE_NAME = "split_CHANGE_ME";
  var TEST_ID = "CHANGE_ME";
  var TRACK_URL = "https://split-api-one.vercel.app/api/track";
  var beaconSent = false;

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

  // On page load: if variant came via query param, set the cookie
  var params = new URLSearchParams(window.location.search);
  var variantFromUrl = params.get(COOKIE_NAME);
  if (variantFromUrl) {
    setCookie(COOKIE_NAME, variantFromUrl, 30);
  }

  // Listen for postMessage from iframe
  window.addEventListener("message", function (e) {
    if (!e.data || typeof e.data !== "object") return;

    // 1. Iframe requests split params → send them back
    if (e.data.type === "poppins_request_split_params") {
      var variant = getCookie(COOKIE_NAME);
      if (e.source) {
        e.source.postMessage(
          {
            type: "poppins_split_params",
            params: { CHANGE_ME: variant },
          },
          "*"
        );
      }
      return;
    }

    // 2. Iframe sends a dataLayer-style event (poppins_story)
    //    Accept both .type (bridge convention) and .event (iframe convention)
    if (e.data.type === "poppins_story" || e.data.event === "poppins_story") {
      // Push to parent dataLayer
      if (window.dataLayer) {
        window.dataLayer.push(e.data.payload || { event: e.data.event });
      }

      // Track CTA click via sendBeacon
      //    Accept .event, .action (iframe format), or .payload.event
      if (e.data.event === "cta_click" || e.data.action === "cta_click" || (e.data.payload && e.data.payload.event === "clic_main_cta")) {
        sendCtaBeacon();
      }
      return;
    }
  });

  function sendCtaBeacon() {
    if (beaconSent) return;
    beaconSent = true;
    var variant = getCookie(COOKIE_NAME);
    if (variant) {
      navigator.sendBeacon(
        TRACK_URL +
          "?test=" + encodeURIComponent(TEST_ID) +
          "&variant=" + encodeURIComponent(variant) +
          "&event=clic_main_cta"
      );
    }
  }
})();
</script>
