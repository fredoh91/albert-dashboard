// Utilitaires de formatage (nombres et dates en français).

export function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatNumber(value) {
  return toNumber(value).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

export function formatCurrency(value) {
  return toNumber(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Accepte un timestamp Unix (en secondes), un timestamp millisecondes ou une chaîne ISO.
export function toDate(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return new Date(value < 1e12 ? value * 1000 : value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
