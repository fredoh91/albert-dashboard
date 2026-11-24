# Déploiement Apache (serveur Debian)

Le projet vit **hors du docroot** : `/production/ansm/react/albert-dashboard/`.
Apache n'expose que le build statique `client/dist/` via un `Alias`, et
reverse-proxie `/albert-dashboard/api/*` vers le proxy Node (qui porte la clé).

URL publique finale : `https://nam-pgs-2.ansm-intra.fr/albert-dashboard/`

## Architecture

| Brique                  | Rôle                                          | Écoute sur                  |
|-------------------------|-----------------------------------------------|-----------------------------|
| Apache                  | sert `client/dist` + reverse-proxy `/api`     | 443 (HTTPS terminé)         |
| Node Express `server.js`| proxy API (détient la clé, liste blanche GET) | `127.0.0.1:3001` (loopback) |
| API Albert              | upstream `https://albert.api.etalab.gouv.fr`  | externe                     |

## 1. Installation du projet sur le serveur

```bash
# Depuis un dépôt git (ou un transfert du dossier)
mkdir -p /production/ansm/react
cd /production/ansm/react
git clone <url-du-dépôt> albert-dashboard   # ou copier le dossier existant
cd albert-dashboard

node -v          # exiger Node ≥ 18
npm ci           # installe les workspaces server + client

# Configurer la clé API (jamais commitée)
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

## 3. Configuration Apache (vhost `nam-pgs-2`)

Activer les modules si besoin : `a2enmod proxy proxy_http`.

```apache
# Dans le <VirtualHost> de nam-pgs-2 (priorité aux ProxyPass, avant l'Alias)
ProxyPass        /albert-dashboard/api http://127.0.0.1:3001/api
ProxyPassReverse /albert-dashboard/api http://127.0.0.1:3001/api

# Seul le build statique est servi — jamais server/.env, node_modules, .git
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
```

## 4. Service systemd pour le proxy Node

Fichier `/etc/systemd/system/albert-dashboard.service` :

```ini
[Unit]
Description=Albert Dashboard proxy (Express, clé API)
After=network-online.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/production/ansm/react/albert-dashboard/server
EnvironmentFile=/production/ansm/react/albert-dashboard/server/.env
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
systemctl status albert-dashboard     # doit être "active (running)"
curl -s http://127.0.0.1:3001/api/me # doit répondre 200 JSON
```

## 5. Mise à jour du dashboard

```bash
cd /production/ansm/react/albert-dashboard
git pull                    # ou remplacer les sources
npm ci                      # si les dépendances ont changé
VITE_BASE_PATH=/albert-dashboard/ npm run build
systemctl restart albert-dashboard
```

Le nouveau `client/dist` est servi immédiatement par Apache (pas de redémarrage
Apache nécessaire, uniquement si le vhost change).

## Vérifications post-déploiement

```bash
# Le statique est servi avec les bons préfixes
curl -sI https://nam-pgs-2.ansm-intra.fr/albert-dashboard/          # 200
curl -s  https://nam-pgs-2.ansm-intra.fr/albert-dashboard/index.html | grep -o '/albert-dashboard/assets/[^"]*'

# Le proxy répond (401 si la clé est invalide, 200 sinon)
curl -s https://nam-pgs-2.ansm-intra.fr/albert-dashboard/api/me

# Aucune fuite : la clé ne doit jamais être servie par Apache
curl -s -o /dev/null -w '%{http_code}\n' https://nam-pgs-2.ansm-intra.fr/albert-dashboard/server/.env   # doit donner 404

# Aucune clef dans le build client
grep -r "sk-" client/dist || echo "aucune occurrence (OK)"
```

## Sécurité

- La clé `sk-…` ne vit que dans `server/.env`, hors du docroot, jamais servie.
- Le proxy Node n'écoute que sur `127.0.0.1` (HOST défini par défaut) : seul
  Apache peut lui parler.
- Application destinée à un usage **interne protégé** : ne pas exposer
  l'URL publique sans authentification supplémentaire.
