// Série de consommation journalière « continue » : un emplacement = un jour.
// L'API /usage ne renvoie qu'un bucket par jour AU CONTENU, les journées sans
// activité étant absentes. Cette fonction recompose la période complète du
// début de la période sélectionnée jusqu'à aujourd'hui, jour calendaire par
// jour, en complétant les trous par des journées à zéro (emplacements vides
// dans le graphique).

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Clé de jour calendaire locale (YYYY-MM-DD), identique à l'affichage fr-FR.
function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Timestamp (secondes) du début de la journée calendaire locale.
function dayStartSeconds(tsSeconds) {
  const d = new Date(tsSeconds * 1000);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(start.getTime() / 1000);
}

/**
 * Construit la série continue des buckets journaliers entre startTime et
 * endTime (en secondes). Chaque jour de la période obtient un point :
 *   - le bucket existant s'il y a eu de l'activité ;
 *   - un point à zéro sinon (hasActivity: false).
 * La série est triée chronologiquement, du début de période à aujourd'hui.
 *
 * @param {Array} buckets Buckets renvoyés par /api/usage (champs *_tokens, requests, cost, start_time).
 * @param {{startTime:number, endTime:number}} period Borne de la période (Unix secondes).
 * @returns {Array} Série complète {start_time, prompt_tokens, completion_tokens, total_tokens, requests, cost, hasActivity}.
 */
export function buildDailySeries(buckets, { startTime, endTime }) {
  const byDay = new Map();
  for (const b of buckets || []) {
    const s = toNumber(b?.start_time);
    if (s <= 0) continue;
    byDay.set(dayKey(new Date(s * 1000)), b);
  }

  const out = [];
  const cursor = new Date(dayStartSeconds(startTime) * 1000);
  const stop = dayStartSeconds(endTime || Date.now() / 1000);

  // Garde-fou anti boucle infinie (périodes maximales bien plus courtes en pratique).
  for (let guard = 0; cursor.getTime() / 1000 <= stop && guard <= 3660; guard += 1) {
    const ts = Math.floor(cursor.getTime() / 1000);
    const bucket = byDay.get(dayKey(cursor));
    if (bucket) {
      out.push({
        start_time: ts,
        prompt_tokens: bucket.prompt_tokens,
        completion_tokens: bucket.completion_tokens,
        total_tokens: bucket.total_tokens,
        requests: bucket.requests,
        cost: bucket.cost,
        hasActivity: true,
      });
    } else {
      out.push({
        start_time: ts,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        requests: 0,
        cost: 0,
        hasActivity: false,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
