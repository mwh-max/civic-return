# build-greenspace-csv.py
# Reads PAD-US public lands data, joins it to Kentucky county boundaries,
# then merges with population data to output ky-greenspace-population.csv.
#
# Run with: python build-greenspace-csv.py

import geopandas as gpd  # reads shapefiles and geodatabases
import pandas as pd      # reads/writes CSVs and does table operations


# ── STEP 1: Load open-access public land from PAD-US ─────────────────────────
# We use the Fee layer — land the government actually owns outright.
# Easements are a separate layer and are intentionally excluded.

print("Loading PAD-US Fee layer (this may take a moment)...")

padus = gpd.read_file(
    "data/PADUS4_1_StateKY.gdb",
    layer="PADUS4_1Fee_State_KY"
)

# Filter to publicly accessible land only.
# Pub_Access values: OA = Open Access, RA = Restricted, XA = Closed, UK = Unknown
open_access = padus[padus["Pub_Access"] == "OA"].copy()

print(f"  Found {len(open_access)} open-access parcels.")


# ── STEP 2: Load Kentucky county boundaries ───────────────────────────────────
# We already have this file in the project from the map viewer.
# Filter to Kentucky using the STATE FIPS code (21 = Kentucky).

print("Loading county boundaries...")

counties = gpd.read_file("data/us-counties.geojson")
counties = counties[counties["STATE"] == "21"].copy()

# Strip " County" from names so they match what the viewer expects.
# e.g. "Adair County" → "Adair"
counties["county"] = counties["NAME"].str.replace(" County", "", regex=False).str.strip()


# ── STEP 3: Reproject to a measured coordinate system ────────────────────────
# WGS84 (degrees) can't be used for area calculations.
# EPSG:5070 is an equal-area projection for the continental US — areas in meters².
# We use it only for the clip + area math, then we're done with geometry.

PROJECTED_CRS = "EPSG:5070"
open_access = open_access.to_crs(PROJECTED_CRS)
counties     = counties.to_crs(PROJECTED_CRS)


# ── STEP 4: Clip parcels to county boundaries ────────────────────────────────
# overlay(..., how="intersection") is like a cookie cutter:
# it cuts each parcel to the shape of whichever county it falls inside.
# A parcel crossing two counties becomes two smaller pieces, one per county.
# This prevents double-counting acreage along borders.

print("Clipping parcels to county boundaries (this may take a moment)...")

clipped = gpd.overlay(
    open_access[["geometry"]],
    counties[["county", "geometry"]],
    how="intersection",
    keep_geom_type=True
)


# ── STEP 5: Measure clipped area and convert to acres ────────────────────────
# .area gives square meters. One acre = 4046.856 m².
# We calculate fresh area from the clipped geometry instead of using GIS_Acres,
# which was the full parcel size before clipping.

SQM_PER_ACRE = 4046.856
clipped["green_space_acres"] = clipped.geometry.area / SQM_PER_ACRE

acres_by_county = (
    clipped
    .groupby("county")["green_space_acres"]
    .sum()
    .reset_index()
)

acres_by_county["green_space_acres"] = acres_by_county["green_space_acres"].round(2)


# ── STEP 6: Fetch population data from the Census Bureau API ─────────────────
# No download needed — we call the Census API directly.
# This is the same idea as fetch() in JavaScript, just Python syntax.
# The API returns Kentucky county populations with no account or key required.

import urllib.request  # built into Python, no install needed
import json

print("Fetching Kentucky county population from Census API...")

# ACS 5-year estimates — reliable, well-documented Census endpoint.
# B01001_001E is the total population variable.
CENSUS_URL = (
    "https://api.census.gov/data/2022/acs/acs5"
    "?get=NAME,B01001_001E&for=county:*&in=state:21"
)

with urllib.request.urlopen(CENSUS_URL) as response:
    raw = json.loads(response.read())

# The API returns a list of rows; the first row is the header
headers = raw[0]   # ["NAME", "B01001_001E", "state", "county"]
rows    = raw[1:]  # all the data rows

pop = pd.DataFrame(rows, columns=headers)

# NAME looks like "Adair County, Kentucky" — strip to just "Adair"
pop["county"] = (
    pop["NAME"]
    .str.replace(" County, Kentucky", "", regex=False)
    .str.strip()
)

pop["population"] = pd.to_numeric(pop["B01001_001E"])
pop = pop[["county", "population"]]

print(f"  Retrieved population for {len(pop)} counties.")


# ── STEP 7: Merge acres + population on county name ──────────────────────────

merged = pd.merge(counties[["county"]], acres_by_county, on="county", how="left")
merged = pd.merge(merged, pop, on="county", how="left")

# Counties with no public land get 0 instead of blank
merged["green_space_acres"] = merged["green_space_acres"].fillna(0)

merged = merged.sort_values("county").reset_index(drop=True)


# ── STEP 8: Write the output CSV ──────────────────────────────────────────────

output_path = "data/ky-greenspace-population.csv"
merged.to_csv(output_path, index=False)

print(f"\nDone! Wrote {len(merged)} counties to {output_path}")
print(merged.head(10))
