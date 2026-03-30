import geopandas as gpd

# Total PAD-US park area in Fayette before buffer
padus = gpd.read_file(
    "pipeline/data/raw/PADUS4_1_StateKY.gdb", layer="PADUS4_1Fee_State_KY"
)
parks = padus[(padus["Pub_Access"] == "OA") & (padus["Mang_Type"] != "EASE")]

counties = gpd.read_file("pipeline/data/raw/tl_2024_us_county/tl_2024_us_county.shp")
fayette = counties[(counties["STATEFP"] == "21") & (counties["NAME"] == "Fayette")]

if parks.crs != fayette.crs:
    fayette = fayette.to_crs(parks.crs)

parks_fayette = gpd.clip(parks, fayette).to_crs("EPSG:3089")
total_parks_sqft = parks_fayette.geometry.area.sum()

# Transit buffer area
buffer = gpd.read_file("pipeline/data/processed/transit_buffer_fayette.geojson")
buffer = buffer.to_crs("EPSG:3089")
buffer_sqft = buffer.geometry.area.sum()

# Intersected accessible park area
accessible = gpd.read_file("pipeline/data/processed/fayette_accessible_parks.geojson")
accessible = accessible.to_crs("EPSG:3089")
accessible_sqft = accessible.geometry.area.sum()

print(f"Total PAD-US park area in Fayette (before buffer): {total_parks_sqft:,.0f} sq ft")
print(f"Total transit buffer area:                         {buffer_sqft:,.0f} sq ft")
print(f"Intersected accessible park area:                  {accessible_sqft:,.0f} sq ft")
