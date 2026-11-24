import { useMemo } from "react";
import { formatNumber } from "../format.js";

export default function UsageTable({ data, totals }) {
  const rows = useMemo(
    () =>
      [...data]
        .filter((b) => (Number(b.total_tokens) || 0) > 0)
        .sort((a, b) => b.start_time - a.start_time)
        .map((b) => ({
          key: b.start_time,
          date: new Date(b.start_time * 1000).toLocaleDateString("fr-FR"),
          prompt: Number(b.prompt_tokens) || 0,
          completion: Number(b.completion_tokens) || 0,
          total: Number(b.total_tokens) || 0,
          requests: Number(b.requests) || 0,
        })),
    [data]
  );

  return (
    <section className="card table-card" aria-label="Tableau détaillé de la consommation">
      <h2>Détail par jour</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Prompt tokens</th>
              <th>Complétion tokens</th>
              <th>Total tokens</th>
              <th>Requêtes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  Aucune consommation sur la période sélectionnée.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.date}</td>
                  <td className="num">{formatNumber(r.prompt)}</td>
                  <td className="num">{formatNumber(r.completion)}</td>
                  <td className="num">{formatNumber(r.total)}</td>
                  <td className="num">{formatNumber(r.requests)}</td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className="num">{formatNumber(totals.totalPrompt)}</td>
                <td className="num">{formatNumber(totals.totalCompletion)}</td>
                <td className="num">{formatNumber(totals.totalTokens)}</td>
                <td className="num">{formatNumber(totals.totalRequests)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
