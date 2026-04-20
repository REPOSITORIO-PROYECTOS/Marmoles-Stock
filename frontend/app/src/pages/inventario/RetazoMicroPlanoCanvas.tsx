import { useCallback, useEffect, useRef, useState } from 'react';

const CW = 400;
const CH = 260;

export interface PlanoRectNorm {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RetazoMicroPlanoCanvasProps {
  largoMm: number;
  anchoMm: number;
  onMedidasChange: (largoMm: number, anchoMm: number) => void;
  onPlanoChange?: (detail: { largo_mm: number; ancho_mm: number; rect_norm: PlanoRectNorm } | null) => void;
}

function clampMm(n: number, max: number): number {
  return Math.max(50, Math.min(max, Math.round(n)));
}

export function RetazoMicroPlanoCanvas({
  largoMm,
  anchoMm,
  onMedidasChange,
  onPlanoChange,
}: RetazoMicroPlanoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const scalePxPerMm = useCallback(() => {
    const L = Math.max(largoMm || 800, 300);
    const W = Math.max(anchoMm || 400, 300);
    return (Math.min(CW, CH) * 0.82) / Math.max(L, W);
  }, [largoMm, anchoMm]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = c.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(0.5, 0.5, CW - 1, CH - 1);

    const s = scalePxPerMm();
    const lm = Math.max(largoMm, 50);
    const wm = Math.max(anchoMm, 50);
    const rw = lm * s;
    const rh = wm * s;
    const ox = (CW - rw) / 2;
    const oy = (CH - rh) / 2;
    ctx.fillStyle = '#e0f2fe';
    ctx.strokeStyle = '#0369a1';
    ctx.lineWidth = 2;
    ctx.fillRect(ox, oy, rw, rh);
    ctx.strokeRect(ox, oy, rw, rh);
    ctx.fillStyle = '#0f172a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${lm} × ${wm} mm`, ox + 8, oy + 18);

    if (drag) {
      const x = Math.min(drag.x0, drag.x1);
      const y = Math.min(drag.y0, drag.y1);
      const w = Math.abs(drag.x1 - drag.x0);
      const h = Math.abs(drag.y1 - drag.y0);
      ctx.strokeStyle = '#c026d3';
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [largoMm, anchoMm, scalePxPerMm, drag]);

  useEffect(() => {
    draw();
  }, [draw]);

  const clientToCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CW;
    const y = ((e.clientY - rect.top) / rect.height) * CH;
    return { x, y };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = clientToCanvas(e);
    setDrag({ x0: x, y0: y, x1: x, y1: y });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const { x, y } = clientToCanvas(e);
    setDrag({ ...drag, x1: x, y1: y });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const { x, y } = clientToCanvas(e);
    const x0 = drag.x0;
    const y0 = drag.y0;
    const wPx = Math.abs(x - x0);
    const hPx = Math.abs(y - y0);
    setDrag(null);
    if (wPx < 10 || hPx < 10) {
      onPlanoChange?.(null);
      return;
    }
    const s = scalePxPerMm();
    const nL = clampMm(wPx / s, 6500);
    const nW = clampMm(hPx / s, 3500);
    onMedidasChange(nL, nW);
    const rx = Math.min(x0, x) / CW;
    const ry = Math.min(y0, y) / CH;
    const rw = wPx / CW;
    const rh = hPx / CH;
    onPlanoChange?.({
      largo_mm: nL,
      ancho_mm: nW,
      rect_norm: { x: rx, y: ry, w: rw, h: rh },
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Arrastrá un rectángulo sobre el lienzo para ajustar largo y ancho en mm (vista aproximada, sin escala CAD).
      </p>
      <canvas
        ref={canvasRef}
        width={CW}
        height={CH}
        className="w-full max-w-[400px] border rounded-md bg-slate-50 touch-none cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
      />
    </div>
  );
}
