/* ============================================================
 * Albert Dashboard — serveur Express « tout-en-un »
 *  - API     : relais GET /api/{usage,me,keys,models,limits} vers l'API
 *              Albert (DINUM) en ajoutant CÔTÉ SERVEUR l'en-tête
 *              Authorization. Seuls ces endpoints sont proxifiables.
 *  - Statique : sert le build client (client/dist) + fallback SPA.
 * La clé API ne quitte jamais ce processus : elle est lue dans
 * process.env.ALBERT_API_KEY (fichier server/.env via dotenv).
 * ============================================================ */

"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");

const PORT = Number(process.env.PORT) || 3001;
// En production, le serveur ne doit être joignable que par Apache : écoute en
// boucle locale uniquement (HOST surchargeable via l'environnement systemd).
const HOST = process.env.HOST || "127.0.0.1";
const ALBERT_BASE_URL =
  process.env.ALBERT_BASE_URL || "https://albert.api.etalab.gouv.fr/v1";
const API_KEY = process.env.ALBERT_API_KEY;

// Build React servi par Express (option « tout-en-un »). STATIC_DIR permet de
// pointer vers un autre emplacement en production sans modifier le code.
const STATIC_DIR =
  process.env.STATIC_DIR || path.resolve(__dirname, "..", "client", "dist");

// Liste blanche stricte : ces endpoints sont les seuls proxifiables.
const ENDPOINTS = ["usage", "me", "keys", "models", "limits"];

const app = express();

/* --- 1. Statique : sert le build client (index.html, assets/…) ---
 * Express serveur de fichiers : ne traite que GET/HEAD et ne touche jamais
 * /api ; les autres méthodes lui passent simplement. */
app.use(express.static(STATIC_DIR));

/* --- 2. Garde-fous APPLIQUÉS AUX SEULES ROUTES /api/* ---
 * (le statique doit être accessible même si la clé manque) */
app.use("/api", (req, res, next) => {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Méthode non autorisée : le serveur est en lecture seule (GET uniquement).",
    });
  }
  if (!API_KEY) {
    return res.status(500).json({
      error:
        "ALBERT_API_KEY n'est pas configurée côté serveur. Créez le fichier server/.env (modèle : server/.env.example) puis relancez le serveur.",
    });
  }
  next();
});

/* --- Transmet la query string brute, sans la décoder (start_time, endpoint=%2Fv1%2F...) */
function rawQuery(req) {
  const idx = req.originalUrl.indexOf("?");
  return idx === -1 ? "" : req.originalUrl.slice(idx + 1);
}

async function proxyToAlbert(endpoint, queryString, res) {
  const url = `${ALBERT_BASE_URL}/${endpoint}${queryString ? `?${queryString}` : ""}`;
  console.log(`[proxy] GET ${url}`);

  let upstream;
  try {
    upstream = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
    });
  } catch (err) {
    console.error("[proxy] erreur réseau :", err.message);
    return res.status(502).json({
      error: "Le proxy ne parvient pas à joindre l'API Albert.",
      detail: err.message,
    });
  }

  const text = await upstream.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {
      error: `Réponse non-JSON reçue de l'API Albert (HTTP ${upstream.status}).`,
      raw: text.slice(0, 500),
    };
  }

  // Statut et corps transmis tels quels (401, 403, 422, 429…)
  return res.status(upstream.status).send(body);
}

/* --- Routage : uniquement les endpoints de la liste blanche --- */
for (const endpoint of ENDPOINTS) {
  app.get(`/api/${endpoint}`, (req, res) => {
    proxyToAlbert(endpoint, rawQuery(req), res);
  });
}

/* --- 3. /api inconnue → 404 JSON (jamais le fallback SPA) --- */
app.use("/api", (req, res) => {
  res.status(404).json({
    error:
      "Route inconnue. Le serveur n'accepte que GET /api/usage, /api/me, /api/keys, /api/models et /api/limits.",
  });
});

/* --- 4. Fallback SPA : toute autre requête GET reçoit index.html --- */
app.use((req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Méthode non autorisée : le serveur est en lecture seule (GET uniquement).",
    });
  }
  const indexFile = path.join(STATIC_DIR, "index.html");
  if (!fs.existsSync(indexFile)) {
    return res.status(404).json({
      error:
        "Build client introuvable (client/dist absent). Lancez `npm run build` (ou `VITE_BASE_PATH=/albert-dashboard/ npm run build` en production) puis redémarrez le serveur.",
    });
  }
  res.sendFile(indexFile);
});

/* --- Gestion des erreurs inattendues --- */
app.use((err, req, res, next) => {
  console.error("[server] erreur interne :", err);
  res.status(500).json({ error: "Erreur interne du serveur.", detail: err.message });
});

app.listen(PORT, HOST, () => {
  console.log(`[server] Albert Dashboard — serveur prêt sur http://${HOST}:${PORT}`);
  console.log(`[server] statique servi depuis : ${STATIC_DIR}`);
  if (!API_KEY) {
    console.warn(
      "[server] AVERTISSEMENT : ALBERT_API_KEY non définie, les routes /api refuseront les requêtes (HTTP 500)."
    );
  }
});
