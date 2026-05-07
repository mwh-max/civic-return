# Civic Return

**Civic Return** maps publicly accessible green space per resident across all 120 Kentucky counties. Each county is colored by square feet of open-access public land per person, from pale (less) to deep forest green (more). A toggle lets you switch between total green space and transit-accessible green space — land reachable within a 400-meter walk of a Lextran bus stop.

Built with HTML, CSS, and vanilla JavaScript. No frameworks, no map libraries — the choropleth is rendered entirely in SVG.

Try it here: https://mwh-max.github.io/civic-return

---

## How it works

Green space acreage comes from the federal Protected Areas Database (PAD-US 4.1), filtered to parcels designated open access (`Pub_Access = OA`). Conservation easements, restricted-access land, and educational institution grounds are excluded. County boundaries are clipped against each parcel to avoid double-counting land that crosses county lines.

Population comes from the U.S. Census Bureau's American Community Survey 5-year estimates (2018–2022). The final metric — square feet of public land per resident — is stored in `data/ky-greenspace-population.csv`.

Transit-accessible green space is calculated for Fayette County using GTFS data from Lextran. A 400-meter buffer is drawn around each bus stop and intersected with the filtered PAD-US parcels. The result is stored as `transit_accessible_sqft` in the same CSV.

---

## Data sources

- U.S. Geological Survey. *Protected Areas Database of the United States (PAD-US) 4.1.* U.S. Department of the Interior, 2024. sciencebase.gov.
- U.S. Census Bureau. *American Community Survey, 5-Year Estimates, 2018–2022.* Table B01001. census.gov.
- U.S. Census Bureau. *TIGER/Line Files: County and Equivalent Boundaries, 2024.* census.gov.
- Lextran. *General Transit Feed Specification (GTFS) static feed.* google_transit.zip.

---

## JavaScript structure

All front-end logic lives in two vanilla JS files loaded as plain `<script>` tags.

**`js/ky-metrics.js`** — data loader, exposes two globals:
- `loadKyMetrics()` — fetches and parses `ky-greenspace-population.csv` into a `Map` keyed by normalized county name.
- `formatSqftPerPerson(acres, pop)` — converts acres + population into a square-feet-per-person value.

**`js/county-viewer.js`** — choropleth renderer, self-contained IIFE:
- `minMax(vals)` — returns `[min, max]` of an array of numbers.
- `fitProject(allRings)` — builds a scale-and-translate projection function that fits all GeoJSON rings into the fixed SVG canvas.
- `ringsFromGeometry(geom)` — flattens a GeoJSON Polygon or MultiPolygon into a flat array of coordinate rings.
- `buildSvgPath(rings, project)` — converts coordinate rings into an SVG `d` attribute string.
- `makeColorScale(values)` — returns a logarithmic color-interpolation function for the choropleth fill.
- `getMetricForCounty(d)` — returns the relevant numeric metric for a county given the active view mode.
- `formatCountyLabel(d)` — returns the formatted tooltip string for a county.
- `renderMap(countyData, project)` — (re-)renders all county `<path>` elements with current colors and event listeners.
- `init()` — fetches GeoJSON and CSV, wires up the search input and view-mode toggle, kicks off the first render.

---

## Data pipeline

The `pipeline/` folder contains the full Python processing pipeline. Raw data files are excluded from version control (see `pipeline/.gitignore`) and must be downloaded separately.

### Setup

```bash
pip install -r pipeline/requirements.txt
```

### Scripts

Run from the project root in order:

```bash
python pipeline/scripts/load_stops.py         # Parse GTFS stops → GeoJSON
python pipeline/scripts/build_buffer.py       # Buffer stops 400m → dissolved polygon
python pipeline/scripts/intersect_parks.py    # Clip PAD-US to Fayette, intersect with buffer
python pipeline/scripts/update_csv.py         # Write transit_accessible_sqft to CSV
```

### Raw data required

Place the following in `pipeline/data/raw/`:

| File | Source |
|------|--------|
| `google_transit.zip` | Lextran GTFS feed |
| `PADUS4_1_StateKY.gdb` | USGS PAD-US 4.1 Kentucky — sciencebase.gov |
| `tl_2024_us_county/` | Census TIGER/Line county boundaries — census.gov |

---

> *"Not just how much green space exists — but how it's divided among us."*
