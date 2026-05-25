# Fichiers a modifier pour chaque nouveau test

| Fichier | Ce qu'on ajoute | Format |
|---------|-----------------|--------|
| `split-api/lib/tests.js` | Entree dans `TESTS` | `{ variants: [{ id, url }] }` |
| `split-api/dashboard.html` | Entree dans `TESTS` JS (dans `<script>`) | `{ label, variants: { [id]: { color, url } } }` |
| `CLAUDE.md` | Section tests actifs | Markdown table |

## Fichiers partages (ne pas modifier sauf cas special)

| Fichier | Role |
|---------|------|
| `split-api/scripts/override-cta.tsx` | Override CTA universel — detecte auto les cookies `split_*` |
| `split-api/scripts/split-redirect-template.js` | Template redirect de reference |
