import { useEffect, useMemo, useState } from "react";
import { fetchKeys, fetchLimits, fetchMe, fetchModels, fetchUsage } from "./api.js";
import Header from "./components/Header.jsx";
import Tabs from "./components/Tabs.jsx";
import Filters from "./components/Filters.jsx";
import KpiCards from "./components/KpiCards.jsx";
import KeysTable from "./components/KeysTable.jsx";
import LimitsTable from "./components/LimitsTable.jsx";
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
  const [limits, setLimits] = useState([]);
  const [usage, setUsage] = useState([]);

  const [period, setPeriod] = useState(30);
  const [keyId, setKeyId] = useState("");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [tab, setTab] = useState("tokens");

  const [metaLoading, setMetaLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Identité + listes (clefs, modèles, limites/routeurs) — chargées au démarrage.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setMetaLoading(true);
    setError(null);

    Promise.all([
      fetchMe({ signal }),
      fetchKeys({ signal }),
      fetchModels({ signal }),
      fetchLimits({ signal }),
    ])
      .then(([meData, keysData, modelsData, limitsData]) => {
        setMe(meData);
        setKeys(keysData);
        setModels(modelsData);
        setLimits(limitsData);
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
        <Tabs
          active={tab}
          onChange={setTab}
          counts={{ tokens: usage.length, keys: keys.length, limits: limits.length }}
        />

        <section
          className={tab === "tokens" ? "tab-panel" : "tab-panel hidden"}
          aria-hidden={tab !== "tokens"}
        >
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

          {usageLoading ? (
            <div className="loading-box">
              <div className="spinner" aria-hidden="true" />
              <p>Rechargement de la consommation…</p>
            </div>
          ) : (
            <>
              <KpiCards totals={totals} />
              <UsageChart data={usage} />
              <UsageTable data={usage} totals={totals} />
            </>
          )}
        </section>

        <section
          className={tab === "keys" ? "tab-panel" : "tab-panel hidden"}
          aria-hidden={tab !== "keys"}
        >
          {metaLoading ? (
            <div className="loading-box">
              <div className="spinner" aria-hidden="true" />
              <p>Chargement des clefs…</p>
            </div>
          ) : (
            <KeysTable keys={keys} selectedKeyId={keyId} onSelectKey={setKeyId} />
          )}
        </section>

        <section
          className={tab === "limits" ? "tab-panel" : "tab-panel hidden"}
          aria-hidden={tab !== "limits"}
        >
          {metaLoading ? (
            <div className="loading-box">
              <div className="spinner" aria-hidden="true" />
              <p>Chargement des limites…</p>
            </div>
          ) : (
            <LimitsTable limits={limits} />
          )}
        </section>
      </main>
    </div>
  );
}
