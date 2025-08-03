import { normalizePlace } from "./utils.js";
import { renderCountyShape } from "./render.js";

// Fetches the county shape based on the city
export function fetchCountyShape(city) {
  const query = buildCountyQuery(city);
  const url =
    "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  fetch(url)
    .then((res) => {
      // Check for HTTP errors and throw an error if needed
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      // Find the relation element that contains geometry data
      const relation = data.elements.find(
        (el) => el.type === "relation" && el.geometry
      );
      if (!relation) {
        throw new Error("No valid relation found in the response data.");
      }
      // Render the county shape if a valid relation is found
      renderCountyShape(relation.geometry.coordinates);
    })
    .catch((error) => {
      console.error("Fetch error: ", error);
      // Display a user-friendly error message to the UI
      alert("Failed to fetch county shape data. Please try again later.");
    });
}

// Builds the query for fetching county data based on the city
function buildCountyQuery(city) {
  const normalizedCity = normalizePlace(city);
  return `
    [out:json];
    area["name"="${normalizedCity}"]->.searchArea;
    (
      relation["type"="boundary"]["boundary"="administrative"](area.searchArea);
    );
    out body geom;
  `;
}
