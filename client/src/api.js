// Fetchers vers le proxy local /api/* — consommation, clefs, modèles, identité.
// Aucune clé API n'apparaît ici : le secret ne circule qu'entre le proxy
// Express et l'API Albert (côté serveur uniquement).

// Préfixe API aligné automatiquement sur le chemin de base du build
// (import.meta.env.BASE_URL) : "/api" en dev, "/albert-dashboard/api" en
// production derrière Apache. Aucune clé API n'est en jeu ici.
const BASE_URL = import.meta.env.BASE_URL || "/";
const API_ROOT = `${BASE_URL}api`;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const HTTP_MESSAGES = {
  401: "Clé API invalide ou refusée (HTTP 401). Vérifiez la clé renseignée dans la configuration du serveur (fichier server/.env).",
  403: "Compte expiré ou accès refusé (HTTP 403).",
  404: "Ressource introuvable (HTTP 404).",
  422: "Requête invalide (HTTP 422) : vérifiez les filtres (période, clé, modèle, endpoint).",
  429: "Quota ou débit dépassé (HTTP 429). Réessayez dans quelques instants.",
  500: "Erreur interne du proxy (HTTP 500).",
  502: "Le proxy ne parvient pas à joindre l'API Albert (HTTP 502).",
  504: "L'API Albert a pris trop de temps pour répondre (HTTP 504).",
};

function extractMessage(status, data) {
  if (data && typeof data === "object") {
    let detail = data.detail ?? data.error ?? data.message;
    if (typeof detail === "object" && detail !== null) detail = JSON.stringify(detail);
    if (typeof detail === "string" && detail.trim() && detail !== "null") return detail;
  }
  if (typeof data === "string" && data.trim()) return data;
  return HTTP_MESSAGES[status] ?? `Erreur HTTP ${status}.`;
}

async function request(path, signal) {
  let res;
  try {
    res = await fetch(path, { signal });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError(
      0,
      "Impossible de joindre le serveur local (proxy). Vérifiez qu'il tourne sur le port 3001."
    );
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) throw new ApiError(res.status, extractMessage(res.status, data));
  return data;
}

// Boucle de pagination offset/limit (usage et keys) tant que la page est pleine.
async function fetchAll(makeSearchParams, signal) {
  const items = [];
  const limit = 100;
  let offset = 0;
  let guard = 0;

  for (;;) {
    if (++guard > 500) break; // garde-fou anti boucle infinie
    const search = makeSearchParams(limit, offset);
    const data = await request(`${API_ROOT}/${search.base}?${search.query}`, signal);
    const rows = Array.isArray(data?.data) ? data.data : [];
    items.push(...rows);
    const total = typeof data?.total === "number" ? data.total : null;
    offset += rows.length;
    if (rows.length < limit) break;
    if (total !== null && offset >= total) break;
  }
  return items;
}

export async function fetchUsage({ startTime, endTime, keyId = "", model = "", endpoint = "", signal } = {}) {
  return fetchAll((limit, offset) => {
    const sp = new URLSearchParams({
      start_time: String(startTime),
      end_time: String(endTime),
      limit: String(limit),
      offset: String(offset),
    });
    if (keyId) sp.set("key_id", keyId);
    if (model) sp.set("model", model);
    if (endpoint) sp.set("endpoint", endpoint);
    return { base: "usage", query: sp.toString() };
  }, signal);
}

export async function fetchKeys({ signal } = {}) {
  return fetchAll(
    (limit, offset) => ({ base: "keys", query: `limit=${limit}&offset=${offset}` }),
    signal
  );
}

export async function fetchModels({ signal } = {}) {
  const data = await request(`${API_ROOT}/models`, signal);
  return Array.isArray(data?.data) ? data.data : [];
}

export async function fetchMe({ signal } = {}) {
  return request(`${API_ROOT}/me`, signal);
}

// Plafonds par routeur (/v1/limits) : {router_id (numérique), model, limits:[{type,value,remaining}]}.
export async function fetchLimits({ signal } = {}) {
  const data = await request(`${API_ROOT}/limits`, signal);
  return Array.isArray(data?.data) ? data.data : [];
}
