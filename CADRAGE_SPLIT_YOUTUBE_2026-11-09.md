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

## Mise en ligne (09/11/2026)

- Outil : test `yt-maison` ajouté et poussé (commit `db3ed8c`), contrôle de bout en bout réussi.
- Framer : pages `asu-2-yt-a` et `asu-2-yt-b` créées par Hugo, `Split_CTA_Tracker` mis à jour (2 lignes), entrée Custom Code `Split yt-maison` (Start of `<head>`, page `/asu-2-yt`), publié vers 18 h 05.
- `verify-live` conforme pour `yt-maison` et `bascule-maison` à 18 h 13. Compteurs `yt-maison` remis à zéro à 18 h 14.

## Relevé intermédiaire (11/11/2026, demande de Hugo)

Comparaison donnée à titre indicatif : le test n'est pas fait pour comparer, et les volumes ne permettent aucune conclusion.

| Depuis le 09/11 18 h 14 (Paris) | Typeform (A) | Maison (B) |
|---|---|---|
| Arrivées sur la page de bras (outil de split) | 313 | 324 |
| Clics sur le bouton | 23 (7,3 %) | 19 (5,9 %) |
| Questionnaires avec email, du 09/11 18 h 14 au 10/11 15 h 48 | 2 | 2 |
| dont éligibles, fils ou fille | 2 | 2 |

- Sources : `/api/stats?test=yt-maison` ; Snowflake `AIRBYTE_SCHEMA.ELIGIBILITY_V5` (`LANDING = 'asu-2-yt-a'`) et `POSTGRES_ELIGIBILITY.ELIGIBILITYRUNS` (`FROM = 'asu-2-yt-b'`, hors tests), Metabase base 2.
- Période commune bornée par la copie du maison dans Snowflake, arrêtée au 10/11 14 h 48 UTC (celle de Typeform allait jusqu'au 11/11 5 h 16 UTC). Typeform a 2 questionnaires de plus le 10/11 au soir.
- Les 4 questionnaires Typeform venus d'`asu-2-yt-a` portent `utm_source=youtube`. La source des 2 parcours maison n'a pas été vérifiée.
- À surveiller : si la copie du maison dans Snowflake ne repart pas, le signaler à Alex.

## Lecture du critère et relevé (12/11/2026 vers 19 h 50)

**Critère rempli** : les 7 parcours maison partis de `from=asu-2-yt-b` (hors tests, du 09/11 20 h 58 au 12/11 15 h 43) sont tous rangés `YouTube Ads` en premier et en dernier canal, avec `utm_source=youtube`, aucun clic Meta. Aucun n'est en Meta ni sans source. Dans l'autre sens, les 152 parcours partis d'`asu-2-bm-b` sur la même période sont tous rangés `Meta payant` (145) ou `Meta indistinct` (7), aucun en YouTube.

Limites : vérifié dans la copie Snowflake de la base du maison (`POSTGRES_ELIGIBILITY.ELIGIBILITYRUNS`, colonnes `FIRSTCHANNEL` / `LASTCHANNEL`, copie du 12/11 16 h 27), pas dans l'écran du tableau de bord d'Alex. Cette table ne contient que des parcours terminés : les abandons ne sont pas vérifiés. 7 parcours, pas les 20 prévus.

| Depuis le 09/11 18 h 14 (Paris) | Typeform (A) | Maison (B) |
|---|---|---|
| Tirages (outil de split) | 658 | 657 |
| Arrivées sur la page de bras | 506 | 537 |
| Clics sur le bouton | 44 (8,7 %) | 36 (6,7 %) |
| Secours | 23 | 29 |
| Questionnaires terminés | 11 (copie arrêtée au 12/11 vers 4 h) | 7 (copie arrêtée au 12/11 vers 16 h) |
| dont éligibles, fils ou fille | 6 | 7 |

- L'écart de clics (2 points) n'est pas significatif à ces volumes (environ 1,2 écart-type).
- Les 11 Typeform portent `utm_source=youtube`. Les 5 Typeform en plus des 6 éligibles fils ou fille sont des non-éligibles ou d'autres relations (petit frère, patient).
- Sources : `/api/stats?test=yt-maison` à 19 h 48 ; Snowflake `AIRBYTE_SCHEMA.ELIGIBILITY_V5` (`LANDING = 'asu-2-yt-a'`) et `POSTGRES_ELIGIBILITY.ELIGIBILITYRUNS`, Metabase base 2. La copie du maison dans Snowflake est repartie (elle était arrêtée au 10/11).

## Ce qui reste ouvert

1. **Alex** (message donné à Hugo le 09/11, envoi par Hugo) : le tableau de bord sait-il trier par source (`utm_source`), pas seulement par `from` ? Le monitoring accepte-t-il un `from` autre que `asu-2-bm-b` sans fausse alerte ?
2. **Lecture** : vers le 16/11, regarder dans le tableau de bord maison si chaque parcours parti de `from=asu-2-yt-b` est rangé en YouTube (critère de réussite ci-dessus), puis décider avec Hugo : arrêt ou part conservée.
3. Pas de passage de contrôle avec une fausse visite jusqu'au maison : écarté pour ne pas mettre de faux parcours dans le tableau de bord qu'on veut lire.
4. Ajouter `asu-2-yt-a` aux scripts d'analyse V5 (`PROJET_ANALYSE_TYPEFORM_ELIGIBILITY`), sinon le trafic Typeform YouTube disparaît des tableaux.
