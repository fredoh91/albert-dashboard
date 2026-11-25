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
import { buildDailySeries } from "../usageSeries.js";

const shortDate = (ts) =>
  new Date(ts * 1000).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

export default function UsageChart({ data, period }) {
  // Série continue : un emplacement par jour calendaire depuis le début de la
  // période sélectionnée, les jours sans activité apparaissent à zéro.
  const chartData = useMemo(() => {
    const now = Date.now();
    const endTime = Math.floor(now / 1000);
    const startTime = Math.floor((now - period * 86_400_000) / 1000);
    return buildDailySeries(data, { startTime, endTime }).map((b) => ({
      startTime: b.start_time,
      label: shortDate(b.start_time),
      prompt: Number(b.prompt_tokens) || 0,
      completion: Number(b.completion_tokens) || 0,
      total: Number(b.total_tokens) || 0,
    }));
  }, [data, period]);

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
