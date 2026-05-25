---
name: deploy-split-test
description: Deploie un nouveau test A/B split URL — utiliser quand l'utilisateur veut creer, configurer ou deployer un nouveau test de split URL, ou quand il mentionne ajouter des variantes/branches a tester, creer un AB test, ou lancer un split test
disable-model-invocation: true
argument-hint: "[test-id]"
---

# Deploy Split URL Test

Cette skill automatise le deploiement d'un nouveau test A/B split URL. Elle modifie les fichiers backend, genere le snippet redirect Framer pre-rempli, et guide le deploiement + verification E2E.

## Rappel conventions

Avant de commencer, rappeler ces 3 regles a l'utilisateur :

1. **Cookie naming** : test ID `my-test` → cookie `split_my_test` (tirets → underscores, prefixe `split_`)
2. **Variante A = page source** : c'est la page qui heberge le redirect script. Si le visiteur est assigne a A, il reste sur place. Si B ou C, il est redirige.
3. **CTA override universel** : le fichier `split-api/scripts/override-cta.tsx` scanne automatiquement tous les cookies `split_*` — il n'y a rien a generer ni modifier pour le CTA.
4. **Pages story (iframe)** : les pages story embarquent une iframe cross-origin (`poppins-landing-pages.vercel.app`) qui ne peut pas lire les cookies split. Un bridge script dans le Custom Code du parent est necessaire pour relayer les clics CTA via postMessage → sendBeacon. Sans ce bridge, le compteur CTA reste bloque a 0.

## Etape 1 — Collecte d'infos

Si `$ARGUMENTS` contient un test ID, l'utiliser directement. Sinon, poser la question.

Poser ces questions a l'utilisateur (proposer des valeurs par defaut sensees) :

1. **Nom/ID du test** (ex: `landing-v3`) — sera le testId. Rappeler : pas d'underscores (convention cookie).
2. **Label du test pour le dashboard** (ex: `Landing V3`) — texte libre affiche dans le dashboard
3. **Combien de variantes ?** (2, 3, ou +)
4. **Pour chaque variante** : ID (A, B, C...) + URL complete
5. **Quelle variante est la page "source"** (celle qui reste sur place, typiquement A) ?
6. **Cookie name** — suggestion auto : `split_` + testId avec tirets remplacés par underscores
7. **URL Vercel** — defaut: `split-api-one.vercel.app`, proposer de changer si besoin
8. **Pages story (iframe)** — Est-ce qu'une ou plusieurs variantes sont des pages "story" avec iframe Poppins ? Si oui, lesquelles ? (Ces pages necessitent un bridge script supplementaire pour le tracking CTA)

**Attendre les reponses avant de continuer.**

## Etape 2 — Mise a jour des fichiers backend

### 2a. `split-api/lib/tests.js`

Lire le fichier, ajouter la nouvelle entree dans l'objet `TESTS` :

```js
"{{TEST_ID}}": {
  variants: [
    { id: "A", url: "{{URL_A}}" },
    { id: "B", url: "{{URL_B}}" },
    // ... autant que necessaire
  ],
},
```

### 2b. `split-api/dashboard.html`

Dans la balise `<script>`, ajouter l'entree dans l'objet `TESTS` JavaScript.

Palette couleurs dans l'ordre : `#4facfe`, `#43e97b`, `#fa709a`, `#f5576c`, `#a18cd1`, `#fccb90`, `#84fab0`.

```js
"{{TEST_ID}}": {
  label: "{{LABEL}}",
  variants: {
    A: { color: "#4facfe", url: "{{URL_A}}" },
    B: { color: "#43e97b", url: "{{URL_B}}" },
    // ...
  }
},
```

### 2c. Checkpoint — Demander confirmation

Apres avoir modifie les deux fichiers, afficher un resume clair :

```
## Resume des modifications

**Test ID** : {{TEST_ID}}
**Cookie** : {{COOKIE_NAME}}
**Label dashboard** : {{LABEL}}
**Variantes** :
- A : {{URL_A}} (source)
- B : {{URL_B}}
- C : {{URL_C}} (si applicable)

Fichiers modifies :
- split-api/lib/tests.js ✓
- split-api/dashboard.html ✓

Tout est correct ? (oui/non)
```

**Attendre la confirmation avant de continuer.** Si non, corriger et re-afficher.

## Etape 3 — Generation snippet redirect Framer

Lire le fichier template `split-api/scripts/split-redirect-template.js`, puis generer le snippet **pre-rempli** avec les vraies valeurs du test. Ne pas afficher le template brut avec `CHANGE_ME`.

Afficher le snippet complet pret a copier-coller :

```
## Snippet redirect — a coller dans Framer > Page source > Custom Code > Head

(snippet avec SPLIT_CONFIG pre-rempli)
```

Le snippet doit avoir le bloc `SPLIT_CONFIG` rempli avec les valeurs reelles :
```js
var SPLIT_CONFIG = {
  test: "{{TEST_ID}}",
  cookie: "{{COOKIE_NAME}}",
  variants: {
    A: "{{URL_A}}",
    B: "{{URL_B}}",
    // ...
  }
};
```

Le reste du script (logique redirect) est identique au template, ne pas le modifier.

## Etape 3b — Generation bridge story (si applicable)

**Cette etape ne s'applique que si une ou plusieurs variantes sont des pages story (iframe Poppins).**

Pour chaque page story identifiee a l'etape 1 :

1. Lire le fichier template `split-api/scripts/story-page-bridge-template.js`
2. Generer le snippet **pre-rempli** en remplacant les `CHANGE_ME` :
   - `COOKIE_NAME` → `{{COOKIE_NAME}}` (ex: `split_triton_meta`)
   - `TEST_ID` → `{{TEST_ID}}` (ex: `triton-meta`)
   - `params: { CHANGE_ME: variant }` → `params: { {{COOKIE_NAME}}: variant }`
3. Sauvegarder le fichier dans `split-api/scripts/story-page-bridge-{{SLUG_PAGE_STORY}}.js`
4. Afficher le snippet complet pret a copier-coller :

```
## Bridge story — a coller dans Framer > Page story ({{URL_PAGE_STORY}}) > Custom Code > Start of head tag

(snippet bridge pre-rempli)
```

**Important** : le bridge doit etre dans "Start of `<head>` tag" pour que le listener soit en place avant le chargement de l'iframe.

## Etape 4 — Documentation

Mettre a jour `CLAUDE.md` a la racine du projet. Ajouter une ligne dans la table "Tests actifs" :

```markdown
| {{TEST_ID}} | {{DATE}} | {{VARIANT_IDS}} | {{URLS}} | actif |
```

## Etape 5 — Deploiement backend

Dire a l'utilisateur de deployer maintenant :

```
## Deploiement

Lance le deploiement backend :
  vercel --prod

Ou push sur git si le deploy est automatique.
Dis-moi quand c'est fait pour lancer le test E2E.
```

**Attendre que l'utilisateur confirme le deploiement avant de continuer.**

## Etape 6 — Test E2E automatique

Lancer le test E2E :

```bash
node split-api/scripts/test-e2e.mjs {{TEST_ID}} {{VARIANT_IDS_CSV}} {{DEPLOY_URL}}
```

- `{{TEST_ID}}` : l'ID du test (ex: `landing-v3`)
- `{{VARIANT_IDS_CSV}}` : les IDs de variantes separes par des virgules (ex: `A,B` ou `A,B,C`)
- `{{DEPLOY_URL}}` : le host Vercel (ex: `split-api-one.vercel.app`)

### Si PASS

Confirmer que le pipeline E2E est valide pour toutes les variantes, afficher le tableau recap, et passer a l'etape suivante.

### Si FAIL

Ne PAS continuer. Proposer des pistes de debug :
- Verifier que le deploy est bien passe (le code pousse correspond bien aux modifications)
- Checker les logs Vercel : `vercel logs`
- Verifier que `.env.local` contient bien `ADMIN_TOKEN` et `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- Re-essayer apres fix

## Etape 7 — Checklist Framer (actions manuelles)

Les items API (assign, track, stats) sont deja valides par le E2E. Ne rester que les actions manuelles Framer :

```
## TODO — Mise en place Framer pour {{TEST_ID}}

### Page source (variante A)
- [ ] Coller le snippet redirect (etape 3) dans **Framer > Page source > Custom Code > Head**
  - Le snippet est deja pre-rempli, copier-coller tel quel

### Pages story — bridge iframe (si applicable)
- [ ] Pour chaque page story : coller le bridge script (etape 3b) dans **Framer > Page story > Custom Code > Start of head tag**
  - Le snippet est deja pre-rempli, copier-coller tel quel
  - Sans ce bridge, le compteur CTA de la variante story restera bloque a 0

### Override CTA (toutes les pages variantes)
- [ ] Verifier que l'override `PushDataLayerEvent` de `split-api/scripts/override-cta.tsx` est applique sur le bouton CTA de chaque page variante (A, B, C...)
  - Si c'est un nouveau projet Framer : copier le code dans les Code Overrides Framer
  - Si l'override est deja en place sur le projet : rien a faire

### Verification finale
- [ ] Ouvrir la page source en navigation privee → verifier la redirection vers une variante
- [ ] Verifier que le cookie `{{COOKIE_NAME}}` est bien pose (DevTools > Application > Cookies)
- [ ] Cliquer sur le CTA → verifier dans le dashboard que l'evenement remonte
  - Dashboard : https://{{DEPLOY_URL}}/dashboard.html
```
