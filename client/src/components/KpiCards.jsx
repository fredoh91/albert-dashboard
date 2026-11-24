import { formatCurrency, formatNumber } from "../format.js";

export default function KpiCards({ totals }) {
  return (
    <section className="kpi-grid" aria-label="Indicateurs clés de la période">
      <div className="kpi">
        <div className="kpi-label">Tokens consommés</div>
        <div className="kpi-value">{formatNumber(totals.totalTokens)}</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Requêtes</div>
        <div className="kpi-value">{formatNumber(totals.totalRequests)}</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Jours avec activité</div>
        <div className="kpi-value">{formatNumber(totals.activeDays)}</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Coût estimé</div>
        <div className="kpi-value">{formatCurrency(totals.cost)}</div>
      </div>
    </section>
  );
}
