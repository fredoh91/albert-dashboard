import { toDate } from "../format.js";

export default function Header({ me, loading }) {
  const expires = toDate(me?.expires);
  const expiresLabel = expires ? expires.toLocaleDateString("fr-FR") : "—";

  return (
    <header className="header">
      <div>
        <h1>Albert Dashboard</h1>
        <p className="subtitle">Consommation de tokens de l'API Albert (DINUM)</p>
      </div>

      {loading ? (
        <div className="header-meta">Chargement de l'identité…</div>
      ) : me ? (
        <div className="header-meta">
          <span className="user-name">{me.name || me.email || "Utilisateur inconnu"}</span>
          {me.email && <span className="user-email">{me.email}</span>}
          <span className="meta-item">
            Organisation : <strong>{me.organization_id ?? "—"}</strong>
          </span>
          <span className="meta-item">
            Expiration : <strong>{expiresLabel}</strong>
          </span>
        </div>
      ) : (
        <div className="header-meta">Identité indisponible</div>
      )}
    </header>
  );
}
