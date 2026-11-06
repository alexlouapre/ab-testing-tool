// Events the pages may send to /api/track (06/11/2026).
// - clic_main_cta: click on the main button of a variant page.
// - vue: arrival on a variant page, sent by the page itself (true denominator,
//   unlike the visits of /api/assign, which count draws).
// - secours: the entry snippet drew the variant itself (API slower than 2 s or
//   in error); the variant sent is the one the visitor was sent to.
export const ALLOWED_EVENTS = ["clic_main_cta", "vue", "secours"];
