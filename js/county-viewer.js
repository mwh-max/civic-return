// county-viewer.js — Kentucky greenspace choropleth
(function () {
  const WIDTH = 800, HEIGHT = 280;
  const DATA_URL = "./data/us-counties.geojson";

  // ------- util -------
  const $ = (sel) => document.querySelector(sel);
  const fmtInt = (n) => new Intl.NumberFormat().format(Math.round(n));
  const countyKey = (name) =>
    String(name || "").replace(/ County$/i, "").trim().toLowerCase();

  function extent(vals) {
    return [Math.min(...vals), Math.max(...vals)];
  }

  function getViewMode() {
    const checked = document.querySelector('input[name="view-mode"]:checked');
    return checked ? checked.value : "total";
  }

  // ------- projection -------
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
      const py = HEIGHT - (y - offY) * scale;
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
  function lerp(a, b, t) { return a + (b - a) * t; }
  function toHex(n) {
    return Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  }

  function makeColorScale(values) {
    const nonzero = values.filter((v) => v > 0);
    if (!nonzero.length) return () => "#e8e2d8";
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

  // ------- metric helpers -------
  function getMetricForCounty(d) {
    const mode = getViewMode();
    if (mode === "transit") return d.transitSqftPerPerson;
    return d.sqft;
  }

  function updateMetricPill(d) {
    const mode = getViewMode();
    console.log("[updateMetricPill]", {
      county: d.name,
      entry: { sqft: d.sqft, transitSqftPerPerson: d.transitSqftPerPerson },
      viewMode: mode,
    });
    if (mode === "transit") {
      const val = d.transitSqftPerPerson;
      if (!val) return "No transit data";
      return `${fmtInt(val)} transit-accessible sq ft / person`;
    }
    return d.sqft !== null ? `${fmtInt(d.sqft)} sq ft / person` : "No public land data";
  }

  // ------- tooltip -------
  const tooltip = $("#tooltip");

  function showTooltip(e, d) {
    tooltip.innerHTML = `<strong>${d.name}</strong><br>${updateMetricPill(d)}`;
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

  // ------- render -------
  function renderMap(countyData, project) {
    const metric = countyData.map((d) => getMetricForCounty(d));
    const colorScale = makeColorScale(metric.filter((v) => v !== null));

    svg.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";

    for (let i = 0; i < countyData.length; i++) {
      const d = countyData[i];
      const rings = ringsFromGeometry(d.f.geometry);
      if (!rings.length) continue;

      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", pathD(rings, project));
      path.setAttribute("fill", colorScale(metric[i]));
      path.dataset.name = d.name;

      path.addEventListener("mouseenter", (e) => showTooltip(e, d));
      path.addEventListener("mousemove", moveTooltip);
      path.addEventListener("mouseleave", hideTooltip);
      path.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        showTooltip({ clientX: t.clientX, clientY: t.clientY }, d);
      }, { passive: true });
      path.addEventListener("touchend", hideTooltip);

      svg.appendChild(path);
    }

    // Re-apply search highlight state after re-render
    const needle = search.value.trim().toLowerCase();
    svg.classList.toggle("searching", needle.length > 0);
    for (const path of svg.querySelectorAll("path")) {
      const match = needle.length > 0 && path.dataset.name.toLowerCase().includes(needle);
      path.classList.toggle("highlighted", match);
    }
  }

  // ------- init -------
  async function init() {
    status.textContent = "Loading…";

    let metricsMap = new Map();
    if (typeof window.loadKyMetrics === "function") {
      const raw = await window.loadKyMetrics();
      raw.forEach((v, k) => metricsMap.set(countyKey(k), v));
    }

    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);
    const gj = await res.json();

    const ky = (gj.features || []).filter(
      (f) => String(f.properties?.STATE || f.properties?.STATEFP || "") === "21"
    );
    if (!ky.length) throw new Error("No Kentucky features found in the GeoJSON.");

    const countyData = ky.map((f) => {
      const name = String(f.properties.NAME || "").replace(/ County$/i, "").trim();
      const entry = metricsMap.get(countyKey(name));
      const sqft = (entry && typeof window.formatSqftPerPerson === "function")
        ? window.formatSqftPerPerson(entry.acres, entry.pop)
        : null;
      const transitSqftPerPerson = (entry && entry.transitSqft && entry.pop)
        ? entry.transitSqft / entry.pop
        : null;
      return { name, f, sqft, transitSqftPerPerson };
    });

    const allRings = ky.flatMap((f) => ringsFromGeometry(f.geometry));
    const project = fitProject(allRings);

    renderMap(countyData, project);

    // Toggle listener
    const modeDescription = $("#mode-description");
    const modeText = {
      total: "Showing total publicly accessible green space per resident, regardless of transit access.",
      transit: "Showing only green space within a 5-minute walk (400m) of a Lextran bus stop. Only Fayette County has transit data currently. All other counties show no data for this metric.",
    };
    document.querySelectorAll('input[name="view-mode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        renderMap(countyData, project);
        if (modeDescription) modeDescription.textContent = modeText[getViewMode()];
      });
    });

    // Search
    search.addEventListener("input", (e) => {
      const needle = e.target.value.trim().toLowerCase();
      svg.classList.toggle("searching", needle.length > 0);
      for (const path of svg.querySelectorAll("path")) {
        const match = needle.length > 0 && path.dataset.name.toLowerCase().includes(needle);
        path.classList.toggle("highlighted", match);
      }
    });

    countPill.textContent = `${ky.length} counties`;
    status.textContent = "";
  }

  init().catch((err) => {
    status.textContent = "Error: " + err.message;
    console.error(err);
  });
})();
