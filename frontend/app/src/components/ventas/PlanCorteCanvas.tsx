import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Download } from 'lucide-react';

type Cut = { orientation: 'vertical' | 'horizontal'; x0: number; y0: number; x1: number; y1: number; bevel?: number };
type Placement = { x: number; y: number; w: number; h: number; trabajo_id?: string };
type Feature = { type: 'corner_cut' | 'hole' | 'note'; posicion?: 'tl' | 'tr' | 'bl' | 'br'; size_w?: number; size_h?: number; x?: number; y?: number; diametro?: number; text?: string };

interface PlanData {
  effective_board: { width: number; height: number };
  placements: Placement[];
  cuts: Cut[];
  used_area?: number;
  utilization?: number;
  material?: { id: string; nombre: string };
  piezas_origen?: { trabajo_id: string }[];
  features?: Feature[];
  retazos?: { x: number; y: number; w: number; h: number }[];
}

interface Props {
  plan: PlanData | null;
}

export function PlanCorteCanvas({ plan }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    if (!plan) return;

    const bw = plan.effective_board?.width || 0;
    const bh = plan.effective_board?.height || 0;
    const pad = 50; // Aumentado para dar espacio a las etiquetas
    const sx = (canvas.width - pad * 2) / (bw || 1);
    const sy = (canvas.height - pad * 2) / (bh || 1);
    const s = Math.min(sx, sy);

    // Dibujar etiquetas de dimensiones en los ejes
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';

    // Dimensión superior (ancho en cm)
    ctx.fillText(`${bw.toFixed(1)} cm`, pad + (bw * s) / 2, pad - 10);

    // Dimensión lateral (alto en cm)
    ctx.save();
    ctx.translate(pad - 15, pad + (bh * s) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${bh.toFixed(1)} cm`, 0, 0);
    ctx.restore();

    // Rectángulo de la plancha
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, pad, bw * s, bh * s);

    plan.placements?.forEach((p, idx) => {
      // Color strategy:
      // If trabajo_id exists, use it to generate a consistent hue, but vary lightness/saturation slightly by index
      // If not, use index based coloring
      if (p.trabajo_id) {
        let hash = 0;
        for (let i = 0; i < p.trabajo_id.length; i++) {
          hash = p.trabajo_id.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);
        // Vary lightness between 60% and 80% based on index to distinguish pieces of same job
        const lightness = 60 + (idx % 3) * 10;
        ctx.fillStyle = `hsl(${hue}, 70%, ${lightness}%)`;
      } else {
        ctx.fillStyle = `hsl(${(idx * 47) % 360} 70% 60%)`;
      }

      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1.5;
      ctx.fillRect(pad + p.x * s, pad + p.y * s, p.w * s, p.h * s);
      ctx.strokeRect(pad + p.x * s, pad + p.y * s, p.w * s, p.h * s);

      // Dibujar medidas en cm
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      const labelCM = `${p.w.toFixed(1)}x${p.h.toFixed(1)}`;
      // Solo dibujar si la pieza es lo suficientemente grande para el texto
      if (p.w * s > 40 && p.h * s > 20) {
        // Fondo blanco semitransparente para legibilidad
        const textWidth = ctx.measureText(labelCM).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(
          pad + (p.x + p.w / 2) * s - textWidth / 2 - 4,
          pad + (p.y + p.h / 2) * s - 10,
          textWidth + 8,
          20
        );

        ctx.fillStyle = '#000000';
        ctx.fillText(labelCM, pad + (p.x + p.w / 2) * s, pad + (p.y + p.h / 2) * s + 5);

        // Mostrar ID corto si hay espacio vertical
        if (p.trabajo_id && p.h * s > 50) {
          ctx.font = '10px Arial';
          ctx.fillText(p.trabajo_id.slice(0, 8), pad + (p.x + p.w / 2) * s, pad + (p.y + p.h / 2) * s + 18);
        }
      }
    });

    plan.cuts?.forEach(c => {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad + c.x0 * s, pad + c.y0 * s);
      ctx.lineTo(pad + c.x1 * s, pad + c.y1 * s);
      ctx.stroke();
    });

    plan.features?.forEach(f => {
      if (f.type === 'corner_cut' && f.posicion && f.size_w && f.size_h) {
        const pos = f.posicion;
        const x = pos.includes('r') ? bw - f.size_w : 0;
        const y = pos.includes('b') ? bh - f.size_h : 0;
        ctx.fillStyle = 'rgba(59,130,246,0.3)';
        ctx.fillRect(pad + x * s, pad + y * s, (f.size_w || 0) * s, (f.size_h || 0) * s);
      } else if (f.type === 'hole' && f.x != null && f.y != null && f.diametro) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pad + f.x * s, pad + f.y * s, (f.diametro / 2) * s, 0, Math.PI * 2);
        ctx.stroke();
      } else if (f.type === 'note' && f.text && f.x != null && f.y != null) {
        ctx.fillStyle = '#111827';
        ctx.font = '12px Arial';
        ctx.fillText(f.text, pad + f.x * s, pad + f.y * s);
      }
    });

    plan.retazos?.forEach(r => {
      ctx.fillStyle = 'rgba(107,114,128,0.35)';
      ctx.fillRect(pad + r.x * s, pad + r.y * s, r.w * s, r.h * s);
    });
  }, [plan]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'plan-corte.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Plan de Corte</CardTitle>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Descargar PNG
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
          <canvas ref={canvasRef} width={1200} height={700} className="w-full h-auto" />
        </div>
        {plan && (
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="bg-cyan-50 p-3 rounded-lg">
              <div className="text-xs text-cyan-600 font-bold uppercase">Dimensiones Plancha</div>
              <div className="text-lg font-black text-cyan-900">{plan.effective_board.width.toFixed(1)} x {plan.effective_board.height.toFixed(1)} cm</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-xs text-green-600 font-bold uppercase">Piezas Totales</div>
              <div className="text-lg font-black text-green-900">{plan.placements?.length || 0} unidades</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-xs text-purple-600 font-bold uppercase">Área Utilizada</div>
              <div className="text-lg font-black text-purple-900">{plan.utilization ? `${plan.utilization.toFixed(1)}%` : 'N/A'}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

