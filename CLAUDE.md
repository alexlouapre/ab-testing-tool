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

| Test ID | Date | Variantes | URLs | Statut |
|---------|------|-----------|------|--------|
| asu-2-tt | 2026-03-17 | A, B, C | asu-2-tt, asu-triton-classic, asu-triton-story | actif |
