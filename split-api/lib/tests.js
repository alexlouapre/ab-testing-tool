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
  // Montee du 16 au 18/11 : poids 9 contre 1 (10 % au maison). Le 19/11 a 0 h UTC : passer B a weight 9 (50/50).
  "bascule-maison": {
    variants: [
      { id: "A", url: "https://info.poppins.io/asu-2-bm-a", weight: 9 },
      { id: "B", url: "https://info.poppins.io/asu-2-bm-b", weight: 1 },
    ],
  },
};
