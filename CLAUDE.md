# AB Testing Tool — Split URL

## Architecture

API serverless Vercel (`split-api/`) avec Upstash Redis pour le round-robin et le tracking.

### ⚠️ Contrainte structurante — URL d'entrée des ads figée

Les ads Meta pointent toutes vers une **URL d'entrée fixe** (actuellement `https://info.poppins.io/asu-2`). Cette URL **ne doit jamais être modifiée dans les ads** — un changement reset l'historique d'apprentissage de la campagne (audience, optimisation, perfs).

Conséquences pour tout split URL :
- Le snippet `split-redirect.js` se place dans le Custom Code Framer de **l'URL d'entrée** (asu-2 aujourd'hui). C'est elle qui décide où rediriger.
- Quand on **stoppe un test**, on **ne change pas l'URL des ads ni l'URL du CTA des landings**. On retire juste le snippet `split-redirect` du Custom Code de la page d'entrée.
- Si un test produit une "winner" et qu'on veut la passer à 100 % du trafic, la bonne stratégie n'est **PAS** de rediriger les ads vers une autre URL. C'est de **réécrire le contenu de l'URL d'entrée** pour qu'il corresponde à la winner. L'URL reste stable, le contenu change.

### Fichiers clés

- `split-api/lib/tests.js` — source unique de l'objet `TESTS` (importé par tous les endpoints)
- `split-api/api/assign.js` — attribution de variante (round-robin atomique Redis)
- `split-api/api/track.js` — tracking événements CTA (sendBeacon côté client)
- `split-api/api/stats.js` — lecture stats (auth Bearer requise)
- `split-api/api/config.js` — kill switch / forced variant (auth Bearer requise)
- `split-api/dashboard.html` — dashboard temps réel des stats
- `split-api/scripts/override-cta.tsx` — override CTA universel (tous tests, toutes variantes)
- `split-api/scripts/split-redirect-template.js` — template redirect generique (copier et modifier SPLIT_CONFIG)
- `split-api/scripts/story-page-bridge-template.js` — template bridge iframe story (copier et modifier CHANGE_ME)

### Convention snippets Framer

**Override CTA** : un seul fichier `split-api/scripts/override-cta.tsx` pour TOUS les boutons CTA de toutes les pages et tous les tests. Il scanne les cookies `split_*` et derive automatiquement le test ID par convention (`split_` prefix + `_` → `-`). Aucune modification necessaire lors de l'ajout d'un nouveau test.

⚠️ **Deux motifs de detection depuis le 18/09/2026, a ne pas confondre.** Le fichier teste desormais chaque lien contre deux regex :

| Regex | Ce qu'elle gouverne | Perimetre |
|---|---|---|
| `CTA_PATH_RE` | le push `dataLayer` | liens vers `poppins.io/(compatibilite\|eligibilite)` |
| `SPLIT_CTA_RE` | le beacon de split et le delai de navigation de 150 ms | idem, **plus** les liens vers une page dont le slug finit par `-offres` |

`CTA_PATH_RE` est un sous-ensemble strict de `SPLIT_CTA_RE`, donc le comportement des liens deja couverts avant cette date est inchange.

**Pourquoi separer.** Elargir `CTA_PATH_RE` aurait elargi le push `dataLayer`, donc les tags GTM qui l'ecoutent : le tag 244 (event GA4 `clic_main_cta`) et le tag 319 (pixel TikTok `ttq.track("ClicMainCTA")`). Aucun tag Meta n'y est branche, verifie dans le conteneur `GTM-T59MRZ6B`, mais une rupture d'historique GA4 et un nouveau signal TikTok auraient ete crees sans necessite.

**A quoi ca sert.** Un test dont un bras envoie vers une page d'offre (LP vers page offres) et l'autre vers le questionnaire (LP vers eligibilite) n'avait aucun evenement commun : seul le bras questionnaire remontait. C'est exactement ce qui est arrive au test `sp-26` de juin 2026, ou le bras `sp-26-dir` est reste a 0,25 % de CTR pendant tout le test, anomalie notee mais jamais diagnostiquee.

⚠️ **Le suffixe `-offres` porte desormais du sens technique.** Une page d'offre nommee autrement (`...-tarifs`, `...-prix`) ne declenchera pas le beacon, et l'absence sera silencieuse. Si un futur test a un bras qui pointe vers une page d'offre, terminer son slug par `-offres`, ou elargir `SPLIT_CTA_RE`.

Rien d'autre ne change dans la procedure d'ajout d'un test : le fichier reste universel, il ne connait aucun test ID, et il n'y a toujours rien a modifier dedans pour un nouveau test.

⚠️ **Dualité de nommage repo ↔ Framer** : dans le repo, le fichier s'appelle `override-cta.tsx` et la fonction exportée `PushDataLayerEvent`. Dans le projet Framer Poppins, le fichier équivalent dans les Code Overrides s'appelle **`Split_CTA_Tracker`** (visible dans le menu "File" du panneau Code Overrides). Quand on guide l'utilisateur côté Framer, dire **`Split_CTA_Tracker`**, pas `override-cta`.

⚠️ **Subtilité Framer** : l'override `onClick` retourné par une fonction Override ne fire pas sur les composants Link/boutons Framer (la navigation native prend le dessus). La solution est d'utiliser `useEffect` (importé depuis `"react"`, pas `"framer"`) pour attacher un event listener natif sur `document` en capture phase (`capture: true`). Cela intercepte le clic avant la navigation.

**Redirect** : chaque test a son `split-redirect.js` avec un bloc `SPLIT_CONFIG` (test ID, cookie name, variants URLs) suivi de la logique generique. Pour creer un nouveau redirect, copier le template `split-api/scripts/split-redirect-template.js` et modifier uniquement `SPLIT_CONFIG`.

### Bridge iframe (pages story)

Les pages story (ex: `asu-triton-story`) embarquent une iframe cross-origin (`poppins-landing-pages.vercel.app`). Un script bridge dans le Custom Code Framer du parent écoute les `postMessage` de l'iframe pour relayer les événements au `dataLayer` (GTM).

⚠️ **Beacon CTA : envoyé par l'iframe, PAS par le bridge parent** — Depuis le 2026-03-25, le beacon `clic_main_cta` est envoyé **directement depuis l'iframe** (`story-landing.html`) via `navigator.sendBeacon()` + fallback `fetch(keepalive)`. L'iframe lit le variant depuis ses query params URL (`split_*` params injectés par le split-redirect script). L'ancienne approche (beacon envoyé par le parent bridge via postMessage hop) sous-comptait les clics dans les navigateurs in-app Instagram/Facebook.

⚠️ **Convention postMessage — action `cta_click_tracked`** : l'iframe envoie `{ event: "poppins_story", action: "cta_click_tracked" }` (pas `"cta_click"`). L'action `_tracked` signifie que le beacon a déjà été envoyé par l'iframe. Le bridge parent NE DOIT PAS envoyer de beacon quand il reçoit cette action — sa condition `e.data.action === "cta_click"` ne matche pas, ce qui empêche le double-comptage. Le dataLayer push fonctionne toujours car la condition d'entrée matche sur `e.data.event === "poppins_story"`.

⚠️ **Règle anti-double-comptage** — L'API `track.js` fait un `redis.incr()` brut sans déduplication — tout beacon supplémentaire = overcounting. Ne jamais ajouter de listener `pagehide` qui appelle `sendCtaBeacon()`. Si un futur bridge doit envoyer un beacon, l'action postMessage doit rester `cta_click` (pas `cta_click_tracked`).

### Ajouter un nouveau test

Utiliser `/deploy-split-test` — la skill pose les questions et modifie automatiquement :
1. `split-api/lib/tests.js` — ajouter l'entrée dans TESTS
2. `split-api/dashboard.html` — ajouter dans l'objet TESTS JS
3. Ce fichier — mettre à jour la table des tests actifs

⚠️ **Attribution par LP — paramètre `?landing=<slug>` hardcodé dans l'URL du bouton CTA** : le snippet redirect ne propage PAS de paramètre `landing` automatiquement. C'est l'**URL du CTA elle-même** qui doit contenir `?landing=<slug>` côté Framer, à coder manuellement page par page (ex: sur `asu-2-qf-b`, le bouton CTA pointe vers `https://www.poppins.io/eligibilite-v5b?landing=asu-2-qf-b`). Ce param sert ensuite à dispatcher les soumissions Typeform par bras dans les scripts d'analyse. À rappeler à l'utilisateur lors de l'étape Framer.

⚠️ **Custom Code Framer = espace de publication séparé** (depuis ~mai 2026) : Framer a séparé la publication du Custom Code du Publish principal du site. Un Save dans l'éditeur Custom Code n'envoie PAS le snippet sur le site live — il faut aussi cliquer le bouton **Publish global du site** (en haut à droite). Symptôme typique d'oubli : `curl https://info.poppins.io/asu-2 | grep SPLIT_CONFIG` ne renvoie rien alors que le Custom Code est "saved". À vérifier en premier si le snippet ne semble pas déployé côté Framer.

⚠️ **Déploiement Vercel = compte Alex Louapre** : le projet Vercel `split-api` est sur le compte d'Alex. Le push GitHub déclenche normalement un auto-deploy via webhook, mais si l'API live ne reflète pas le nouveau test (`{"error":"unknown test"}`), seul Alex peut vérifier/relancer le deploy. Ping Alex avec le hash du commit. Test rapide pour confirmer que c'est bien un problème de deploy (pas de code) : `curl https://split-api-one.vercel.app/api/assign?test=<un-test-déjà-actif>` — si réponse normale + le nouveau test inconnu, c'est le deploy.

### Stopper un test

Procédure quand l'utilisateur demande de couper / arrêter un test :

1. **Dump des stats finales** — `GET /api/stats?test=<id>` (auth Bearer `ADMIN_TOKEN` lu depuis `split-api/.env.local`). Inclure le tableau dans le message de commit pour archive.
2. **Épingler la winner, pas le kill switch** : `POST /api/config?test=<id>` avec `{ "enabled": true, "forcedVariant": "<winner>" }`. ⚠️ **Ne PAS utiliser `{ "enabled": false }` sauf si la winner est `variants[0]`** : `enabled: false` renvoie tout appel restant sur `variants[0]` (cf. `assign.js` ligne 36), c'est-à-dire sur A. Si la winner est B ou C, le kill switch enverrait le trafic résiduel sur la **perdante**. `forcedVariant` est fail-safe dans le bon sens.
3. **Nettoyage du code** :
   - ⚠️ **NE PAS retirer** l'entrée du test dans `split-api/lib/tests.js` — requis pour que `/api/stats` puisse encore lire les données Redis
   - ⚠️ **NE PAS retirer** le bloc du test dans `split-api/dashboard.html` — garder les anciens tests pour consultation historique
   - retirer la ligne du test dans la table des tests actifs de ce fichier
4. **Commit + push auto** (sans demander confirmation), format `Stop split test: <test-id> (winner: <variant> kept, <other> retired)` + stats finales dans le body.

⚠️ **Côté Framer** — informer l'utilisateur qu'il doit retirer le snippet `split-redirect` du discount-test (ou autre) dans le Custom Code de la page d'entrée des ads. **Ne PAS lui demander de changer l'URL des ads ni l'URL du CTA des landings** (cf. contrainte URL d'entrée figée).

⚠️ **Override CTA — ne rien toucher** — l'override `override-cta.tsx` est universel et tolérant. Les vieux cookies `split_<test-retiré>` qui traînent (TTL 30 jours, cf. `split-redirect-template.js` ligne 20) génèrent des requêtes `/api/track` qui répondent `400 Unknown test`. Inoffensif, juste un peu de bruit dans les logs Vercel le temps de l'expiration.

### Passer une winner à 100 % (bascule propre)

Séquence validée le 2026-08-31 sur `ptf-perso` (winner B). **L'ordre est critique** : couper le test en premier enverrait le trafic sur `variants[0]`, donc sur A.

1. **Le contenu d'abord** : porter le contenu de la winner sur l'URL d'entrée des ads (ex: `asu-2`). Confortable, car tant que le snippet est actif l'URL d'entrée est **invisible** (le snippet masque le body en `opacity: 0` puis redirige) : on peut la reconstruire et republier en live sans impacter un seul visiteur.
2. **CTA avec un slug neuf** : `?landing=<slug-de-l-URL-d-entree>` hardcodé dans l'URL du bouton, et **pas** le slug de la variante gagnante. Sinon le trafic post-test se mélange aux soumissions Typeform de la période de test et les chiffres du test ne sont plus relisibles. Penser à ajouter ce slug aux scripts d'analyse (`PROJET_ANALYSE_TYPEFORM_ELIGIBILITY`), sinon le trafic devient invisible dans les analyses.
3. **Désactiver le snippet** : passer l'entrée Custom Code du test en **DISABLED** (convention maison : on désactive, on ne supprime pas), puis **Publish global du site**. Vérif : `/usr/bin/curl -s https://info.poppins.io/<entree> | grep -oE 'SPLIT_CONFIG|GTM-T59MRZ6B'` ne doit plus renvoyer `SPLIT_CONFIG` mais doit **toujours** renvoyer le GTM.
4. **Clôture API** : épingler la winner (cf. étape 2 de "Stopper un test"), commit, push.

⚠️ **Le Custom Code Framer est une liste d'entrées séparées, chacune avec son toggle** (Site Settings → Code), scopées par page. Le GTM vit dans une entrée `GTM + UTM + VWO` (Start of `<head>`, page **All**) distincte des snippets de split : désactiver un split ne touche donc pas au tracking. Ne jamais couper une entrée `All` pour arrêter un test.

⚠️ **Archiver le snippet avant de le désactiver** : celui de `ptf-perso` n'avait jamais été commité, il ne vivait que dans le Custom Code Framer. Vérifier qu'un `split-api/scripts/split-redirect-<test>.js` existe, sinon le récupérer depuis le live avant toute désactivation.

⚠️ **Discontinuité analytics après la bascule** : avant, l'URL d'entrée encaissait tous les pageviews mais redirigeait instantanément, et la page de la variante portait la vraie session. Après, c'est l'inverse : l'URL d'entrée porte la session et la page de la variante **tombe à zéro**. Tout dashboard GTM/GA/Metabase indexé sur le chemin de la variante s'effondre d'un coup. Prévenir qui les lit et les repointer.

⚠️ **Les stats archivées continuent de dériver** après la bascule : les cookies `split_<test>` résiduels (TTL 30 jours) font encore tourner l'override CTA, qui appelle `/api/track`, incrémenté sans déduplication. Les chiffres à retenir sont ceux dumpés au moment de la bascule (archivés dans le message de commit).

### Déploiement = `git push` (auto-deploy GitHub→Vercel)

⚠️ **Le déploiement se fait par `git push` sur `main`, PAS par `vercel --prod`.** Le repo `alexlouapre/ab-testing-tool` est connecté en auto-deploy au projet Vercel `split-api` (Settings → Git, Root Directory = `split-api`). Tout push sur `main` déclenche un build **côté serveurs Vercel** (~8s), indépendant de la connexion locale. C'est donc le `git push` qui met le code en prod, pas seulement une archive.

Après chaque déploiement d'un nouveau test (via `/deploy-split-test` ou modif manuelle de `lib/tests.js` + `dashboard.html` + table des tests actifs), exécuter automatiquement, sans demander confirmation :

```bash
git add -A
git commit -m "Deploy split test: <test-id> (<variants>)"
git push
```

Le message de commit doit inclure le `test-id` et la liste des variantes (ex: `Deploy split test: rtg-mini (A, B)`). Si le déploiement modifie un test existant (kill switch, forced variant, ajout de variante), adapter le verbe : `Update split test: <test-id> — <change>`.

⚠️ **Ne PAS utiliser `vercel --prod`** : depuis une connexion instable, la CLI n'arrive pas à joindre `api.vercel.com` et le déploiement reste coincé en statut **`UNKNOWN`** (build `[0ms]`, jamais exécuté), sans remplacer la prod. C'est exactement ce qui est arrivé à `quickfix-asu-2` le 29/05 (resté non-live 3 jours alors que le code était bon).

**Re-trigger d'un build bloqué / vérif post-deploy** :
- Pour relancer un build coincé : `git commit --allow-empty -m "chore: trigger deploy" && git push`.
- Nettoyer les déploiements UNKNOWN : `vercel remove <deployment-url> --yes` (ne jamais toucher le `● Ready` qui porte l'alias).
- Vérifs : `GET /api/assign?test=<id>` (200 + variante), `GET /api/stats?test=<id>` (Bearer ADMIN_TOKEN), `/dashboard` (grep test id), `vercel ls --prod` (top = `● Ready`).
- ⚠️ Le proxy RTK casse `curl` (`FAILED: curl`) → utiliser **`/usr/bin/curl`** pour les vérifs HTTP.

### URL Vercel par défaut

`split-api-one.vercel.app`

## Tests actifs

| Test | Declare le | Variantes | URLs | Statut |
|---|---|---|---|---|
| `rentree-26-v2` | 2026-09-18 | A, B | A: `info.poppins.io/rentree-26-bofu-dir` · B: `info.poppins.io/rentree-26-bofu-tf` | **actif depuis le 2026-09-21** |
| `bascule-maison` | 2026-11-05 | A (poids 4), B (poids 1) | A: `info.poppins.io/asu-2-bm-a` (Typeform) · B: `info.poppins.io/asu-2-bm-b` (questionnaire maison `start.poppins.io`) | **actif depuis le 2026-11-05 vers 20 h** (95 % / 5 %, puis 90 % / 10 % depuis le 06/11 vers 17 h 20, puis 80 % / 20 % depuis le 09/11 a 17 h 27) |
| `yt-maison` | 2026-11-09 | A (poids 1), B (poids 1) | A: `info.poppins.io/asu-2-yt-a` (Typeform V5) · B: `info.poppins.io/asu-2-yt-b` (questionnaire maison `start.poppins.io/?from=asu-2-yt-b`) | **declare le 2026-11-09, pas encore en ligne** (pages Framer et script sur `asu-2-yt` a faire). But : verifier que le tableau de bord du maison range les parcours YouTube a part de Meta, pas mesurer un ecart. Une semaine. Snippet `split-api/scripts/split-redirect-yt-maison.js` ; cadrage `CADRAGE_SPLIT_YOUTUBE_2026-11-09.md` |

`bascule-maison` : snippet `split-api/scripts/split-redirect-bascule-maison.js`, pose sous l'entree Custom Code `Split bascule-maison` (Start of `<head>`, page `/asu-2`). Publie le 05/11/2026 ; verifie : snippet et GTM en ligne sur asu-2, redirection vers B avec UTM et `fbclid` conserves. Le monitoring du questionnaire maison arme ses alarmes a 20 h 15 (`poppins-eligibility`, `monitoring.config.json`). Le secours sans API (`fallbackRandom`, reponse de l'API au-dela de 2 s ou en erreur) tire avec les poids de `SPLIT_CONFIG.weights` (95/5) depuis le 06/11/2026 vers 1 h, republie dans Framer et verifie en ligne.

⚠️ **Avant le 06/11/2026 vers 1 h, B recevait environ 15 % des visiteurs, pas 5 %** : le secours tirait a 50/50, et le visiteur dont l'API repondait trop tard restait compte en A par `/api/stats` mais atterrissait une fois sur deux sur B. Framer Analytics, 05 et 06/11 : `asu-2-bm-a` environ 1 300 visites, `asu-2-bm-b` 228, alors que `/api/stats` comptait 97 visites B. Consequence : les visites de `/api/stats` sont fausses pour les deux bras sur cette periode (B sous-compte, A sur-compte), donc les taux de clic aussi. Rapporte aux visites Framer, B fait environ 10 % de clics, comme l'historique d'asu-2 (7 a 9 %). Lire le test sur les arrivees reelles (Framer, parcours commences du questionnaire maison), pas sur `/api/stats`.

⚠️ **Regle pour tout futur test a poids inegaux** : le secours du snippet doit tirer avec les memes poids que `lib/tests.js` (copier `weights` et le `fallbackRandom` pondere de `split-redirect-bascule-maison.js`). Le template tire encore a parts egales, ce qui n'est juste que pour un 50/50.

⚠️ **Clics de B non comptes avant le 05/11/2026 vers 20 h 20** : `Split_CTA_Tracker` dans Framer etait reste a l'ancienne version (sans `start.poppins.io` dans `SPLIT_CTA_RE`), alors que `override-cta.tsx` avait ete mis a jour a 17 h. Recopie et publie a 20 h 20, clic sur B verifie. Les 6 clics B comptes entre 19 h 58 et 20 h 12 ne viennent donc pas de la page B (origine inconnue, journaux Vercel chez Alex) ; 2 clics B et 1 clic A de plus sont des verifications de Claude. Ne pas lire le taux de clics de B avant ce soir-la.

**Passage a 20 % pour le bras maison le 09/11/2026** (decision de Hugo) : poids 4 contre 1 dans `lib/tests.js` et dans le script (commit 5e34a4c, outil en ligne a 17 h 24), script colle dans Framer et publie a 17 h 27 (aucun autre changement en attente). `verify-live` tout conforme a 17 h 28 et 17 h 29. Compteurs **non** remis a zero : releve a 17 h 23, totaux A 10 199 tirages, 9 324 arrivees, 1 119 clics, 504 secours ; B 1 116 tirages, 1 116 arrivees, 121 clics, 52 secours. Journee du 09/11 (UTC) jusque-la : A 2 428 tirages, 2 199 arrivees, 258 clics, 124 secours ; B 270 tirages, 245 arrivees, 33 clics, 12 secours. Le 09/11 melange donc les deux parts : lire la periode a 20 % a partir du 10/11.

**Controle du 09/11/2026** : `verify-live` tout conforme. Framer Analytics, 07/11 (visiteurs uniques) : `/asu-2-bm-a` 3,1 K, `/asu-2-bm-b` 357, soit B a environ 10,3 % des deux pages. `/api/stats` du 07/11 (jour UTC) : arrivees A 2 606, B 290 (B 10,0 %), tirages A 2 845, B 316. Framer compte environ 20 % de plus que les arrivees, a part egale dans les deux bras, donc la repartition tient. Secours par jour (UTC) : 07/11 164 sur 3 161 tirages (5,2 %), 08/11 165 sur 3 930 (4,2 %), 09/11 au matin 54 sur 1 151 (4,7 %), a part egale dans les deux bras (07/11 : A 5,3 %, B 4,1 %). Le « 4 sur environ 700 » du releve de 14 h 59 le 06/11 n'etait pas un taux : 3 + 1 secours comptes depuis 14 h 45, rapportes a des tirages comptes depuis 10 h 12. Le niveau normal du secours est donc d'environ 5 % des visites (API au-dela de 2 s ou en erreur) ; il tire aux memes poids, donc ne fausse pas le test.

**Passage a 10 % pour le bras maison le 06/11/2026** (decision de Hugo) : poids 9 contre 1 dans `lib/tests.js` et dans le script (commit f433993, outil en ligne a 17 h 16), script colle dans Framer et publie vers 17 h 20 (avec 3 changements en attente sur `/sp-26`, `/sp-26-offres` et `/sp-26-resub`, publies avec l'accord de Hugo). `verify-live.mjs` : tout conforme. Compteurs **non** remis a zero : releve a 17 h 21, A 294 tirages, 258 arrivees, 28 clics, 19 secours ; B 15 tirages, 18 arrivees, 4 clics, 1 secours (depuis 14 h 59, a 95 / 5). Juste apres une publication, `verify-live` a vu une fois la page B sans compteur de clics (copie pas encore a jour), puis tout conforme une minute plus tard : relancer avant de conclure.

**Compteurs remis a zero une troisieme fois le 06/11/2026 a 14 h 59** (decision de Hugo), pour que visites, clics, arrivees et secours partent du meme moment : le tableau part de la. Releve juste avant : A 680 visites, 66 clics, 13 arrivees, 3 secours ; B 35 visites, 1 clic, 1 arrivee, 1 secours (visites et clics depuis 10 h 12, arrivees et secours depuis 14 h 45).

**Depuis le 06/11/2026 vers 14 h 45** (decision de Hugo, commit ee629ad, publie dans Framer) : les pages de bras envoient leur arrivee (evenement `vue`, une par onglet) et ne comptent un clic que pour leur test et leur bras (`PAGE_TESTS` dans `override-cta.tsx`) ; le script ne tire qu'une fois et signale chaque tirage du secours (evenement `secours`). Le tableau de bord affiche arrivees, clics par arrivee et secours : **lire le taux de clic sur les arrivees, pas sur les visites (tirages)**. **Apres tout changement de parts, de script ou du compteur : `node split-api/scripts/verify-live.mjs bascule-maison`** (lecture seule, refuse tout ecart entre l'outil, le script en ligne et le compteur publie). Changer les parts = `lib/tests.js` ET `weights` du script, coller dans Framer, Publish, puis ce controle.

**Lecture du test a partir du 06/11/2026 a 1 h, heure de Paris (06/11 0 h UTC)** (decision de Hugo du 06/11) : le creneau du 05/11 20 h 15 au 06/11 1 h est ecarte, car B y recevait surtout les visiteurs passes par le secours (connexions lentes), donc pas la meme population que A. Relecture complete de l'outil : `RELECTURE_SPLIT_2026-11-06.md`. Controle Framer du 06/11 : B revenu a 4-5 % des visiteurs depuis 10 h, taux de clic de A revenu a environ 11 %.

**Compteurs remis a zero une deuxieme fois le 06/11/2026 a 10 h 12** (decision de Hugo, `POST /api/reset`), apres la correction du secours : les chiffres du tableau partent de la. Releve juste avant, faux pour les deux bras (secours a 50/50 jusqu'a 1 h) : A 2 613 visites et 75 clics, B 137 visites et 29 clics. Pour la periode du 05/11 20 h 33 au 06/11 10 h 12, lire les arrivees dans Framer Analytics et les parcours dans le dashboard d'Alex.

Premiere remise a zero le 05/11/2026 a 20 h 33 (decision de Hugo, `POST /api/reset`) : les chiffres du tableau partent de la. Releve juste avant : A 293 visites et 7 clics, B 15 visites et 9 clics (dont 2 clics de verification de Claude cote B, 1 cote A). **Toute modification de `override-cta.tsx` se recopie a la main dans `Split_CTA_Tracker`, puis Publish.**

⚠️ **`rentree-26-v2` est le premier test a poser le MEME snippet sur DEUX pages d'entree** : `info.poppins.io/rentree-26-bofu` et `info.poppins.io/sp-26`. Les deux campagnes Meta convergent vers le meme test sans que leurs URL d'ads changent. Le chainage a ete ecarte : il ajoutait un chargement sur du mobile in-app, un point de panne, et le risque qu'une redirection Framer cote serveur perde la query string donc le `fbclid`.

Snippet archive dans `split-api/scripts/split-redirect-rentree-26-v2.js`, pose sous le nom d'entree Custom Code `Split rentree-26-v2`. Motif `ptf-perso` et non le template : aucun bras n'est la page d'entree.

⚠️ **A l'arret du test, penser aux deux pages.** Retirer le snippet d'une seule laisserait la moitie du trafic dans le test.

Verifications de mise en ligne passees le 2026-09-21 : redirection sur les deux entrees, cookie pose, `fbclid` et UTM conserves jusqu'a la page de bras, et **clic compte sur les deux bras**. Ce dernier point valide le correctif `SPLIT_CTA_RE` du 2026-09-18 : c'est exactement ce qui etait casse sur `sp-26-dir` en juin, reste a 0,25 % de CTR pendant tout le test sans diagnostic.

Contexte complet : `POPPINS_GROWTH/PROJET_Roadmap_C3_2026/PROJET_Personnalisation_Funnel_Ads_LP/SOUS_CHANTIERS/RENTREE_26_V2/`.

Avant le 2026-09-18 : aucun test actif depuis le 2026-08-31.

L'URL d'entree des ads `https://info.poppins.io/asu-2` sert desormais directement le contenu de la winner de `ptf-perso` (bras B : CTA vers `eligibilite-v5b-ptf`), sans snippet de redirect. Voir la section "Passer une winner a 100 % (bascule propre)".

Historique des tests : entrees conservees dans `split-api/lib/tests.js` et `split-api/dashboard.html`, stats lisibles via `GET /api/stats?test=<id>`, snippets archives dans `split-api/scripts/`.
