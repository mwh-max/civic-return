import { toTitleCase } from "./utils.js";
import { fetchGreenSpace, fetchCountyShape } from './fetchData.js';

function init() {
  const cityName = new URLSearchParams(window.location.search).get("city") || "Lexington";
  const formattedCityName = toTitleCase(cityName);

  const cityNameEl = document.getElementById("city-name");
  if (cityNameEl) {
    cityNameEl.textContent = formattedCityName;
  }

  const today = new Date();
  const options = { year: "numeric", month: "long" };
  const dataYearEl = document.getElementById("data-year");
  if (dataYearEl) {
    dataYearEl.textContent = today.toLocaleDateString(undefined, options);
  }

  fetchGreenSpace(cityName, formattedCityName);
  fetchCountyShape(cityName);
}

document.addEventListener("DOMContentLoaded", init);
