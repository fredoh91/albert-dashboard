import { formatDate, toDate } from "../format.js";

// Noms de champs « date » possibles renvoyés par l'API selon les clefs.
const CREATED_FIELDS = ["created", "created_at", "date_created", "create_time", "timestamp"];
const EXPIRES_FIELDS = ["expires", "expiration", "expiry"];

function firstDate(obj, fields) {
  for (const field of fields) {
    const d = toDate(obj?.[field]);
    if (d) return d;
  }
  return null;
}

function statusOf(revoked, expires) {
  if (revoked) return { code: "revoked", label: "Révoquée" };
  if (!expires || expires.getTime() > Date.now()) {
    return { code: "active", label: "Active" };
  }
  return { code: "expired", label: "Expirée" };
}

export default function KeysTable({ keys, selectedKeyId, onSelectKey }) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return (
      <section className="card" aria-label="Clefs API du compte">
        <h2>Clefs API</h2>
        <p className="empty-state">Aucune clef API renvoyée par l'API.</p>
      </section>
    );
  }

  return (
    <section className="card table-card" aria-label="Clefs API du compte">
      <h2>Clefs API</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Nom</th>
              <th>Date de création</th>
              <th>Expiration</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const created = firstDate(k, CREATED_FIELDS);
              const expires = firstDate(k, EXPIRES_FIELDS);
              const status = statusOf(k.revoked, expires);
              const selected = k.id != null && k.id === selectedKeyId;
              return (
                <tr
                  key={k.id ?? k.name ?? String(k.created ?? "")}
                  className={selected ? "selected clickable" : "clickable"}
                  onClick={() => onSelectKey(selected ? "" : k.id)}
                  title={
                    selected
                      ? "Cliquer pour retirer le filtre sur cette clef"
                      : "Cliquer pour filtrer la consommation de cette clef"
                  }
                >
                  <td>
                    <code className="key-id" title={String(k.id ?? "")}>
                      {k.id ?? "—"}
                    </code>
                  </td>
                  <td>{k.name || "(clef anonyme)"}</td>
                  <td>{created ? formatDate(created) : "—"}</td>
                  <td>{expires ? formatDate(expires) : "Aucune"}</td>
                  <td>
                    <span className={`badge badge-${status.code}`}>{status.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">
        Cliquez sur une ligne pour appliquer le filtre « Clé » correspondant (nouveau clic pour
        l'enlever). La valeur des clefs n'est jamais affichée.
      </p>
    </section>
  );
}
