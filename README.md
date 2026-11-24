# Albert Dashboard

Tableau de bord local de la consommation de tokens de l'API **Albert** (DINUM, `https://albert.api.etalab.gouv.fr`).

Monorepo 100 % JavaScript composé de deux workspaces npm :

- `server/` — proxy **Express** (lecture seule) qui porte la clé API et relaie
  les requêtes vers l'API Albert (règle le blocage CORS).
- `client/` — application **Vite + React + Recharts** qui interroge le proxy.

```
albert-dashboard/
├── package.json          # workspaces, scripts dev / build / start
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── .env              # ALBERT_API_KEY=sk-... (à créer, jamais commité)
│   └── server.js         # Proxy Express
└── client/
    ├── package.json
    ├── vite.config.js    # proxy /api -> http://localhost:3001
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js        # fetchers vers /api/* (aucune clé ici)
        ├── format.js     # formatage fr-FR
        └── components/   # Header, KpiCards, UsageChart, UsageTable, Filters
```

## Prérequis

- Node.js ≥ 18 (le `fetch` natif est utilisé côté serveur).

## Installation

```bash
npm install
```

## Configuration de la clé API

1. Copier `server/.env.example` vers `server/.env`.
2. Coller votre clé dans `server/.env` : `ALBERT_API_KEY=sk-...`

La clé ne doit **jamais** être commitée (exclue par le `.gitignore`) ni
apparaître dans le bundle React : elle ne circule qu'entre le proxy et l'API.

## Démarrage

| Commande        | Effet                                        |
|-----------------|----------------------------------------------|
| `npm run dev`   | proxy via nodemon (`:3001`) + Vite dev (`:5173`) |
| `npm run build` | build de production du client                |
| `npm start`     | proxy (`:3001`) + `vite preview` (`:4173`)   |

## Fonctionnalités

- Identité du compte (`/v1/me`) : nom, courriel, organisation, expiration.
- KPIs : tokens consommés, requêtes, jours avec activité, coût estimé.
- Graphique « tokens par jour » (barres empilées prompt + complétion, Recharts).
- Tableau détaillé par jour (tri décroissant, ligne de totaux, formatage fr-FR).
- Filtres : période (7 / 30 / 90 / 365 jours), clé (`/v1/keys`, paginé),
  modèle (`/v1/models`), endpoint (bonus).
- Bandeaux d'erreur clairs (401 / 403 / 422 / 429…) et états de chargement.

## Sécurité

Application destinée à un usage **local ou réseau interne protégé**. Le proxy
expose la consommation du compte avec la clé API : ne pas déployer sur Internet
sans ajouter un niveau d'authentification supplémentaire.
