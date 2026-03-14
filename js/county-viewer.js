// county-viewer.js — Kentucky greenspace choropleth
(function () {
  const WIDTH = 800, HEIGHT = 600;
  const DATA_URL = "./data/us-counties.geojson";

  // ------- util -------
  const $ = (sel) => document.querySelector(sel);
  const fmtInt = (n) => new Intl.NumberFormat().format(Math.round(n));
  const countyKey = (name) =>
    String(name || "").replace(/ County$/i, "").trim().toLowerCase();

  function extent(vals) {
    return [Math.min(...vals), Math.max(...vals)];
  }

  // ------- projection -------
  // Fits ALL county rings into the SVG canvas at once (shared coordinate space)
  function fitProject(allRings) {
    const xs = [], ys = [];
    for (const ring of allRings) for (const [x, y] of ring) { xs.push(x); ys.push(y); }
    const [minX, maxX] = extent(xs), [minY, maxY] = extent(ys);
    const spanX = Math.max(maxX - minX, 1e-9), spanY = Math.max(maxY - minY, 1e-9);
    const scale = Math.min(WIDTH / spanX, HEIGHT / spanY) * 0.92;
    const offX = minX - (WIDTH / scale - spanX) / 2;
    const offY = minY - (HEIGHT / scale - spanY) / 2;
    return ([x, y]) => {
      const px = (x - offX) * scale;
      const py = HEIGHT - (y - offY) * scale; // invert Y for SVG
      return [px, py];
    };
  }

  function ringsFromGeometry(geom) {
    if (!geom) return [];
    if (geom.type === "Polygon") return geom.coordinates;
    if (geom.type === "MultiPolygon") return geom.coordinates.flatMap((poly) => poly);
    return [];
  }

  function pathD(rings, project) {
    return rings
      .map((r) => {
        const seg = r.map(project).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ");
        return `M ${seg} Z`;
      })
      .join(" ");
  }

  // ------- color scale -------
  // Uses log scale so extreme outliers don't wash out the middle range.
  // Interpolates from pale green (low) to deep forest green (high).
  // Counties with no public land data get a warm gray.
  function lerp(a, b, t) { return a + (b - a) * t; }
  function toHex(n) {
    return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  }

  function makeColorScale(values) {
    const nonzero = values.filter((v) => v > 0);
    const logMin = Math.log(Math.min(...nonzero));
    const logMax = Math.log(Math.max(...nonzero));
    return function (val) {
      if (!val || val <= 0) return "#e8e2d8";
      const t = Math.max(0, Math.min(1, (Math.log(val) - logMin) / (logMax - logMin)));
      const r = lerp(214, 28, t);
      const g = lerp(237, 74, t);
      const b = lerp(214, 38, t);
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };
  }

  // ------- tooltip -------
  const tooltip = $("#tooltip");

  function showTooltip(e, name, sqft) {
    const metric = sqft !== null
      ? `${fmtInt(sqft)} sq ft / person`
      : "No public land data";
    tooltip.innerHTML = `<strong>${name}</strong><br>${metric}`;
    tooltip.style.display = "block";
    moveTooltip(e);
  }

  function moveTooltip(e) {
    tooltip.style.left = (e.clientX + 14) + "px";
    tooltip.style.top  = (e.clientY - 36) + "px";
  }

  function hideTooltip() {
    tooltip.style.display = "none";
  }

  // ------- elements -------
  const svg       = $("#map");
  const status    = $("#status");
  const countPill = $("#count");
  const search    = $("#search");

  // ------- init -------
  async function init() {
    status.textContent = "Loading…";

    // Load greenspace metrics
    let metricsMap = new Map();
    if (typeof window.loadKyMetrics === "function") {
      const raw = await window.loadKyMetrics();
      raw.forEach((v, k) => metricsMap.set(countyKey(k), v));
    }

    // Load GeoJSON and filter to Kentucky (STATE FIPS 21)
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);
    const gj = await res.json();

    const ky = (gj.features || []).filter(
      (f) => String(f.properties?.STATE || f.properties?.STATEFP || "") === "21"
    );
    if (!ky.length) throw new Error("No Kentucky features found in the GeoJSON.");

    // Attach metric to each county feature
    const countyData = ky.map((f) => {
      const name = String(f.properties.NAME || "").replace(/ County$/i, "").trim();
      const entry = metricsMap.get(countyKey(name));
      const sqft = (entry && typeof window.formatSqftPerPerson === "function")
        ? window.formatSqftPerPerson(entry.acres, entry.pop)
        : null;
      return { name, f, sqft };
    });

    // Single projection fitted to the whole state
    const allRings = ky.flatMap((f) => ringsFromGeometry(f.geometry));
    const project = fitProject(allRings);

    // Color scale built from all non-null sq ft values
    const allSqft = countyData.map((d) => d.sqft).filter((v) => v !== null);
    const colorScale = makeColorScale(allSqft);

    // Draw all 120 counties
    svg.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";

    for (const { name, f, sqft } of countyData) {
      const rings = ringsFromGeometry(f.geometry);
      if (!rings.length) continue;

      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", pathD(rings, project));
      path.setAttribute("fill", colorScale(sqft));
      path.dataset.name = name;

      path.addEventListener("mouseenter", (e) => showTooltip(e, name, sqft));
      path.addEventListener("mousemove", moveTooltip);
      path.addEventListener("mouseleave", hideTooltip);

      svg.appendChild(path);
    }

    // Search — highlight matching counties
    search.addEventListener("input", (e) => {
      const needle = e.target.value.trim().toLowerCase();
      for (const path of svg.querySelectorAll("path")) {
        const match = needle.length > 0 && path.dataset.name.toLowerCase().includes(needle);
        path.classList.toggle("highlighted", match);
      }
    });

    countPill.textContent = `${ky.length} counties`;
    status.textContent = "Hover a county to explore.";
  }

  init().catch((err) => {
    status.textContent = "Error: " + err.message;
    console.error(err);
  });
})();
