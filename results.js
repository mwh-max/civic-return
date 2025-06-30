//"Force rebuild for live JS sync"

function init() {
  const params = new URLSearchParams(window.location.search);
  const cityName = params.get("city");

  if (!cityName) {
    console.error("No city specified in the URL.");
    const summaryEl = document.getElementById("summary");
    if (summaryEl) {
      summaryEl.textContent =
        "Please specify a city in the URL to see a green space report.";
    }
    return;
  }

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

init();

// Escape HTML entities to prevent XSS
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Title case formatting utility
function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}


//Large square footage values formatting utility
function formatSqFt(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {return (n / 1_000_000_000).toFixed(1) + " b";}
  if (abs >= 1_000_000) {return (n / 1_000_000).toFixed(1) + " m";}
  if (abs >= 1_000) {return Math.round(n / 1_000) + " k";}
  return Math.round(n).toString();
}

function buildCountyQuery(city) {
  return `
    [out:json][timeout:25];
    area["name"="${city}"]["admin_level"="8"]->.searchArea;
    rel(area.searchArea)[admin_level=6];
    out geom;
  `;
}

function fetchCountyShape(city) {
  const query = buildCountyQuery(city);
  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const relation = data.elements.find(el => el.type === "relation" && el.geometry);
      if (!relation) {return;}

      const coords = relation.geometry.map(pt => [pt.lon, pt.lat]);
      renderCountyShape(coords); // // Render the county silhouette in SVG
    })
    .catch(err => console.error("County shape fetch error:", err));
}

// Build Overpass API query
function buildQuery(city) {
  return `
    [out:json][timeout:25];
    area["name"="${city}"]["admin_level"="8"]->.searchArea;
    (
      node["leisure"="park"](area.searchArea);
      way["leisure"="park"](area.searchArea);
      relation["leisure"="park"](area.searchArea);
    );
    out body;
    >;
    out skel qt;
  `;
}

// Geometry area calculation
function polygonArea(coords) {
  let area = 0;
  const n = coords.length;

  for (let i = 0; i < n - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area) / 2;
}

// Convert area in degrees² to square feet (approximate, assumes small area and mid-latitude)
function convertDegreesToSquareFeet(degrees2, latitude = 40) {
  // 1 degree latitude ≈ 69 miles; 1 degree longitude ≈ 69 * cos(latitude) miles
  // 1 mile = 5280 feet
  const milesPerDegree = 69;
  const feetPerDegree = milesPerDegree * 5280;
  // Area of 1 degree² at given latitude (in square feet)
  const latRad = latitude * Math.PI / 180;
  const areaPerDegree2 = feetPerDegree * (feetPerDegree * Math.cos(latRad));
  return degrees2 * areaPerDegree2;
}

// Fetch and compute green space area
function fetchGreenSpace(city, formattedCityName) {
  const query = buildQuery(city);
  const url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const elements = data.elements;
      const nodeMap = new Map();
      elements.forEach(el => {
        if (el.type === "node") {
          nodeMap.set(el.id, [el.lon, el.lat]);
        }
      });

      const closedWays = elements.filter(el =>
        el.type === "way" &&
    Array.isArray(el.nodes) &&
    el.nodes.length > 0 &&
    el.nodes[0] === el.nodes[el.nodes.length - 1],
      );

      let totalArea = 0;
      closedWays.forEach(way => {
        const coords = way.nodes.map(id => nodeMap.get(id)).filter(Boolean);
        // You probably want to calculate area for each way and sum it
        if (coords.length > 2) {
          totalArea += polygonArea(coords);
        }
      });

      const sqFt = convertDegreesToSquareFeet(totalArea /*, latitude */);
      const formattedSqFt = formatSqFt(sqFt);
      const summaryEl = document.getElementById("summary");
      if (summaryEl) {
        summaryEl.innerHTML =
      `<p>Estimated public green space in ${escapeHtml(formattedCityName)}: ${formattedSqFt} ft²</p>`;
      }

      // Optionally fetch population and render stats
      fetchPopulationAndRenderStats(sqFt);
      // Fetch population from Census API
    })
    .catch(err => console.error("Green space fetch error:", err));
}

// Move renderCountyShape to top-level scope
function renderCountyShape(coords) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "county-svg");
  svg.setAttribute("viewBox", "0 0 400 400");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
  svg.style.marginBottom = "2rem";

  // Normalize coordinates for the card
  const lons = coords.map(([lon]) => lon);
  const lats = coords.map(([, lat]) => lat);
  const minX = Math.min(...lons);
  const maxX = Math.max(...lons);
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);

  const scale = 400 / Math.max(maxX - minX, maxY - minY);
  const offsetX = minX;
  const offsetY = minY;
  // Flip Y-axis because SVG's origin (0,0) is at the top-left, but geographic coordinates increase upwards
  const projected = coords.map(([lon, lat]) => {
    const x = (lon - offsetX) * scale;
    const y = 400 - (lat - offsetY) * scale; // Flip Y-axis
    return `${x},${y}`;
  });

  const pathData = `M${projected.join(" L")} Z`;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("fill", "#2e5d43"); // dark green
  path.setAttribute("stroke", "none");

  svg.appendChild(path);

  // Inject it above the excerpt
  const container = document.querySelector(".results-left");
  if (container) {
    container.insertBefore(svg, container.firstChild);
  } else {
    // Fallback: append to body and log a warning
    document.body.appendChild(svg);
    console.warn("'.results-left' container not found. SVG appended to body as fallback.");
  }
}

// Add this stub at the bottom or before its first use
function fetchPopulationAndRenderStats() {
  // TODO: Implement population fetching and stats rendering
  // For now, this is a placeholder to avoid reference errors.
}