function init() {
  const cityName =
    new URLSearchParams(window.location.search).get("city") || "Lexington";

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatSqFt(n) {
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

function normalizePlace(str) {
  return str
    .toLowerCase()
    .replace(
      / city| town| village| urban county| metropolitan government| consolidated city| municipality/g,
      "",
    )
    .replace(/, kentucky.*$/, "")
    .replace(/-/g, " ")
    .trim();
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
  const url =
    "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      const relation = data.elements.find(
        (el) => el.type === "relation" && el.geometry,
      );
      if (!relation) {
        return;
      }

      const coords = relation.geometry.map((pt) => [pt.lon, pt.lat]);
      renderCountyShape(coords);
    })
    .catch((err) => console.error("County shape fetch error:", err));
}

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

function polygonArea(coords) {
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function convertDegreesToSquareFeet(degrees2, latitude = 40) {
  const milesPerDegree = 69;
  const feetPerDegree = milesPerDegree * 5280;
  const latRad = (latitude * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  const areaPerDegree2 = feetPerDegree * cosLat * (feetPerDegree * cosLat);
  return degrees2 * areaPerDegree2;
}

function fetchGreenSpace(city, formattedCityName) {
  const query = buildQuery(city);
  const url =
    "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(query);

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      const elements = data.elements;
      const nodeMap = new Map();

      elements.forEach((el) => {
        if (el.type === "node") {
          nodeMap.set(el.id, [el.lon, el.lat]);
        }
      });

      const closedWays = elements.filter(
        (el) =>
          el.type === "way" &&
          Array.isArray(el.nodes) &&
          el.nodes.length > 0 &&
          el.nodes[0] === el.nodes[el.nodes.length - 1],
      );

      let totalArea = 0;
      closedWays.forEach((way) => {
        const coords = way.nodes.map((id) => nodeMap.get(id)).filter(Boolean);
        if (coords.length > 2) {
          totalArea += polygonArea(coords);
        }
      });

      const sqFt = convertDegreesToSquareFeet(totalArea);
      const formattedSqFt = formatSqFt(sqFt);

      const numberEl = document.querySelector(".number-display");
      if (numberEl) {
        numberEl.textContent = formattedSqFt;
      }

      const summaryEl = document.getElementById("summary");
      if (summaryEl) {
        summaryEl.innerHTML = `<p>Estimated public green space in ${escapeHtml(formattedCityName)}: ${formattedSqFt} ft²</p>`;
      }

      fetchPopulationAndRenderStats(sqFt);
    })
    .catch((err) => console.error("Green space fetch error:", err));
}

function renderCountyShape(coords) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "county-svg");
  svg.setAttribute("viewBox", "0 0 400 400");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
  svg.style.marginBottom = "2rem";

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
    const y = 400 - (lat - offsetY) * scale;
    return `${x},${y}`;
  });

  const pathData = `M${projected.join(" L")} Z`;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("fill", "#2e5d43");
  path.setAttribute("stroke", "none");

  svg.appendChild(path);

  const container = document.getElementById("county-svg-container");
  if (container) {
    container.innerHTML = "";
    container.appendChild(svg);
  } else {
    document.body.appendChild(svg);
  }
}

function fetchPopulationAndRenderStats(sqFt) {
  const perCapitaEl = document.querySelector(".per-capita");
  if (perCapitaEl) {
    perCapitaEl.textContent = "Loading population data...";
  }

  const city =
    new URLSearchParams(window.location.search).get("city") || "Lexington";
  const formattedCity = toTitleCase(city);
  const normCity = normalizePlace(formattedCity);

  const apiUrl =
    "https://api.census.gov/data/2020/dec/pl?get=NAME,P1_001N&for=place:*&in=state:21";

  fetch(apiUrl)
    .then((res) => res.json())
    .then((data) => {
      const rows = data.slice(1);
      const match = rows.find((row) => normalizePlace(row[0]) === normCity);

      if (!match) {
        console.warn(`No Census match for "${normCity}".`);
        const nearby = rows.filter((row) =>
          normalizePlace(row[0]).includes(normCity),
        );
        console.warn(
          "Possible nearby names:",
          nearby.map((row) => row[0]),
        );

        if (perCapitaEl) {
          perCapitaEl.textContent = `No population data for "${formattedCity}".`;
        }
        return;
      }

      const population = parseInt(match[1], 10);

      if (population === 0) {
        if (perCapitaEl) {
          perCapitaEl.textContent = "Population data unavailable.";
        }
        return;
      }

      const greenSpacePerPerson = sqFt / population;

      if (perCapitaEl) {
        perCapitaEl.textContent = `${Math.round(greenSpacePerPerson).toLocaleString()} ft² per person`;
      }
    })
    .catch((err) => {
      console.error("Population fetch error:", err);
      if (perCapitaEl) {
        perCapitaEl.textContent = "Population data not available.";
      }
    });
}
