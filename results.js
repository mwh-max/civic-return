function init() {
  const params = new URLSearchParams(window.location.search);
  const cityName = params.get("city");

  if (!cityName) {
    console.error("No city specified in the URL.");
    document.getElementById("summary").textContent =
      "Please specify a city in the URL to see a green space report.";
    return;
  }

  const formattedCityName = toTitleCase(cityName);
  document.getElementById("city-name").textContent = formattedCityName;

  const today = new Date();
  const options = { year: 'numeric', month: 'long' };
  const dataYearEl = document.getElementById("data-year");
  if (dataYearEl) {
    dataYearEl.textContent = today.toLocaleDateString(undefined, options);
  }

  fetchGreenSpace(cityName);
  fetchCountyShape(cityName);
}

// Kick things off
init();

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
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return Math.round(n / 1_000) + "K";
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
      if (!relation) return;

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

// Fetch and compute green space area
fetchGreenSpace(cityName);
fetchCountyShape(cityName);

function fetchGreenSpace(city) {
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
        el.type === "way" && el.nodes?.[0] === el.nodes?.[el.nodes.length - 1]
      );

      let totalArea = 0;
      closedWays.forEach(way => {
        const coords = way.nodes.map(id => nodeMap.get(id)).filter(Boolean);
        if (coords.length >= 3) {
          totalArea += polygonArea(coords);
        }
      });

      const sqFt = convertDegreesToSquareFeet(totalArea);
      const formattedSqFt = formatSqFt(sqFt);
        document.getElementById("summary").innerHTML =
        `<p>Estimated public green space in ${formattedCityName}: ${formattedSqFt} ft²</p>`;

      fetchPopulationAndRenderStats(city, sqFt);
    })
    .catch(err => {
      console.error("Error fetching Overpass data:", err);
    });
}

// Convert raw degree² to approximate ft²
function convertDegreesToSquareFeet(areaInDegrees) {
  const metersPerDegreeLon = Math.cos(38 * Math.PI / 180) * 111000;
  const metersPerDegreeLat = 111000;
  const squareMetersPerDegree = metersPerDegreeLon * metersPerDegreeLat;
  return areaInDegrees * squareMetersPerDegree * 10.7639;
}

// Fetch population from Census API
function fetchPopulationAndRenderStats(city, totalSqFt) {
  const popUrl = "https://api.census.gov/data/2023/pep/population?get=NAME,POP&for=place:*&in=state:21";

  fetch(popUrl)
    .then(res => res.json())
    .then(rows => {
      const dataRows = rows.slice(1);
      const match = dataRows.find(row =>
        row[0].toLowerCase().includes(city.toLowerCase())
      );

      console.log("City:", city);
      console.log("Raw match result:", match);


      const perResidentEl = document.getElementById("per-resident-value");

      if (match) {
        const population = parseInt(match[1], 10);
        const sqftPerPerson = totalSqFt / population;
        const acresPerPerson = sqftPerPerson / 43560;

        document.getElementById("summary").innerHTML +=
          `<p>That's about ${Math.round(sqftPerPerson).toLocaleString()} ft² per resident.</p>`;

        if (perResidentEl) {
          perResidentEl.textContent = `${acresPerPerson.toFixed(2)} acres`;
        }
      } else {
        console.warn(`No population match found for ${city}`);
        if (perResidentEl) {
          perResidentEl.textContent = "Data unavailable";
        }
      }
    })
    .catch(error => {
      console.error("Population fetch error:", error);
      const el = document.getElementById("per-resident-value");
      if (el) el.textContent = "Error loading data";
    });

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
  if (container) container.insertBefore(svg, container.firstChild);
}
}