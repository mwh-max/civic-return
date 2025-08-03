export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatSqFt(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    return (n / 1_000_000_000).toFixed(1) + " b";
  }
  if (abs >= 1_000_000) {
    return (n / 1_000_000).toFixed(1) + " m";
  }
  if (abs >= 1_000) {
    return Math.round(n / 1_000) + " k";
  }
  return Math.round(n).toString();
}

export function normalizePlace(str) {
  return str
    .toLowerCase()
    .replace(
      / city| town| village| urban county| metropolitan government| consolidated city| municipality/g,
      ""
    )
    .replace(/, kentucky.*$/, "")
    .replace(/-/g, " ")
    .trim();
}
