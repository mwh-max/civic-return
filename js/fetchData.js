import { normalizePlace } from "./utils.js";
import { renderCountyShape } from "./render.js";

// Fetch t county shape that CONTAINS the given Kentucky city
export async function fetchCountyShape(cityName) {
  const summary = document.getElementById("summary");
  if (summary) {
    summary.textContent = `County map for "${cityName}" is temporarily unavailable. Data layer is paused.`;
  }
}
