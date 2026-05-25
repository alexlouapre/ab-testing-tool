---
name: Poppins ABC split test
description: First split URL test for Poppins - ABC test on asu-2 landing page with Meta traffic, Framer hosted
type: project
---

Premier test ABC split URL pour Poppins, initie le 2026-03-17.

- URL d'entree : https://info.poppins.io/asu-2
- 3 variantes a 33.3% chacune :
  - Controle : https://info.poppins.io/asu-2
  - Variante B : https://info.poppins.io/asu-triton-clasic
  - Variante C : https://info.poppins.io/asu-triton-story
- Source de trafic : Meta ads (Facebook/Instagram), principalement mobile
- Landing pages hebergees sur Framer (custom code possible)
- Exigence : split parfait 33/33/33, totalement random, persistance par visiteur

**Why:** L'utilisateur veut mesurer la performance de 3 variantes de landing page pour optimiser les conversions Meta ads.
**How to apply:** Toute architecture doit fonctionner en client-side (injection Framer custom code) ou via redirect server-side leger. Le trafic mobile Meta impose des contraintes sur les cookies et la vitesse de redirect.
