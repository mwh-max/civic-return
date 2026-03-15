# Civic Return

**Civic Return** maps publicly accessible green space per resident across all 120 Kentucky counties. Each county is colored by square feet of open-access public land per person, from pale (less) to deep forest green (more).

Built with HTML, CSS, and vanilla JavaScript. No frameworks, no map libraries — the choropleth is rendered entirely in SVG.

Try it here: https://mwh-max.github.io/civic-return

---

## How it works

Green space acreage comes from the federal Protected Areas Database (PAD-US 4.1), filtered to parcels designated open access (`Pub_Access = OA`). Conservation easements and restricted-access land are excluded. County boundaries are clipped against each parcel to avoid double-counting land that crosses county lines.

Population comes from the U.S. Census Bureau's American Community Survey 5-year estimates (2018–2022). The final metric — square feet of public land per resident — is calculated by a Python data pipeline (`build-greenspace-csv.py`) and stored in `data/ky-greenspace-population.csv`.

---

## Data sources

- U.S. Geological Survey. *Protected Areas Database of the United States (PAD-US) 4.1.* U.S. Department of the Interior, 2024. sciencebase.gov.
- U.S. Census Bureau. *American Community Survey, 5-Year Estimates, 2018–2022.* Table B01001. census.gov.
- U.S. Census Bureau. *TIGER/Line Files: County and Equivalent Boundaries, 2022.* census.gov.

---

## Running the data pipeline

Requires Python 3 with `geopandas` and `pandas`:

```
pip install geopandas pandas
python build-greenspace-csv.py
```

The script fetches population from the Census API and reads the PAD-US Kentucky geodatabase from `data/PADUS4_1_StateKY.gdb`. Output is written to `data/ky-greenspace-population.csv`.

---

> *"Not just how much green space exists — but how it's divided among us."*
