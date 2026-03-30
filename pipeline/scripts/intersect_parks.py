import geopandas as gpd

# Load and filter PAD-US Fee layer
padus = gpd.read_file(
    "pipeline/data/raw/PADUS4_1_StateKY.gdb", layer="PADUS4_1Fee_State_KY"
)
parks = padus[(padus["Pub_Access"] == "OA") & (padus["Mang_Type"] != "EASE")]

LAYER = "PADUS4_1Fee_State_KY"
print(f"\nGDB layer: {LAYER}")
print(f"Park features after filtering: {len(parks)}")
print("\nFirst 5 parks:")
for _, row in parks.head(5).iterrows():
    print(f"  {row['Unit_Nm']} — {row['Loc_Mang']}")

# Filter to Kentucky bounding box by centroid
ky_bounds = {"min_lon": -89.5, "max_lon": -81.9, "min_lat": 36.5, "max_lat": 39.1}
parks_wgs84 = parks.to_crs("EPSG:4326")
centroids = parks_wgs84.geometry.centroid
mask = (
    centroids.x.between(ky_bounds["min_lon"], ky_bounds["max_lon"]) &
    centroids.y.between(ky_bounds["min_lat"], ky_bounds["max_lat"])
)
parks = parks[mask.values]
print(f"\nFeatures after Kentucky bounding box filter: {len(parks)}")

# Load Fayette County boundary
counties = gpd.read_file("pipeline/data/raw/tl_2024_us_county/tl_2024_us_county.shp")
fayette = counties[(counties["STATEFP"] == "21") & (counties["NAME"] == "Fayette")]

# Align CRS before clip
if parks.crs != fayette.crs:
    fayette = fayette.to_crs(parks.crs)

parks_fayette = gpd.clip(parks, fayette)
print(f"\nFeatures after clip to Fayette County: {len(parks_fayette)}")
print("\nFirst 5 parks in Fayette:")
for _, row in parks_fayette.head(5).iterrows():
    print(f"  {row['Unit_Nm']} — {row['Loc_Mang']}")

# Top 10 parks in Fayette by area (reproject first for accurate sq ft)
parks_fayette_3089 = parks_fayette.to_crs("EPSG:3089")
parks_fayette_3089 = parks_fayette_3089.copy()
parks_fayette_3089["area_sqft"] = parks_fayette_3089.geometry.area
top10_fayette = parks_fayette_3089.nlargest(10, "area_sqft")
print("\nTop 10 parks in Fayette County by area:")
for _, row in top10_fayette.iterrows():
    print(f"  {row['Unit_Nm']}: {row['area_sqft']:,.0f} sq ft")

# Reproject all layers to EPSG:3089
parks_fayette = parks_fayette_3089
fayette = fayette.to_crs("EPSG:3089")

# Load transit buffer and reproject
buffer = gpd.read_file("pipeline/data/processed/transit_buffer_fayette.geojson")
buffer = buffer.to_crs("EPSG:3089")

# Confirm CRS of all layers before intersection
print(f"PAD-US parks CRS:       {parks_fayette.crs}")
print(f"Fayette County CRS:     {fayette.crs}")
print(f"Transit buffer CRS:     {buffer.crs}")

# Exclude educational institutions
edu_terms = ["School", "Elementary", "Middle", "High School", "Academy", "University"]
edu_pattern = "|".join(edu_terms)
before_excl = len(parks_fayette)
edu_mask = (
    parks_fayette["Unit_Nm"].str.contains(edu_pattern, case=False, na=False) |
    parks_fayette["Own_Name"].str.contains(edu_pattern, case=False, na=False) |
    parks_fayette["Unit_Nm"].str.contains(r"\bHigh\b", case=False, na=False) |
    (parks_fayette["Unit_Nm"].str.strip() == "Dunbar")
)
parks_fayette = parks_fayette[~edu_mask]
removed = before_excl - len(parks_fayette)
print(f"\nFeatures removed (educational institutions): {removed}")
print(f"Features remaining before intersection: {len(parks_fayette)}")

# Intersect
accessible_parks = gpd.overlay(parks_fayette, buffer, how="intersection")

accessible_parks.to_file(
    "pipeline/data/processed/fayette_accessible_parks.geojson", driver="GeoJSON"
)

total_area_sqft = accessible_parks.geometry.area.sum()
print(f"\nTotal accessible park area within transit buffer: {total_area_sqft:,.0f} sq ft")

accessible_parks = accessible_parks.copy()
accessible_parks["area_sqft"] = accessible_parks.geometry.area
top10_buffer = accessible_parks.nlargest(10, "area_sqft")
print("\nTop 10 parks within transit buffer by area:")
for _, row in top10_buffer.iterrows():
    print(f"  {row['Unit_Nm']}: {row['area_sqft']:,.0f} sq ft")
