import { normalizePlace } from "./utils.js";
import { renderCountyShape } from "./render.js";

// Fetch the county shape that CONTAINS the given Kentucky city
export async function fetchCountyShape(cityName) {
  const city = normalizePlace(cityName);

  // One query: find the city (admin 8/9), then the admin_level=6 container
  const query = `
    [out:json][timeout:30];

    // 1) Find the city/municipality boundary inside Kentucky
    rel["boundary"="administrative"]["admin_level"~"8|9"]["name"="${city}"]
       ["is_in:state"="Kentucky"]->.city;

    // 2) Find containing areas for that city
    is_in(r.city)->.containers;

    // 3) Pick the county container (admin_level=6)
    rel(area.containers)["boundary"="administrative"]["admin_level"="6"]->.county;

    // 4) Fallback: some places are consolidated city–counties at level 6
    //    Try a direct admin_level=6 name match if the above didn't hit
    rel["boundary"="administrative"]["admin_level"="6"]["name"="${city}"]->.maybe_consolidated;

    // Prefer the normal county; fall back to consolidated match
    (.county; .maybe_consolidated;);

    out body geom;
  `;

  const url =
    "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    const data = await res.json();

    // Grab the first relation that has geometry
    const relation = (data.elements || []).find(
      (el) => el.type === "relation" && el.geometry
    );
    if (!relation) {
      console.warn(
        `[fetchCountyShape] No county found containing "${cityName}"`
      );
      const summary = document.getElementById("summary");
      if (summary)
        summary.textContent = `Couldn’t find a county containing “${cityName}”. Try a different city name.`;
      return;
    }

    const coords = relation.geometry.map((pt) => [pt.lon, pt.lat]);
    renderCountyShape(coords);
  } catch (err) {
    console.error("Fetch error:", err);
    const summary = document.getElementById("summary");
    if (summary)
      summary.textContent = `Error loading map data (${String(
        err
      )}). Please try again.`;
  }
}
