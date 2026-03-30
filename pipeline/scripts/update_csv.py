import pandas as pd

csv_path = "data/ky-greenspace-population.csv"
df = pd.read_csv(csv_path)

df.loc[df["county"] == "Fayette", "transit_accessible_sqft"] = 3308533

df.to_csv(csv_path, index=False)

print(df[df["county"] == "Fayette"].to_string(index=False))
