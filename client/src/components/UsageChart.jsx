import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "../format.js";

const shortDate = (ts) =>
  new Date(ts * 1000).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

export default function UsageChart({ data }) {
  const chartData = useMemo(
    () =>
      [...data]
        .sort((a, b) => a.start_time - b.start_time)
        .map((b) => ({
          startTime: b.start_time,
          label: shortDate(b.start_time),
          prompt: Number(b.prompt_tokens) || 0,
          completion: Number(b.completion_tokens) || 0,
          total: Number(b.total_tokens) || 0,
        })),
    [data]
  );

  if (chartData.length === 0) {
    return (
      <section className="card" aria-label="Graphique de consommation">
        <h2>Tokens par jour</h2>
        <p className="empty-state">Aucune consommation de tokens sur la période sélectionnée.</p>
      </section>
    );
  }

  return (
    <section className="card" aria-label="Graphique de consommation">
      <h2>Tokens par jour</h2>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dde4ec" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5f6f7d" }} minTickGap={32} />
          <YAxis
            tickFormatter={(v) => formatNumber(v)}
            tick={{ fontSize: 12, fill: "#5f6f7d" }}
            width={78}
          />
          <Tooltip
            cursor={{ fill: "rgba(14, 90, 167, 0.08)" }}
            formatter={(value, name) =>
              formatNumber(value) + (name === "Prompt" ? " (prompt)" : " (complétion)")
            }
            labelFormatter={(label) => `Date : ${label}`}
          />
          <Legend />
          <Bar dataKey="prompt" stackId="tokens" name="Prompt" fill="#8fb2da" />
          <Bar dataKey="completion" stackId="tokens" name="Complétion" fill="#15558c" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}
