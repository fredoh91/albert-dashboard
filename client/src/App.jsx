import { useEffect, useMemo, useState } from "react";
import { fetchKeys, fetchMe, fetchModels, fetchUsage } from "./api.js";
import Header from "./components/Header.jsx";
import Filters from "./components/Filters.jsx";
import KpiCards from "./components/KpiCards.jsx";
import UsageChart from "./components/UsageChart.jsx";
import UsageTable from "./components/UsageTable.jsx";

const ENDPOINTS = [
  "/v1/chat/completions",
  "/v1/embeddings",
  "/v1/ocr",
  "/v1/rerank",
  "/v1/audio/transcriptions",
  "/v1/search",
];

export default function App() {
  const [me, setMe] = useState(null);
  const [keys, setKeys] = useState([]);
  const [models, setModels] = useState([]);
  const [usage, setUsage] = useState([]);

  const [period, setPeriod] = useState(30);
  const [keyId, setKeyId] = useState("");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("");

  const [metaLoading, setMetaLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Identité + listes (clefs, modèles) — chargées au démarrage.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setMetaLoading(true);
    setError(null);

    Promise.all([fetchMe({ signal }), fetchKeys({ signal }), fetchModels({ signal })])
      .then(([meData, keysData, modelsData]) => {
        setMe(meData);
        setKeys(keysData);
        setModels(modelsData);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err);
      })
      .finally(() => {
        if (!signal.aborted) setMetaLoading(false);
      });

    return () => controller.abort();
  }, [reloadToken]);

  // Consommation — rechargée à chaque changement de filtre.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setUsageLoading(true);
    setUsage([]);
    setError(null);

    const now = Date.now();
    const endTime = Math.floor(now / 1000);
    const startTime = Math.floor((now - period * 86_400_000) / 1000);

    fetchUsage({ startTime, endTime, keyId, model, endpoint, signal })
      .then(setUsage)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err);
      })
      .finally(() => {
        if (!signal.aborted) setUsageLoading(false);
      });

    return () => controller.abort();
  }, [period, keyId, model, endpoint, reloadToken]);

  const totals = useMemo(() => {
    const sum = (key) => usage.reduce((acc, b) => acc + (Number(b[key]) || 0), 0);
    return {
      totalTokens: sum("total_tokens"),
      totalPrompt: sum("prompt_tokens"),
      totalCompletion: sum("completion_tokens"),
      totalRequests: sum("requests"),
      activeDays: usage.filter((b) => (Number(b.total_tokens) || 0) > 0).length,
      cost: usage.reduce((acc, b) => acc + (Number(b.cost) || 0), 0),
    };
  }, [usage]);

  const handleRetry = () => setReloadToken((t) => t + 1);
  const isLoading = metaLoading || usageLoading;

  return (
    <div className="app">
      <Header me={me} loading={metaLoading} />

      {error && (
        <div className="error-banner" role="alert">
          <div>
            <strong>Erreur :</strong> {error.message}
          </div>
          <button type="button" onClick={handleRetry}>
            Réessayer
          </button>
        </div>
      )}

      <main>
        <Filters
          period={period}
          onPeriodChange={setPeriod}
          keys={keys}
          keyId={keyId}
          onKeyChange={setKeyId}
          models={models}
          model={model}
          onModelChange={setModel}
          endpoints={ENDPOINTS}
          endpoint={endpoint}
          onEndpointChange={setEndpoint}
          disabled={usageLoading}
        />

        {isLoading ? (
          <div className="loading-box">
            <div className="spinner" aria-hidden="true" />
            <p>Chargement des données…</p>
          </div>
        ) : (
          <>
            <KpiCards totals={totals} />
            <UsageChart data={usage} />
            <UsageTable data={usage} totals={totals} />
          </>
        )}
      </main>
    </div>
  );
}
