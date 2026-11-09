# Cadrage : questionnaire maison sur une part du trafic YouTube (09/11/2026)

Statut : **en ligne depuis le 09/11/2026 vers 18 h 05** (test `yt-maison`, 50 / 50, compteurs remis a zero a 18 h 14). Reste ouvert : la reponse d'Alex sur le tri par source dans son tableau de bord.

## Objectif (Hugo, 09/11)

Pas mesurer une différence entre Typeform et le maison. **Vérifier que le tableau de bord du questionnaire maison distingue bien les sources** quand il reçoit un second canal en plus de Meta.

## Ce qui est vérifié (09/11)

- `info.poppins.io/asu-2-yt` est en ligne, sans script de split. Ses 3 boutons vont vers `www.poppins.io/compatibilite-pt?landing=asu-2-yt` (Typeform V5).
- Questionnaires V5 soumis depuis `asu-2-yt` (bruts) : 192 en octobre, 46 du 1er au 8 novembre, environ 6 par jour. `ssu-2-mt` : 23 en octobre, 0 en novembre. Déduit : les annonces YouTube arrivent sur `asu-2-yt` (à confirmer dans Google Ads).
- Depuis le 15/10, 151 questionnaires sur 152 venus d'`asu-2-yt` portent `utm_source=youtube`.
- Le maison enregistre `from`, `utm_source` à `utm_keyword`, `gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid` et le site d'origine (`attribution.ts` du dépôt `poppins-eligibility`).
- Le script de split conserve les paramètres de l'adresse jusqu'à la page de bras (vérifié sur Meta le 05/11 avec UTM et `fbclid`).

## Proposition

| Décision | Proposition |
|---|---|
| Bras A | `asu-2-yt-a`, copie exacte d'`asu-2-yt`, boutons vers `compatibilite-pt?landing=asu-2-yt-a` |
| Bras B | `asu-2-yt-b`, même page, boutons vers `start.poppins.io/?from=asu-2-yt-b` |
| Page d'entrée | `asu-2-yt` ne change pas d'URL et porte le script (copie du script `bascule-maison`, secours à parts égales) |
| Parts | 50 / 50 (Hugo, 09/11) : environ 3 questionnaires maison terminés par jour, estimation sur 6 par jour en Typeform |
| Ce qu'on regarde | dans le tableau de bord maison : les parcours partis de `from=asu-2-yt-b` sont rangés en YouTube (`utm_source=youtube`, `gclid` ou `gbraid` / `wbraid`), séparés de Meta (`asu-2-bm-b`, `fbclid`) |
| Réussi si | chaque parcours venu de `asu-2-yt-b` est rangé en YouTube, aucun n'est compté en Meta ou sans source |
| Durée | une semaine, soit environ 20 questionnaires maison terminés |
| Après | arrêt, ou on garde la part : à décider au vu du résultat |

## Ce qui ne compte plus, vu l'objectif

Puissance statistique, page de résultat différente selon le bras, parcours d'emails : utiles pour comparer, pas pour vérifier les sources.

## À vérifier avant la mise en ligne

1. Avec Alex : le tableau de bord sait-il filtrer ou ranger par source (et pas seulement par `from`) ? Le monitoring suit `from=asu-2-bm-b` ; une autre valeur est-elle acceptée ?
2. Faire un passage de contrôle avant le trafic réel : `asu-2-yt?utm_source=youtube&gclid=test-hugo` jusqu'au maison, puis lecture dans le tableau de bord.
3. Ajouter `asu-2-yt-a` aux scripts d'analyse V5, sinon le trafic Typeform YouTube disparaît des tableaux.
