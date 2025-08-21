import { toTitleCase } from "./utils.js";
import { fetchCountyShape } from "./fetchData.js";

function init() {
  const raw =
    new URLSearchParams(window.location.search).get("city") || "Lexington";

  if (/^\d{5}$/.test(raw)) {
    const el = document.getElementById("per-resident-value");
    if (el) el.textContent = "0";
    const summary = document.getElementById("summary");
    if (summary) {
      summary.textContent = `No population data for ZIP "${raw}". Please enter a city (e.g., "Lexington").`;
    }
    return; // stop before calling fetch/render
  }

  const cityName = toTitleCase(raw);

  const cityNameEl = document.getElementById("city-name");
  if (cityNameEl) {
    cityNameEl.textContent = cityName;
  }

  const today = new Date();
  const options = { year: "numeric", month: "long" };
  const dataYearEl = document.getElementById("data-year");
  if (dataYearEl) {
    dataYearEl.textContent = today.toLocaleDateString(undefined, options);
  }

  const ENABLE_GREENSPACE = false;

  if (ENABLE_GREENSPACE && typeof fetchGreenSpace === "function") {
    fetchGreenSpace(cityName, cityName);
  }

  fetchCountyShape(cityName);
}

document.addEventListener("DOMContentLoaded", init);
