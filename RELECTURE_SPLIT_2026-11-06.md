# Relecture critique de l'outil de split (06/11/2026)

Demande de Hugo : vérifier le code et le process de l'outil après le bug du secours à 50/50. Relecture seule, aucun changement de code.

Méthode : 4 relecteurs en parallèle (script de redirection, compteur de clics, serveur, process), puis un contre-relecteur chargé de contester la synthèse, et une expérience qui rejoue le script dans Chromium avec une fausse API lente (aucun appel à l'outil en ligne). Les points marqués « vérifié » ont été relus dans le code, dans les pages en ligne ou dans l'historique git.

## Ce qui va bien (vérifié)

- Le script en ligne sur asu-2 est identique au dépôt (poids 19/1). Le compteur de clics publié dans Framer est identique à `override-cta.tsx`.
- Les pages A et B ont exactement le même texte. Seul le lien du bouton change. Les 3 boutons de chaque page sont bien reconnus par le compteur.
- `fbclid` et UTM sont conservés jusqu'à la page du bras. Un cookie de bras inconnu est bien remplacé.
- Le double tirage du secours ne change pas la répartition, et le cookie correspond toujours à la page affichée (expérience : 1 000 essais, 5,5 % de B).

## 1. Ce qui peut fausser la décision du test bascule-maison

**1.1 Avant le 06/11 vers 1 h, la population de B n'était pas comparable à celle de A (déduit, fort).**
Le secours se déclenche pour les visiteurs dont la réponse arrive après 2 s : téléphones lents, 4G faible, navigateur intégré chargé. Tant qu'il tirait à 50/50, environ 3 visiteurs de B sur 4 venaient du secours, contre environ 1 sur 8 pour A. B n'avait donc pas le même profil de parents que A, ce qui peut fausser la conversion et la LTV par lead. Depuis la correction, le tirage ne dépend plus du profil.
Proposition : sortir de la lecture le créneau du 05/11 20 h 15 au 06/11 1 h, ou au moins le montrer à part.

**1.2 Le nombre de visites par bras de `/api/stats` n'est pas un bon dénominateur (vérifié dans le code).**
L'outil compte un tirage au moment où il le fait, pas l'arrivée sur la page du bras. Un tirage fait pour un visiteur parti pendant la page blanche, ou dont le navigateur a tiré lui-même, est quand même compté. Côté Typeform, il n'existe pas de ligne par visite : si la « conversion de bout en bout » se calcule avec ce dénominateur, elle hérite de ses erreurs.
Proposition : compter l'arrivée sur la page du bras (un signal « vue » envoyé par la page, avec son bras), dans la même source que les clics.

**1.3 Les arrivées sans tirage entrent dans les données du bras (mécanisme vérifié, volume inconnu).**
En aval, le bras se lit sur la page (`landing=asu-2-bm-a`, `from=asu-2-bm-b`), pas sur le cookie. Un lien partagé, une visite de l'équipe qui va jusqu'au bout, ou une pub qui pointerait directement vers une page de bras comptent donc comme du trafic tiré au sort.
Proposition : regarder la part de leads de B sans `fbclid` ni UTM ; vérifier dans Meta qu'aucune pub ne pointe vers asu-2-bm-*.

**1.4 Parents tirés deux fois (établi pour Safari, supposé pour les navigateurs intégrés Meta).**
Le cookie est posé en JavaScript : Safari le limite à 7 jours, et chaque navigateur intégré (Instagram, Facebook) a ses propres cookies. Un parent qui revient par un autre chemin est re-tiré. À 95/5, environ 1 cas sur 10 change de bras.
Proposition : dédoublonner par email entre la base Typeform et la base maison, en gardant le premier bras.

## 2. Ce qui fausse les chiffres de suivi (`/api/stats`, taux de clic)

- **Visites et clics ne comptent pas les mêmes personnes (vérifié).** La visite n'est comptée qu'au premier tirage. Le clic est compté à chaque chargement de page, y compris pour un parent qui revient avec son cookie ou qui recharge la page. Le stock de cookies B de la soirée du 05/11 (environ 230 parents) gonfle les clics B pendant 30 jours.
- **Le pourcentage par bras affiché est exact par construction (vérifié).** L'outil distribue les bras à tour de rôle (B au 20e, 40e tirage…). Le tableau affichera toujours 5 % de B, même si les vrais visiteurs sont répartis autrement. C'est ce qui a masqué le bug du 05/11.
- **Le taux de clic de A est 2 à 3 fois sous son historique, même après la correction (vérifié, cause inconnue).** A : 41 clics pour 1 040 tirages (3,9 %) entre 1 h et 10 h 12 le 06/11, contre 7 à 10 % sur les anciens tests d'asu-2. Le secours n'explique pas ce creux. À comparer avec les départs réels vers le Typeform (`landing=asu-2-bm-a`).
- **Clics croisés entre tests (vérifié).** Le compteur de clics envoie un signal pour chaque cookie `split_*` présent, et il tourne aussi sur rentree-26-bofu-dir et -tf. Un parent B de bascule-maison qui clique sur une autre landing ajoute un clic B.
- **L'adresse qui compte les clics est ouverte à tous (vérifié).** N'importe qui peut ajouter un clic. Les 6 clics B d'origine inconnue du 05/11 viennent peut-être de là.
- **Jours en UTC (vérifié).** La journée de l'outil change à 1 h, heure de Paris.

## 3. Hygiène et risques pour les prochaines étapes

- **Changer les parts (10 % le 16/11, puis 50/50 le 19/11) ou arrêter le test (vérifié).** Les poids sont écrits à deux endroits : dans l'outil et dans le script Framer. Changer l'un sans l'autre recrée le bug du 05/11. Le coupe-circuit et le bras forcé ne concernent pas les parents déjà tirés (cookie de 30 jours), ni le secours. Envoyer `{forcedVariant: null}` réactive aussi un test coupé.
- **Panne de Redis ou quota Upstash dépassé (vérifié dans le code).** Tous les nouveaux visiteurs partent en A, sans être comptés, et gardent A 30 jours. Rien ne le signale.
- **Latence (vérifié).** La fonction tourne à Washington (iad1) et enchaîne 3 appels à Redis. Les visiteurs en secours voient 2 s de page blanche. Perte égale dans les deux bras.
- **Double tirage du secours (observé dans Chromium).** Il est sans effet sur la répartition, mais c'est fragile, et Safari n'a pas été testé.
- **Process (vérifié).**
  - La skill de déploiement ne demande pas les parts.
  - Le template tire à parts égales.
  - La check-list ne vérifie ni Framer, ni le lien des boutons, ni le Publish.
  - La skill dit de lancer `vercel --prod`, ce que le CLAUDE.md interdit.
  - `test-e2e.mjs` force des bras sur le vrai trafic s'il est lancé sur un test actif.
  - `test-browser.mjs` est codé pour un ancien test et se déclare réussi sans avoir vu le signal de clic.
  - Il existe deux outils de remise à zéro qui ne font pas la même chose.
  - `config/tests.json` n'est lu par aucun code.
  - Aucun contrôle à J+1 contre une source indépendante.
- **Jeton admin dans l'URL du tableau de bord (vérifié).**

## Contrôles possibles sans toucher au code

1. Framer Analytics : la part de asu-2-bm-b depuis le 06/11 à 1 h. Si elle est vers 5 %, l'explication du secours tient. Si elle reste vers 15 %, il y a autre chose.
2. Clics contre départs réels par bras : parcours maison commencés avec `from=asu-2-bm-b`, vues du Typeform avec `landing=asu-2-bm-a`.
3. Part des leads de B sans `fbclid` ni UTM, avant et après 1 h.
4. Région et quota Upstash dans sa console.

## Résultat des contrôles (06/11, relevé à 11 h 26)

- Framer Analytics (visiteurs uniques, heure de Paris) : part de asu-2-bm-b 17 % de 0 h à 1 h (avant la correction), 10 % de 1 h à 10 h, 4 à 5 % depuis 10 h (A 178, B 8). La correction marche. Le surplus de 1 h à 10 h vient probablement des parents tirés B dans la nuit, qui gardent leur cookie (déduit).
- Taux de clic de A depuis la remise à zéro de 10 h 12 : 19 clics pour 134 tirages, environ 11 % sur les visiteurs Framer, dans l'historique d'asu-2. Le creux de la nuit venait des visites mal comptées, pas du comptage des clics.
- B : 7 tirages, 0 clic, trop peu pour lire.
- Départs réels vers chaque questionnaire : non mesurables depuis le poste de Hugo (Typeform n'enregistre que les fins, les parcours maison commencés sont dans le dashboard d'Alex).
- Décision de Hugo (06/11) : le test se lit à partir du 06/11 à 1 h, heure de Paris.

## Changements faits le 06/11 (Hugo : « fais-le maintenant »)

Commit ee629ad, publié dans Framer vers 14 h 45, contrôlé en ligne (`verify-live.mjs` : tout conforme).
- Arrivée comptée par la page du bras (`vue`), clic compté pour le test et le bras de la page ; un ancien cookie n'ajoute plus de clic depuis une autre landing.
- Script : un seul tirage par visite, chaque tirage du secours signalé (`secours`), pas de cache.
- Serveur : configuration et compteur lus en un seul aller-retour vers Redis, `no-store`.
- Tableau de bord : arrivées, clics par arrivée, secours.
- `scripts/verify-live.mjs` : contrôle en lecture seule que le script en ligne, ses poids et le compteur publié correspondent au dépôt. Les poids restent écrits à deux endroits (l'outil et le secours du script, qui doit pouvoir tirer quand l'outil ne répond pas), mais ce contrôle refuse tout écart.
- Testé : fausse base Redis (95/5, coupe-circuit, bras forcé), compteur dans une page simulée, script dans Chromium avec une fausse API lente (11 cas, 1 000 tirages : 4,9 % de B). Premières arrivées et premiers secours vus en ligne à 14 h 52.

Non fait : fonction Vercel en Europe (région Upstash à vérifier d'abord), jetons dans l'URL du tableau de bord, skill et template de déploiement, `test-e2e.mjs`, `config.js`.

## Changements de code possibles (à décider avec Hugo)

| Changement | Pourquoi | Quand |
|---|---|---|
| Signal « vue » envoyé par la page du bras, clic compté seulement pour le test de la page, clics dédoublonnés par visiteur | Un vrai dénominateur, mêmes personnes au numérateur et au dénominateur | Avant la montée à 10 % le 16/11 |
| Drapeau « déjà décidé » dans le script, et marque du secours dans l'adresse (`split_src=fb`) | Un seul tirage, et la part du secours mesurée | Avec le point précédent |
| Fonction en Europe (`cdg1`), un seul aller-retour vers Redis, `no-store` | Moins de page blanche et moins de secours | Avec le point précédent |
| Poids lus depuis l'outil par le script (une seule source), procédure écrite « changer les parts » et « arrêter » | Ne pas recréer le bug du 05/11 à la montée | Avant le 16/11 |
| Process : skill et template avec les parts, script `verify-live` (en ligne = dépôt), contrôle Framer à J+1, `test-e2e` interdit sur un test actif, `config.js` qui ne touche que le champ envoyé, nettoyage des scripts | Hygiène | Après |
