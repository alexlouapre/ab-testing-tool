# AB Testing Tool — Split URL

## Architecture

API serverless Vercel (`split-api/`) avec Upstash Redis pour le round-robin et le tracking.

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

### Git auto-commit après déploiement d'un test

Après chaque déploiement réussi d'un nouveau test (via `/deploy-split-test` ou modification manuelle de `lib/tests.js` + `dashboard.html` + table des tests actifs), exécuter automatiquement, sans demander confirmation :

```bash
git add -A
git commit -m "Deploy split test: <test-id> (<variants>)"
git push
```

Le message de commit doit inclure le `test-id` et la liste des variantes (ex: `Deploy split test: rtg-mini (A, B)`). Si le déploiement modifie un test existant (kill switch, forced variant, ajout de variante), adapter le verbe : `Update split test: <test-id> — <change>`.

### URL Vercel par défaut

`split-api-one.vercel.app`

## Tests actifs

| Test ID | Date | Variantes | URLs | Statut |
|---------|------|-----------|------|--------|
| asu-2-tt | 2026-03-17 | A, B, C | asu-2-tt, asu-triton-classic, asu-triton-story | actif |
| triton-meta | 2026-03-23 | A, B, C | asu-2, asu-triton-meta-verb, asu-triton-meta-story | actif |
| rtg-mini | 2026-03-31 | A, B | rtg-1, rtg-2 | actif |
| discount-test | 2026-04-20 | A, B | asu-2, asu-2-nd | actif |
