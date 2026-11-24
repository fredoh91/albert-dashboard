import { useId } from "react";

const PERIODS = [
  { label: "7 jours", value: 7 },
  { label: "30 jours", value: 30 },
  { label: "90 jours", value: 90 },
  { label: "365 jours", value: 365 },
];

export default function Filters({
  period,
  onPeriodChange,
  keys,
  keyId,
  onKeyChange,
  models,
  model,
  onModelChange,
  endpoints,
  endpoint,
  onEndpointChange,
  disabled,
}) {
  const uid = useId();

  return (
    <section className="filters" aria-label="Filtres">
      <fieldset className="period-buttons">
        <legend>Période</legend>
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={p.value === period ? "active" : ""}
            onClick={() => onPeriodChange(p.value)}
            disabled={disabled}
          >
            {p.label}
          </button>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor={`${uid}-key`}>Clé</label>
        <select
          id={`${uid}-key`}
          value={keyId}
          onChange={(e) => onKeyChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Toutes les clés</option>
          {keys.map((k) => (
            <option key={k.id || k.name} value={k.id}>
              {k.name || k.id}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={`${uid}-model`}>Modèle</label>
        <select
          id={`${uid}-model`}
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Tous les modèles</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={`${uid}-endpoint`}>Endpoint</label>
        <select
          id={`${uid}-endpoint`}
          value={endpoint}
          onChange={(e) => onEndpointChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">Tous les endpoints</option>
          {endpoints.map((ep) => (
            <option key={ep} value={ep}>
              {ep}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
