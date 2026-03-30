// ky-metrics.js — resilient CSV loader for KY green-space metrics
// Exposes: window.loadKyMetrics() -> Promise<Map<countyKey, {acres, pop}>>
//          window.formatSqftPerPerson(acres, pop)

(function () {
  const CSV_CANDIDATES = [
    "./data/ky-greenspace-population.csv",
    "./data/ky-greenspace-population.csv",
    "./ky-greenspace-population.csv",
  ];

  // ---- helpers ----
  function normalizeCountyName(name) {
    return String(name || "")
      .replace(/ County$/i, "") // drop trailing "County"
      .trim()
      .toLowerCase(); // matches county-viewer.js
  }

  function toNumLoose(x) {
    if (x == null) return null;
    // Accept 1,234 or "2,000" → 1234, 2000
    const cleaned = String(x).replace(/[^0-9.\-eE]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function parseCSV(text) {
    // Tolerant headers (case-insensitive)
    // county | green_space_acres|greenspace_acres|acres|acreage | population|pop|people
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return new Map();

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const findIdx = (alts) =>
      alts.map((k) => headers.indexOf(k)).find((i) => i >= 0);

    const countyIdx = findIdx(["county"]);
    const acresIdx = findIdx([
      "green_space_acres",
      "greenspace_acres",
      "acres",
      "acreage",
    ]);
    const popIdx = findIdx(["population", "pop", "people"]);
    const transitIdx = findIdx(["transit_accessible_sqft"]);

    const map = new Map();

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const cols = lines[i].split(",").map((c) => c.trim());
      const rawName = cols[countyIdx];
      if (!rawName) continue;

      const acres = toNumLoose(cols[acresIdx]);
      const pop = toNumLoose(cols[popIdx]);
      const transitSqft = transitIdx != null ? toNumLoose(cols[transitIdx]) : null;

      map.set(normalizeCountyName(rawName), { acres, pop, transitSqft });
    }
    return map;
  }

  async function fetchTextFromAny(urls) {
    let lastErr;
    for (const u of urls) {
      try {
        const res = await fetch(u, { cache: "no-store" });
        if (res.ok) return await res.text();
        lastErr = new Error(`HTTP ${res.status} at ${u}`);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("CSV not found");
  }

  async function loadKyMetrics() {
    // Optional inline object
    if (window.KY_METRICS_DATA && typeof window.KY_METRICS_DATA === "object") {
      const map = new Map();
      for (const [county, obj] of Object.entries(window.KY_METRICS_DATA)) {
        map.set(normalizeCountyName(county), {
          acres: toNumLoose(obj?.acres),
          pop: toNumLoose(obj?.pop),
        });
      }
      return map;
    }

    // CSV paths
    try {
      const text = await fetchTextFromAny(CSV_CANDIDATES);
      return parseCSV(text);
    } catch (e) {
      console.warn(
        "[KY metrics] Failed to load CSV from candidates:",
        CSV_CANDIDATES,
        e
      );
      return new Map();
    }
  }

  function formatSqftPerPerson(acres, pop) {
    if (!acres || !pop) return null;
    const sqft = acres * 43560;
    const per = sqft / pop;
    return Number.isFinite(per) && per > 0 ? per : null;
  }

  // expose
  window.loadKyMetrics = loadKyMetrics;
  window.formatSqftPerPerson = formatSqftPerPerson;
})();
