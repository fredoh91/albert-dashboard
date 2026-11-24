# Déploiement Apache (serveur Debian) — option « Express tout-en-un »

Le projet vit **hors du docroot** : `/production/ansm/react/albert-dashboard/`.
Le serveur Express (`server/server.js`) sert **à la fois** le build statique
(`client/dist/`) **et** l'API (`/api/*`). Apache ne fait plus que de la
**façade HTTPS** en reverse-proxy vers Express. La clé ne quitte jamais le
serveur Express (`server/.env`, hors du docroot).

URL publique finale : `https://nam-pgs-2.ansm-intra.fr/albert-dashboard/`

## Architecture

| Brique                          | Rôle                                         | Écoute sur                  |
|---------------------------------|----------------------------------------------|-----------------------------|
| Apache                          | façade HTTPS + reverse-proxy `*` vers Node   | 443 (HTTPS terminé)         |
| Node Express `server.js`        | statique (`client/dist`) **+** API (clé, GET)| `127.0.0.1:3001` (loopback) |
| API Albert                      | upstream `https://albert.api.etalab.gouv.fr` | externe                     |

En dev (local), rien ne change : Vite (5173) proxie `/api` → 3001 et sert le
front depuis sa mémoire ; Express sert aussi le statique de `client/dist`.

## 1. Installation du projet sur le serveur

```bash
# Depuis un dépôt git (ou un transfert du dossier)
mkdir -p /production/ansm/react
cd /production/ansm/react
git clone <url-du-dépôt> albert-dashboard   # ou copier le dossier existant
cd albert-dashboard

node -v          # exiger Node ≥ 18
npm ci           # installe les workspaces server + client

# Configurer la clé API (jamais commitée, jamais dans le docroot)
cp server/.env.example server/.env
chmod 600 server/.env
# → éditer server/.env : ALBERT_API_KEY=sk-...
```

## 2. Compilation (build de production)

```bash
cd /production/ansm/react/albert-dashboard
VITE_BASE_PATH=/albert-dashboard/ npm run build
```

Résultat : `client/dist/` préfixé `/albert-dashboard/` (le `base` Vite fait que
les liens JS/CSS et les appels `/api` sont tous sous `/albert-dashboard/`).

> Sans `VITE_BASE_PATH` (ou sur le poste de dev), le build reste à la racine
> `/` : utile pour `npm start` + `vite preview` en test local.

## 3. Service systemd pour Express (une seule brique)

Fichier `/etc/systemd/system/albert-dashboard.service` :

```ini
[Unit]
Description=Albert Dashboard (Express : statique + API)
After=network-online.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/production/ansm/react/albert-dashboard/server
EnvironmentFile=/production/ansm/react/albert-dashboard/server/.env
# STATIC_DIR et HOST sont facultatifs (défauts inclus dans server.js)
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```

Puis :

```bash
systemctl daemon-reload
systemctl enable --now albert-dashboard
systemctl status albert-dashboard          # doit être "active (running)"
curl -s http://127.0.0.1:3001/             # doit répondre index.html
curl -s http://127.0.0.1:3001/api/me       # JSON (200, ou 401 si clé invalide)
```


## 4. Configuration Apache — PHASE TRANSITOIRE (recommandée au début)

On garde en parallèle le statique servi par Apache (Alias + rsync) et le
`ProxyPass` `/api`. Cette phase permet de tester la bascule sans tout modifier
d'un coup.

```apache
# ./sites-enabled/nam-pgs.ansm-intra.fr.conf — dans le <VirtualHost> *:443
# 4a. Reverse-proxy de l'API vers Express (indispensable dans tous les cas)
ProxyPass        /albert-dashboard/api http://127.0.0.1:3001/api
ProxyPassReverse /albert-dashboard/api http://127.0.0.1:3001/api

# 4b. Statique servi par Apache (copie de client/dist dans le docroot)
Alias /albert-dashboard /production/ansm/react/albert-dashboard/client/dist
<Directory /production/ansm/react/albert-dashboard/client/dist>
    Options -Indexes -MultiViews
    AllowOverride None
    Require all granted
</Directory>
```

Puis :

```bash
apachectl configtest && systemctl reload apache2
# copier le build dans le docroot pour la phase 4b :
rsync -az --delete client/dist/ /production/www/clients/nam-pgs.ansm-intra.fr/home/www/albert-dashboard/
```

> ⚠️ Le `.env` doit rester dans `server/` (hors du docroot). Ne JAMAIS copier
> `server/.env` dans le docroot, sinon la clé serait servie publiquement.

## 5. Configuration Apache — PHASE FINALE « Express tout-en-un »

Express servant désormais statique + API, Apache ne fait plus que du
reverse-proxy généralisé. On **remplace** les 2 blocs de la phase 4 par un
seul ProxyPass :

```apache
ProxyPass        /albert-dashboard/ http://127.0.0.1:3001/
ProxyPassReverse /albert-dashboard/ http://127.0.0.1:3001/
```

Puis :

```bash
apachectl configtest && systemctl reload apache2
```

> La bascule est réversible en 1 ligne : il suffit de repasser sur les 2 blocs
> de la phase 4.

## 6. Mise à jour du dashboard (script fourni)

Le script `deploy-albert.sh` **build + redémarre** le service Express :

```bash
cd /production/ansm/react/albert-dashboard
git pull                                    # ou remplacer les sources
./deploy-albert.sh                          # build préfixé + restart systemd
```

Paramètres utiles :
```bash
USE_RSYNC=1 ./deploy-albert.sh              # + copie rsync vers le docroot (phase transitoire)
DO_NPM_CI=1 ./deploy-albert.sh              # + `npm ci` avant le build
APP_NAME=autre-app BASE_PATH=/autre-app/ PORT=3002 ./deploy-albert.sh  # autre appli
```

## 7. Multi-applications (plusieurs React)

Chaque appli = **son dossier + son port + son unité systemd**, Apache trie par
chemin d'URL :

```
/production/ansm/react/
├── albert-dashboard/   (PORT=3001)
├── autre-appli-react/  (PORT=3002)
└── ...
```

Registre des ports à tenir à jour (ajouter un bloc par appli dans ce fichier) :

| Appli            | Chemin URL          | Port local | Unité systemd            |
|------------------|---------------------|------------|--------------------------|
| albert-dashboard | /albert-dashboard/   | 3001       | albert-dashboard.service |

Vérification qu'un port est libre : `sudo ss -ltnp | grep <port>`.


## Vérifications post-déploiement

```bash
# Statique servi (phase finale : via Apache /albert-dashboard/)
curl -sI https://nam-pgs-2.ansm-intra.fr/albert-dashboard/          # 200
curl -s  https://nam-pgs-2.ansm-intra.fr/albert-dashboard/ | grep -o 'assets/[^"]*'

# API relayée par Express puis Apache (401 si clé invalide, 200 sinon)
curl -s https://nam-pgs-2.ansm-intra.fr/albert-dashboard/api/me

# Aucune fuite : le .env n'est jamais servi
curl -s -o /dev/null -w '%{http_code}\n' \
  https://nam-pgs-2.ansm-intra.fr/albert-dashboard/server/.env        # 404

# Aucune clef dans le build client
grep -r "sk-" client/dist || echo "aucune occurrence (OK)"
```

## Sécurité

- La clé `sk-…` ne vit que dans `server/.env`, hors du docroot, jamais servie.
- Express n'écoute que sur `127.0.0.1` (HOST par défaut) : seul Apache peut lui
  parler ; le port n'est jamais exposé sur le réseau.
- Liste blanche stricte : seuls `usage`, `me`, `keys`, `models`, `limits` ;
  pas de POST/DELETE (405).
- Le fallback SPA ne s'applique jamais aux routes `/api/*` (404 JSON).
- Application destinée à un usage **interne protégé** : ne pas exposer l'URL
  publique sans authentification supplémentaire.

