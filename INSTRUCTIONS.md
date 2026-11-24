# Cahier des charges : Application web « Albert Dashboard » (Vite + React + Node)

## Contexte

L'API Albert (https://albert.api.etalab.gouv.fr, DINUM) permet de consulter la consommation de tokens d'un compte via des endpoints REST authentifiés par Bearer token. L'objectif est de générer une petite application web locale, **100 % JavaScript**, qui affiche cette consommation dans un navigateur.

Ce document sert de spécification complète pour un assistant IA (VS Code) : il décrit le projet React à générer, les endpoints à interroger et les contraintes.

## Contraintes techniques essentielles (à respecter impérativement)

1. **CORS** : l'API Albert n'active volontairement pas `Access-Control-Allow-Origin`. Un appel direct depuis le navigateur est bloqué. Il faut donc **un petit serveur Node (proxy)** qui porte la clef API et relaie les requêtes.
2. **Secret** : la clef `sk-...` ne doit apparaître **que côté serveur** (variable d'environnement), jamais dans le bundle React ni dans un `.env` exposé au client (`import.meta.env.VITE_*` est au contraire **interdit** pour la clef).
3. **Architecture monorepo** : un seul dépôt avec deux workspaces :
   - `server/` : proxy Express (JavaScript, CommonJS ou ESM)
   - `client/` : application React générée par Vite (`npm create vite@latest client -- --template react`)

## Endpoints de l'API Albert (référence)

Base URL : `https://albert.api.etalab.gouv.fr/v1`
Authentification : en-tête `Authorization: Bearer <clef>`

| Endpoint | Méthode | Query params | Réponse (extrait) |
|---|---|---|---|
| `/usage` | GET | `start_time` (Unix, requis), `end_time` (Unix, requis), `limit` (1-100, défaut 10), `offset`, `endpoint` (`/v1/chat/completions`, `/v1/embeddings`, `/v1/ocr`, `/v1/rerank`, `/v1/audio/transcriptions`, `/v1/search`), `model`, `key_id` | `{ object, total, offset, limit, data: [{ object:"usage.bucket", start_time, end_time, prompt_tokens, completion_tokens, total_tokens, cost, requests, impacts:{kWh,kgCO2eq} }] }` (buckets **journaliers**) |
| `/me` | GET | - | `{ object:"userInfo", id, email, name, organization_id, expires, limits:[{router_id, type:"rpm"/"rpd"/"tpm"/"tpd", value}] }` |
| `/keys` | GET | `limit`, `offset` (pagination, réponse paginée) | `{ data: [{id, name, ...}] }` |
| `/models` | GET | - | `{ data: [{id:"bge-m3", type, aliases, max_context_length, ...}] }` |

Codes d'erreur : `401` clef invalide, `403` compte expiré, `422` erreur de validation, `429` quota dépassé.

⚠️ Rappels utiles :
- La consommation est comptabilisée **au niveau du compte**, toutes clefs confondues ; le filtre `key_id` permet d'isoler une clef.
- `/v1/me/usage` est **déprécié** : utiliser `/v1/usage`.
- La correspondance `router_id` (dans `limits`) → nom de modèle **n'est pas exposée** par l'API. Prévoir d'afficher les router_id tels quels.
- `/v1/keys` est paginé : boucler sur `offset`/`limit` pour tout récupérer.

## Équivalent PowerShell (comportement de référence)

Le futur dashboard doit reproduire dans le navigateur ce que fait ce script, validé en production :

```powershell
# Votre clé API Albert
$apiKey = "sk-xxxxxxxxxxxxxxxxxxxx"
$H      = @{ "Authorization" = "Bearer $apiKey" }
$BaseUrl = "https://albert.api.etalab.gouv.fr"

# --- Identité du compte (GET /v1/me) ---
$me = Invoke-RestMethod -Uri "$BaseUrl/v1/me" -Headers $H
"Utilisateur : $($me.name) <$($me.email)>"

# --- Clefs API (GET /v1/keys, paginé) ---
$keys = @(); $offset = 0
do {
    $page = Invoke-RestMethod -Uri "$BaseUrl/v1/keys?offset=$offset&limit=100" -Headers $H
    if ($page.data) { $keys += $page.data }
    $offset += 100
} while ($page.data -and ($page.total -gt $offset))

# --- Consommation (GET /v1/usage), 30 derniers jours ---
$endTime   = [int]([DateTimeOffset]::Now.ToUnixTimeSeconds())
$startTime = [int]([DateTimeOffset]::Now.AddDays(-30).ToUnixTimeSeconds())

$response = Invoke-RestMethod -Uri "$BaseUrl/v1/usage?start_time=$startTime&end_time=$endTime&limit=100" -Headers $H

$response.data | ForEach-Object {
    [PSCustomObject]@{
        Date              = (Get-Date "1970-01-01 00:00:00").AddSeconds($_.start_time).ToString("dd/MM/yyyy")
        Prompt_tokens     = $_.prompt_tokens
        Completion_tokens  = $_.completion_tokens
        Total_tokens      = $_.total_tokens
        Requetes          = $_.requests
    }
} | Sort-Object Date | Format-Table -AutoSize

$sumTokens = ($response.data | Measure-Object -Property total_tokens -Sum).Sum
"Total tokens : {0:N0}" -f $sumTokens
```

## Spécification fonctionnelle de l'application

### Page unique composée de :

1. **En-tête** : nom de l'utilisateur (`/me`), id d'organisation, date d'expiration éventuelle du compte.
2. **KPIs** (pour la période sélectionnée) : total tokens consommés, total requêtes, nombre de jours avec activité.
3. **Graphique** : barres « tokens par jour » (buckets journaliers renvoyés par `/usage`). Librairie recommandée : **Recharts**.
4. **Tableau détaillé** : par jour, colonnes Date / Prompt tokens / Completion tokens / Total tokens / Requêtes, avec ligne de totaux. Tri par date décroissante, formatage des nombres en français.
5. **Filtres** :
   - Période : 7 / 30 / 90 / 365 derniers jours (calcul des timestamps Unix côté client).
   - Clef : menu déroulant alimenté par `/keys` (paginé), envoyé comme `key_id` si sélectionné.
   - Modèle : menu déroulant alimenté par `/models`, envoyé comme `model` si sélectionné.
   - (Bonus) Endpoint : menu déroulant (`/v1/chat/completions` etc.), envoyé comme `endpoint`.
6. **Gestion d'erreurs** : bandeau pour 401/403/429/422 avec message clair, état de chargement (skeleton ou spinner).

### Spécification du proxy (`server/`)

- Express minimal, port 3001 par défaut (le dev server Vite tourne sur 5173).
- **Liste blanche stricte** en lecture seule : `usage`, `me`, `keys`, `models`. Rien d'autre ne doit être proxifiable (pas de POST/DELETE)).
- Routes du type `GET /api/usage`, `GET /api/me`, `GET /api/keys`, `GET /api/models` → traduites en `GET https://albert.api.etalab.gouv.fr/v1/<endpoint>`, query string transmis tel quel, en-tête `Authorization` ajouté côté serveur uniquement.
- clef lue depuis `process.env.ALBERT_API_KEY` (fichier `server/.env` avec `dotenv`, ou démarrage avec la variable d'environnement).
- En mode dev : proxy Vite configuré (`server.proxy["/api"]` → `http://localhost:3001`) pour éviter tout problème de CORS entre front et proxy.

### Arborescence attendue

```
albert-dashboard/
├── package.json              # workspaces, scripts: dev (concurrently), start
├── server/
│   ├── package.json
│   ├── .env                  # ALBERT_API_KEY=sk-... (à créer, .gitignore !)
│   ├── .env.example
│   └── server.js
└── client/
    ├── package.json          # vite, react, recharts
    ├── vite.config.js        # dev server + proxy /api -> http://localhost:3001
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js            # fetchers vers /api/* (aucune clef ici)
        └── components/       # Header, KpiCards, UsageChart, UsageTable, Filters
```

### Scripts npm (racine)

- `npm run dev` : démarre le proxy (nodemon) et Vite ensemble, via `concurrently`.
- `npm run build` : build de production du client.
- `npm start` : proxy + `vite preview` (test local du build).

### Qualité / style

- Composants fonctionnels + hooks, aucune classe.
- Style libre (CSS simple ou Tailwind), sobre et administratif, en français.
- Nombre formatés avec `toLocaleString("fr-FR")`, dates avec `toLocaleDateString("fr-FR")`.
- Les timestamps Unix de `/usage` sont en secondes : multiplier par 1000 pour `new Date()`.

## Sécurité

- Ne jamais committer `.env` (l'ajouter au `.gitignore`).
- Application destinée à un usage **local ou réseau interne protégé** : le proxy expose la consommation du compte avec la clef. Ne pas déployer sur Internet sans authentification supplémentaire.

## Critères d'acceptation

1. `npm install` puis `npm run dev` à la racine démarrent proxy + front sans erreur.
2. La page affiche le nom de l'utilisateur, les KPIs, le graphique et le tableau sur 30 jours.
3. Les filtres période / clef / modèle modifient réellement la requête `start_time`/`key_id`/`model` et rechargent les données.
4. Aucune clef API n'est présente dans le code cliente ni dans le build (`grep -r "sk-" client/dist` ne doit rien donner).
5. Une erreur réseau ou une clef invalide affiche un message clair, pas un écran blanc.
