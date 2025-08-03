export function renderCountyShape(coords) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "county-svg");
  svg.setAttribute("viewBox", "0 0 400 400");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";
  svg.style.marginBottom = "2rem";

  const lons = coords.map(([lon]) => lon);
  const lats = coords.map(([, lat]) => lat);
  const minX = Math.min(...lons);
  const maxX = Math.max(...lons);
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);

  const scale = 400 / Math.max(maxX - minX, maxY - minY);
  const offsetX = minX;
  const offsetY = minY;

  const projected = coords.map(([lon, lat]) => {
    const x = (lon - offsetX) * scale;
    const y = 400 - (lat - offsetY) * scale;
    return `${x},${y}`;
  });

  const pathData = `M${projected.join(" L")} Z`;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("fill", "#2e5d43");
  path.setAttribute("stroke", "none");

  svg.appendChild(path);

  const container = document.getElementById("county-svg-container");
  if (container) {
    container.innerHTML = "";
    container.appendChild(svg);
  } else {
    document.body.appendChild(svg);
  }
}
