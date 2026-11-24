import { formatNumber } from "../format.js";

const TYPE_LABELS = {
  rpm: "Requêtes / minute",
  rpd: "Requêtes / jour",
  tpm: "Tokens / minute",
  tpd: "Tokens / jour",
};

// Type -> valeur / restant pour une ligne de routeur.
function pick(limits, type) {
  const found = (Array.isArray(limits) ? limits : []).find((l) => l.type === type);
  return found ? found : null;
}

function Cell({ entry }) {
  const consumed =
    entry &&
    typeof entry.value === "number" &&
    typeof entry.remaining === "number" &&
    entry.remaining < entry.value;

  if (!entry || (entry.value == null && entry.remaining == null)) {
    return <td className="num">—</td>;
  }

  return (
    <td className="num">
      {entry.value == null ? "—" : formatNumber(entry.value)}
      {entry.remaining != null && (
        <span className={consumed ? "limit-remaining consumed" : "limit-remaining"}>
          reste {formatNumber(entry.remaining)}
        </span>
      )}
    </td>
  );
}

export default function LimitsTable({ limits }) {
  const rows = (Array.isArray(limits) ? limits : [])
    .slice()
    .sort((a, b) =>
      String(a.model ?? a.router_id).localeCompare(String(b.model ?? b.router_id))
    );

  return (
    <section className="card table-card" aria-label="Limites du compte">
      <h2>Limites du compte</h2>
      <div className="table-scroll">
        <table className="data-table limits-table">
          <thead>
            <tr>
              <th>Modèle</th>
              <th>Router_id</th>
              <th className="num">{TYPE_LABELS.rpm}</th>
              <th className="num">{TYPE_LABELS.rpd}</th>
              <th className="num">{TYPE_LABELS.tpm}</th>
              <th className="num">{TYPE_LABELS.tpd}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-state">
                  Aucune limite renseignée par l'API.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={String(row.router_id)}>
                  <td>
                    <span className="limit-model">{row.model ?? "—"}</span>
                  </td>
                  <td>
                    <code className="router-id">#{row.router_id ?? "?"}</code>
                  </td>
                  <Cell entry={pick(row.limits, "rpm")} />
                  <Cell entry={pick(row.limits, "rpd")} />
                  <Cell entry={pick(row.limits, "tpm")} />
                  <Cell entry={pick(row.limits, "tpd")} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="note">
        Correspondance officielle fournie par <code>/v1/limits</code> : chaque{" "}
        <code>router_id</code> numérique correspond à un modèle. La valeur est le plafond du
        compte pour ce routeur ; «&nbsp;reste&nbsp;» indique le quota restant quand une partie a
        été consommée. «&nbsp;—&nbsp;» signifie que le plafond n'est pas renseigné (débit non
        limité pour ce type).
      </p>
    </section>
  );
}
