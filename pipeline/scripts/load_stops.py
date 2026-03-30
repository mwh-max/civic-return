import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

stops = pd.read_csv("pipeline/data/raw/stops.txt")

gdf = gpd.GeoDataFrame(
    stops,
    geometry=[Point(lon, lat) for lon, lat in zip(stops["stop_lon"], stops["stop_lat"])],
    crs="EPSG:4326",
)

gdf.to_file("pipeline/data/processed/lextran_stops.geojson", driver="GeoJSON")

print(f"Loaded {len(gdf)} stops.")
