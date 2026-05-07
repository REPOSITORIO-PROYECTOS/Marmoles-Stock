import { useEffect, useMemo, useRef, useState } from "react";

type Pieza = { ancho: number; largo: number; cantidad: number; descripcion?: string };
type Placement = { x: number; y: number; w: number; h: number; rotado: boolean; pieza: Pieza };

type Strategy = "bestfit" | "shelf";

function expandPieces(piezas: Pieza[]): Array<Pieza & { area: number }> {
  const out: Array<Pieza & { area: number }> = [];
  for (const p of piezas) {
    const area = p.ancho * p.largo;
    for (let i = 0; i < (p.cantidad || 1); i++) {
      out.push({ ...p, cantidad: 1, area });
    }
  }
  return out.sort((a, b) => b.area - a.area);
}

export function packBestFit(width: number, height: number, piezas: Pieza[]): Placement[] {
  const placements: Placement[] = [];
  let spaces: Array<{ x: number; y: number; w: number; h: number }> = [{ x: 0, y: 0, w: width, h: height }];
  const items = expandPieces(piezas);
  for (const item of items) {
    let bestIdx = -1;
    let bestRot = false;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < spaces.length; i++) {
      const s = spaces[i];
      // normal
      if (item.ancho <= s.w && item.largo <= s.h) {
        const sobrante1 = (s.w - item.ancho) * item.largo;
        const sobrante2 = s.w * (s.h - item.largo);
        const score = Math.min(sobrante1, sobrante2);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
          bestRot = false;
        }
      }
      // rotado
      if (item.largo <= s.w && item.ancho <= s.h) {
        const sobrante1 = (s.w - item.largo) * item.ancho;
        const sobrante2 = s.w * (s.h - item.ancho);
        const score = Math.min(sobrante1, sobrante2);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
          bestRot = true;
        }
      }
    }
    if (bestIdx >= 0) {
      const s = spaces[bestIdx];
      const w = bestRot ? item.largo : item.ancho;
      const h = bestRot ? item.ancho : item.largo;
      placements.push({ x: s.x, y: s.y, w, h, rotado: bestRot, pieza: item });
      // split spaces guillotine
      const right = { x: s.x + w, y: s.y, w: Math.max(0, s.w - w), h: h };
      const bottom = { x: s.x, y: s.y + h, w: s.w, h: Math.max(0, s.h - h) };
      spaces.splice(bestIdx, 1);
      // keep only non-zero spaces
      spaces = spaces
        .concat([right, bottom])
        .filter((sp) => sp.w > 0 && sp.h > 0)
        .sort((a, b) => b.w * b.h - a.w * a.h);
    }
  }
  return placements;
}

export function packShelf(width: number, height: number, piezas: Pieza[]): Placement[] {
  const placements: Placement[] = [];
  const items = expandPieces(piezas);
  let x = 0, y = 0, rowH = 0;

  for (const item of items) {
    let w = item.ancho;
    let h = item.largo;
    let rotado = false;

    // Intentar colocar horizontal primero
    if (x + w > width) {
      // Si no cabe, intentar rotar
      if (x + h <= width && y + w <= height) {
        [w, h] = [h, w];
        rotado = true;
      } else {
        // Nueva fila
        x = 0;
        y += rowH;
        rowH = 0;

        // Verificar si cabe en nueva fila
        if (x + w > width && h <= width) {
          [w, h] = [h, w];
          rotado = true;
        }
      }
    }

    if (y + h > height) {
      break; // No cabe más
    }

    placements.push({ x, y, w, h, rotado, pieza: item });
    x += w;
    rowH = Math.max(rowH, h);
  }
  return placements;
}

export function PlanchaMapa({
  width,
  height,
  piezas,
  strategy,
  placements: externalPlacements,
}: {
  width: number;
  height: number;
  piezas: Pieza[];
  strategy: Strategy;
  placements?: Placement[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      ro.observe(el);
    }
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      if (ro) ro.disconnect();
    };
  }, []);
  const placements = useMemo(() => {
    if (externalPlacements) return externalPlacements;
    return strategy === "bestfit" ? packBestFit(width, height, piezas) : packShelf(width, height, piezas);
  }, [width, height, piezas, strategy, externalPlacements]);

  const usedArea = placements.reduce((s, p) => s + p.w * p.h, 0);
  const utilization = usedArea / (width * height);

  const maxVisualHeight = typeof window !== "undefined" ? Math.round(window.innerHeight * 0.7) : 600;
  const scale = Math.min(containerWidth / width, maxVisualHeight / height);
  const displayW = Math.round(width * scale);
  const displayH = Math.round(height * scale);

  const groupedByDescription = useMemo(() => {
    const grouped: Record<string, Placement[]> = {};
    for (const p of placements) {
      const desc = p.pieza.descripcion || "Sin descripcion";
      if (!grouped[desc]) grouped[desc] = [];
      grouped[desc].push(p);
    }
    return grouped;
  }, [placements]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6 p-3 bg-white border rounded-lg shadow-sm">
        <div className="text-sm">
          <span className="text-gray-500 uppercase text-[10px] font-bold block">Dimensiones</span>
          <strong>{width} × {height} cm</strong>
        </div>
        <div className="text-sm">
          <span className="text-gray-500 uppercase text-[10px] font-bold block">Utilizacion</span>
          <strong className={utilization > 0.8 ? "text-green-600" : "text-orange-600"}>
            {(utilization * 100).toFixed(2)}%
          </strong>
        </div>
        <div className="text-sm">
          <span className="text-gray-500 uppercase text-[10px] font-bold block">Desperdicio</span>
          <strong>{Math.round((1 - utilization) * 100)}%</strong>
        </div>
      </div>
      <div ref={containerRef} className="w-full flex justify-center bg-gray-100 p-4 rounded-xl">
        <div
          className="relative border-4 border-gray-300 shadow-2xl bg-white"
          style={{
            width: displayW,
            height: displayH,
            backgroundImage:
              "linear-gradient(#f0f0f0 1px, transparent 1px), linear-gradient(90deg, #f0f0f0 1px, transparent 1px)",
            backgroundSize: `${Math.max(8, Math.round(scale * 10))}px ${Math.max(8, Math.round(scale * 10))}px`,
          }}
        >
          {placements.map((p, idx) => (
            <div
              key={idx}
              className="absolute border border-blue-700 bg-blue-500/20 hover:bg-blue-500/40 transition-colors flex items-center justify-center overflow-hidden"
              style={{
                left: Math.round(p.x * scale),
                top: Math.round(p.y * scale),
                width: Math.round(p.w * scale),
                height: Math.round(p.h * scale),
              }}
              title={`#${idx + 1}: ${p.pieza.descripcion || "Pieza"} - ${p.w}×${p.h} cm ${p.rotado ? "(Rotada)" : ""}`}
            >
              <div className="text-center p-1">
                <div className="font-black text-blue-900 leading-none" style={{ fontSize: Math.max(8, Math.min(p.w * scale / 3, 14)) + 'px' }}>
                  #{idx + 1}
                </div>
                {p.w * scale > 40 && (
                  <div className="text-[8px] font-bold text-blue-800 opacity-80 uppercase truncate px-1">
                    {p.pieza.descripcion || "Pieza"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {placements.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(groupedByDescription).map(([desc, items]) => (
            <div key={desc} className="border rounded-lg p-3 bg-white shadow-sm">
              <h4 className="font-bold text-gray-800 border-b pb-2 mb-2 flex justify-between">
                <span>{desc}</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">{items.length} piezas</span>
              </h4>
              <div className="space-y-1">
                {items.map((p, idx) => {
                  const originalIndex = placements.indexOf(p) + 1;
                  return (
                    <div key={idx} className="flex justify-between text-sm text-gray-600">
                      <span><strong className="text-blue-600">#{originalIndex}</strong> {p.w}x{p.h} cm</span>
                      {p.rotado && <span className="text-[10px] bg-orange-100 text-orange-600 px-1 rounded">ROTADO</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


