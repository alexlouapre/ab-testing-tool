export const TESTS = {
  "asu-2-tt": {
    variants: [
      { id: "A", url: "https://info.poppins.io/asu-2-tt" },
      { id: "B", url: "https://info.poppins.io/asu-triton-classic" },
      { id: "C", url: "https://info.poppins.io/asu-triton-story" },
    ],
  },
  "triton-meta": {
    variants: [
      { id: "A", url: "https://info.poppins.io/asu-2" },
      { id: "B", url: "https://info.poppins.io/asu-triton-meta-verb" },
      { id: "C", url: "https://info.poppins.io/asu-triton-meta-story" },
    ],
  },
  "rtg-mini": {
    variants: [
      { id: "A", url: "https://info.poppins.io/rtg-1" },
      { id: "B", url: "https://info.poppins.io/rtg-2" },
    ],
  },
  "quickfix-asu-2": {
    variants: [
      { id: "A", url: "https://info.poppins.io/asu-2" },
      { id: "B", url: "https://info.poppins.io/asu-2-qf-b" },
      { id: "C", url: "https://info.poppins.io/asu-2-qf-c" },
    ],
  },
  "ptf-perso": {
    variants: [
      { id: "A", url: "https://info.poppins.io/asu-2-ptf-a" },
      { id: "B", url: "https://info.poppins.io/asu-2-ptf-b" },
    ],
  },
  "rentree-26-v2": {
    variants: [
      { id: "A", url: "https://info.poppins.io/rentree-26-bofu-dir" },
      { id: "B", url: "https://info.poppins.io/rentree-26-bofu-tf" },
    ],
  },
  // A/B Typeform contre questionnaire maison sur asu-2 (Meta). A = Typeform, en premier : le kill switch y renvoie.
  // Lancement (decision de Hugo du 05/11/2026) : poids 19 contre 1, soit 95 % Typeform et 5 % maison.
  // 06/11/2026 (decision de Hugo) : poids 9 contre 1, soit 90 % Typeform et 10 % maison.
  // 09/11/2026 (decision de Hugo) : poids 4 contre 1, soit 80 % Typeform et 20 % maison.
  // 10/11/2026 (decision de Hugo) : poids 7 contre 3, soit 70 % Typeform et 30 % maison.
  // 11/11/2026 (decision de Hugo) : poids 3 contre 2, soit 60 % Typeform et 40 % maison.
  // Changer les parts = changer ces poids (exemple : 50/50, A et B a 1) ET les memes poids dans
  // scripts/split-redirect-bascule-maison.js (secours), coller dans Framer, Publish, puis
  // node scripts/verify-live.mjs bascule-maison, qui refuse tout ecart.
  "bascule-maison": {
    // Entry page carrying the snippet (read by scripts/verify-live.mjs).
    entry: "https://info.poppins.io/asu-2",
    variants: [
      { id: "A", url: "https://info.poppins.io/asu-2-bm-a", weight: 3 },
      { id: "B", url: "https://info.poppins.io/asu-2-bm-b", weight: 2 },
    ],
  },
  // Controle des sources du questionnaire maison sur le trafic YouTube (asu-2-yt). A = Typeform V5, en premier :
  // le kill switch y renvoie. 50/50 (decision de Hugo du 09/11/2026). But : verifier que le tableau de bord
  // du maison range bien les parcours YouTube a part de Meta, pas mesurer un ecart.
  // Cadrage : CADRAGE_SPLIT_YOUTUBE_2026-11-09.md. Memes poids dans scripts/split-redirect-yt-maison.js.
  "yt-maison": {
    // Entry page carrying the snippet (read by scripts/verify-live.mjs).
    entry: "https://info.poppins.io/asu-2-yt",
    variants: [
      { id: "A", url: "https://info.poppins.io/asu-2-yt-a", weight: 1 },
      { id: "B", url: "https://info.poppins.io/asu-2-yt-b", weight: 1 },
    ],
  },
};
