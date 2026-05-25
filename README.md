# Split URL — A/B Testing Tool

Outil de split URL testing leger et serverless. Alternative maison a VWO/Optimizely pour tester des variantes de landing pages avec redirection cote client et tracking des conversions.

## Stack

- **API** : Vercel Serverless Functions (Node.js, ESM)
- **Base de donnees** : Upstash Redis (round-robin atomique + compteurs)
- **Frontend** : Framer (landing pages) + dashboard HTML statique
- **Tracking** : `navigator.sendBeacon` cote client

## Architecture

```
Visiteur → page Framer (custom code Head)
         → script redirect appelle /api/assign
         → Redis round-robin → retourne variante (A, B, C...)
         → redirect vers la bonne URL (ou reste sur place si variante A)
         → cookie split_{test_id} pose pour 30 jours

Clic CTA  → override Framer (useEffect + event listener)
          → sendBeacon vers /api/track
          → Redis incremente le compteur event

Dashboard → /api/stats (auth Bearer)
          → lit les compteurs Redis
          → affiche visiteurs + clics CTA + taux de conversion par variante
```

## Structure du projet

```
split-api/
├── api/
│   ├── assign.js          # Attribution de variante (round-robin atomique)
│   ├── track.js           # Tracking evenements CTA (sendBeacon)
│   ├── stats.js           # Lecture stats (auth Bearer)
│   └── config.js          # Kill switch / forced variant (auth Bearer)
├── lib/
│   └── tests.js           # Source unique de l'objet TESTS
├── scripts/
│   ├── split-redirect-template.js  # Template redirect (a copier par test)
│   └── override-cta.tsx            # Override CTA Framer universel
├── dashboard.html         # Dashboard temps reel
├── vercel.json            # Rewrites + CORS headers
└── package.json
```

## Endpoints API

Base URL : `https://split-api-one.vercel.app`

### `GET /api/assign?test={testId}`

Attribution d'une variante via round-robin atomique Redis.

- Verifie le kill switch / forced variant dans `config:{testId}`
- Incremente un compteur atomique `counter:{testId}`
- Retourne `{ variant: "A", url: "https://..." }`
- Fallback sur variante A en cas d'erreur Redis

### `GET /api/track?test={testId}&variant={id}&event=clic_main_cta`

Tracking d'evenements CTA via `sendBeacon`.

- Incremente `events:{testId}:{variant}:{event}` dans Redis
- CORS ouvert (`*`) pour supporter `sendBeacon` cross-origin
- Evenements autorises : `clic_main_cta`

### `GET /api/stats?test={testId}`

Lecture des stats (visiteurs + events CTA par variante).

- Auth : `Authorization: Bearer {ADMIN_TOKEN}`
- Retourne `{ A: 150, B: 148, C: 152, total: 450, events: { clic_main_cta: { A: 12, B: 18, C: 15 } } }`

### `GET|POST /api/config?test={testId}`

Kill switch et forced variant.

- Auth : `Authorization: Bearer {ADMIN_TOKEN}`
- GET : lit la config actuelle
- POST : met a jour `{ enabled: bool, forcedVariant: "A"|"B"|"C"|null }`
- `enabled: false` → tous les visiteurs recoivent la variante A (arret du test)
- `forcedVariant: "B"` → tous les visiteurs recoivent la variante B

### `GET /dashboard?token={ADMIN_TOKEN}`

Dashboard HTML temps reel avec auto-refresh toutes les 10 secondes. Affiche par variante : nombre de visiteurs, pourcentage de repartition, clics CTA et taux de conversion.

## Integration Framer

### Script redirect (Custom Code > Head)

Chaque page de test a un script redirect dans son Custom Code Head. Le script :

1. Verifie si un cookie `split_{test_id}` existe deja
2. Si oui, redirige vers la variante enregistree
3. Si non, appelle `/api/assign` pour obtenir une variante
4. Pose le cookie et redirige (ou reste sur place pour la variante A)
5. Preserve les query params (fbclid, UTMs) lors de la redirection
6. Safety timeout de 3s + fallback random si l'API est down

Pour creer un nouveau redirect, copier `split-api/scripts/split-redirect-template.js` et modifier uniquement le bloc `SPLIT_CONFIG`.

### Override CTA (Code Override Framer)

Un seul fichier `override-cta.tsx` pour tous les tests et toutes les variantes.

L'override utilise `useEffect` + `document.addEventListener("click", handler, true)` en capture phase pour intercepter les clics sur les liens CTA sortants. Il scanne automatiquement tous les cookies `split_*` et envoie un `sendBeacon` pour chaque test actif.

**Piege Framer** : l'override `onClick` retourne par une fonction Override Framer ne fire pas sur les composants Link/boutons natifs Framer — la navigation prend le dessus immediatement. La solution est d'utiliser un event listener natif sur `document` en capture phase. `useEffect` doit etre importe depuis `"react"`, pas depuis `"framer"` (qui ne l'exporte pas).

## Cles Redis

| Pattern | Description |
|---------|-------------|
| `counter:{testId}` | Compteur round-robin atomique |
| `stats:{testId}:{variant}` | Nombre de visiteurs par variante |
| `events:{testId}:{variant}:{event}` | Compteur d'evenements (ex: clic_main_cta) |
| `config:{testId}` | Config JSON (kill switch, forced variant) |

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | URL de l'instance Upstash Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Token d'authentification Upstash |
| `ADMIN_TOKEN` | Token Bearer pour les endpoints stats et config |

## Ajouter un nouveau test

1. Ajouter l'entree dans `split-api/lib/tests.js` (objet TESTS)
2. Ajouter dans l'objet TESTS JS de `split-api/dashboard.html`
3. Creer les pages dans Framer
4. Copier le template redirect et modifier `SPLIT_CONFIG`
5. Ajouter l'override CTA sur un element de chaque page
6. Deployer sur Vercel

## Reset des compteurs

Pour reinitialiser les compteurs d'un test (ex: `asu-2-tt` avec variantes A, B, C) :

```bash
curl "$UPSTASH_REDIS_REST_URL/pipeline" \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  -d '[
    ["DEL", "events:asu-2-tt:A:clic_main_cta"],
    ["DEL", "events:asu-2-tt:B:clic_main_cta"],
    ["DEL", "events:asu-2-tt:C:clic_main_cta"]
  ]'
```

Pour reset aussi les compteurs de visiteurs, ajouter :
```bash
["DEL", "stats:asu-2-tt:A"],
["DEL", "stats:asu-2-tt:B"],
["DEL", "stats:asu-2-tt:C"],
["DEL", "counter:asu-2-tt"]
```

## Deploiement

```bash
cd split-api
npx vercel --prod
```
