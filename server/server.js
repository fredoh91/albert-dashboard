/* ============================================================
 * Albert Dashboard — proxy Express (lecture seule) vers l'API
 * Albert de la DINUM : https://albert.api.etalab.gouv.fr
 *
 * Rôle : relayer les GET /api/{usage,me,keys,models} vers l'API
 * Albert en ajoutant CÔTÉ SERVEUR l'en-tête Authorization.
 * La clé API ne quitte jamais ce processus : elle est lue dans
 * process.env.ALBERT_API_KEY (fichier server/.env via dotenv).
 * ============================================================ */

"use strict";

require("dotenv").config();

const express = require("express");

const PORT = Number(process.env.PORT) || 3001;
const ALBERT_BASE_URL =
  process.env.ALBERT_BASE_URL || "https://albert.api.etalab.gouv.fr/v1";
const API_KEY = process.env.ALBERT_API_KEY;

// Liste blanche stricte : ces endpoints sont les seuls proxifiables.
const ENDPOINTS = ["usage", "me", "keys", "models", "limits"];

const app = express();

/* --- Garde-fous avant tout routage --- */
app.use((req, res, next) => {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Méthode non autorisée : le proxy est en lecture seule (GET uniquement).",
    });
  }
  if (!API_KEY) {
    return res.status(500).json({
      error:
        "ALBERT_API_KEY n'est pas configurée côté serveur. Créez le fichier server/.env (modèle : server/.env.example) puis relancez le proxy.",
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

/* --- 404 pour tout le reste --- */
app.use((req, res) => {
  res.status(404).json({
    error:
      "Route inconnue. Le proxy n'accepte que GET /api/usage, /api/me, /api/keys, /api/models et /api/limits.",
  });
});

/* --- Gestion des erreurs inattendues --- */
app.use((err, req, res, next) => {
  console.error("[proxy] erreur interne :", err);
  res.status(500).json({ error: "Erreur interne du proxy.", detail: err.message });
});

app.listen(PORT, () => {
  console.log(`[proxy] Albert Dashboard — proxy prêt sur http://localhost:${PORT}`);
  if (!API_KEY) {
    console.warn(
      "[proxy] AVERTISSEMENT : ALBERT_API_KEY non définie, le proxy refusera toutes les requêtes (HTTP 500)."
    );
  }
});
