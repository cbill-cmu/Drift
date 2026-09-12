import { useEffect, useMemo, useRef } from "react";
import { boundsFromNodes, project } from "../utils/projection.js";

function heatSources(graph) {
  const sources = [];
  for (const point of graph.heatpoints || []) {
    if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
      sources.push({
        lat: point.lat,
        lng: point.lng,
        weight: Math.max(0.4, Number(point.weight) || 1),
      });
    }
  }
  for (const node of graph.nodes || []) {
    if (Number.isFinite(node.lat) && Number.isFinite(node.lng)) {
      sources.push({
        lat: node.lat,
        lng: node.lng,
        weight: Math.max(0.6, (node.visits || 1) / 3),
      });
    }
  }
  return sources;
}

function colorizeHeat(image) {
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const intensity = data[i + 3] / 255;
    if (intensity < 0.03) {
      data[i + 3] = 0;
      continue;
    }
    let r;
    let g;
    let b;
    if (intensity < 0.33) {
      const t = intensity / 0.33;
      r = 254 + t * (253 - 254);
      g = 249 + t * (224 - 249);
      b = 195 + t * (71 - 195);
    } else if (intensity < 0.66) {
      const t = (intensity - 0.33) / 0.33;
      r = 253 + t * (234 - 253);
      g = 224 + t * (179 - 224);
      b = 71 + t * (8 - 71);
    } else {
      const t = (intensity - 0.66) / 0.34;
      r = 234 + t * (161 - 234);
      g = 179 + t * (98 - 179);
      b = 8 + t * (7 - 8);
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = Math.min(220, 70 + intensity * 150);
  }
}

export default function GraphMap({ graph, width, height, selectedNodeId, onSelectNode }) {
  const canvasRef = useRef(null);
  const bounds = useMemo(
    () => boundsFromNodes([...(graph?.nodes || []), ...(graph?.heatpoints || [])]),
    [graph]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph || width < 8 || height < 8) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#7dd3fc");
    sky.addColorStop(0.5, "#38bdf8");
    sky.addColorStop(1, "#fde047");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const sources = heatSources(graph);
    if (sources.length === 0) return;

    const layer = document.createElement("canvas");
    layer.width = Math.floor(width);
    layer.height = Math.floor(height);
    const heat = layer.getContext("2d");
    heat.clearRect(0, 0, layer.width, layer.height);
    heat.globalCompositeOperation = "lighter";

    const maxWeight = Math.max(...sources.map((s) => s.weight), 1);
    for (const source of sources) {
      const { x, y } = project(source.lat, source.lng, width, height, bounds);
      const t = source.weight / maxWeight;
      const radius = 28 + t * 56;
      const gradient = heat.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${0.12 + t * 0.72})`);
      gradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.05 + t * 0.28})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      heat.fillStyle = gradient;
      heat.beginPath();
      heat.arc(x, y, radius, 0, Math.PI * 2);
      heat.fill();
    }

    const image = heat.getImageData(0, 0, layer.width, layer.height);
    colorizeHeat(image);
    heat.putImageData(image, 0, 0);
    ctx.drawImage(layer, 0, 0, width, height);
  }, [graph, width, height, bounds]);

  if (!graph) return null;

  const labeled = [...(graph.nodes || [])]
    .filter((n) => Number.isFinite(n.lat) && Number.isFinite(n.lng))
    .sort((a, b) => (b.visits || 0) - (a.visits || 0))
    .slice(0, 14);

  return (
    <div className="graph-map" style={{ width, height }}>
      <canvas ref={canvasRef} className="graph-heat" style={{ width, height }} />
      <svg className="graph-svg" width={width} height={height}>
        {labeled.map((node) => {
          const { x, y } = project(node.lat, node.lng, width, height, bounds);
          const selected = node.id === selectedNodeId;
          return (
            <g
              key={node.id}
              className="graph-node-hit"
              onClick={() => onSelectNode?.(node)}
            >
              {selected ? (
                <circle cx={x} cy={y} r={10} className="heat-selected-ring" />
              ) : null}
              <text x={x + 8} y={y + 4} className="graph-label">
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
