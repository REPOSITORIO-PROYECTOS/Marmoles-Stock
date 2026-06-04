import { useEffect, useRef, useState } from 'react';

export interface PlanoRectNorm {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  largoMm: number;
  anchoMm: number;
  onMedidasChange?: (largo: number, ancho: number) => void;
  onPlanoChange?: (data: { rect_norm: PlanoRectNorm } | null) => void;
}

const PAD = 24;
const CANVAS_W = 420;
const CANVAS_H = 220;

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  largo: number,
  ancho: number,
) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const availW = CANVAS_W - PAD * 2;
  const availH = CANVAS_H - PAD * 2;
  const scale = Math.min(availW / largo, availH / ancho);
  const rw = largo * scale;
  const rh = ancho * scale;
  const rx = PAD + (availW - rw) / 2;
  const ry = PAD + (availH - rh) / 2;

  // Fondo piedra
  ctx.fillStyle = '#f5f0e8';
  ctx.strokeStyle = '#9c8c7a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, 4);
  ctx.fill();
  ctx.stroke();

  // Líneas de medida — largo (horizontal)
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(rx, ry - 12);
  ctx.lineTo(rx + rw, ry - 12);
  ctx.stroke();
  ctx.setLineDash([]);
  // flechas
  for (const [x, dir] of [[rx, 1], [rx + rw, -1]] as [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(x, ry - 12);
    ctx.lineTo(x + dir * 6, ry - 16);
    ctx.lineTo(x + dir * 6, ry - 8);
    ctx.closePath();
    ctx.fillStyle = '#6366f1';
    ctx.fill();
  }
  ctx.fillStyle = '#4f46e5';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(`${largo} mm`, rx + rw / 2, ry - 16);

  // Líneas de medida — ancho (vertical)
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(rx - 12, ry);
  ctx.lineTo(rx - 12, ry + rh);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [y, dir] of [[ry, 1], [ry + rh, -1]] as [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(rx - 12, y);
    ctx.lineTo(rx - 16, y + dir * 6);
    ctx.lineTo(rx - 8, y + dir * 6);
    ctx.closePath();
    ctx.fillStyle = '#8b5cf6';
    ctx.fill();
  }
  ctx.save();
  ctx.translate(rx - 20, ry + rh / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#7c3aed';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(`${ancho} mm`, 0, 0);
  ctx.restore();

  // m²
  const m2 = ((largo / 1000) * (ancho / 1000)).toFixed(3);
  ctx.fillStyle = '#64748b';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(`${m2} m²`, rx + rw / 2, ry + rh / 2);
}

export function RetazoMicroPlanoCanvas({
  largoMm,
  anchoMm,
  onMedidasChange,
  onPlanoChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [largo, setLargo] = useState(largoMm);
  const [ancho, setAncho] = useState(anchoMm);

  // Sincronizar props externas
  useEffect(() => { setLargo(largoMm); }, [largoMm]);
  useEffect(() => { setAncho(anchoMm); }, [anchoMm]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawCanvas(ctx, largo, ancho);

    onPlanoChange?.({
      rect_norm: { x: 0, y: 0, w: largo, h: ancho },
    });
  }, [largo, ancho]);

  const handleLargo = (v: string) => {
    const n = Math.max(1, parseInt(v) || 0);
    setLargo(n);
    onMedidasChange?.(n, ancho);
  };

  const handleAncho = (v: string) => {
    const n = Math.max(1, parseInt(v) || 0);
    setAncho(n);
    onMedidasChange?.(largo, n);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full border border-gray-200 rounded-lg bg-white"
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Largo (mm)</label>
          <input
            type="number"
            min={1}
            value={largo}
            onChange={e => handleLargo(e.target.value)}
            className="w-full border rounded-md px-2 py-1 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Ancho (mm)</label>
          <input
            type="number"
            min={1}
            value={ancho}
            onChange={e => handleAncho(e.target.value)}
            className="w-full border rounded-md px-2 py-1 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
