const TABS = [
  { id: "tokens", label: "Tokens" },
  { id: "keys", label: "Clefs API" },
  { id: "limits", label: "Limites du compte" },
];

export default function Tabs({ active, onChange, counts = {} }) {
  return (
    <nav className="tabs" aria-label="Sections du tableau de bord" role="tablist">
      {TABS.map((tab) => {
        const count = counts[tab.id];
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={isActive ? "active" : ""}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
            {typeof count === "number" && count > 0 && (
              <span className="tab-count">{count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
