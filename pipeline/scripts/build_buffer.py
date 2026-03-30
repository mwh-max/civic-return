import geopandas as gpd

stops = gpd.read_file("pipeline/data/processed/lextran_stops.geojson")

stops_projected = stops.to_crs("EPSG:3089")

buffered = stops_projected.copy()
buffered["geometry"] = stops_projected.buffer(400)

dissolved = buffered.dissolve()

dissolved.to_file("pipeline/data/processed/transit_buffer_fayette.geojson", driver="GeoJSON")

print("Transit buffer created successfully.")

bounds = dissolved.to_crs("EPSG:4326").total_bounds  # [minx, miny, maxx, maxy]
print(f"Bounding box (EPSG:4326):")
print(f"  Min longitude: {bounds[0]:.6f}")
print(f"  Max longitude: {bounds[2]:.6f}")
print(f"  Min latitude:  {bounds[1]:.6f}")
print(f"  Max latitude:  {bounds[3]:.6f}")
