export type Cut = { orientation: 'vertical' | 'horizontal'; x0: number; y0: number; x1: number; y1: number; bevel?: number };
export type Placement = { x: number; y: number; w: number; h: number; trabajo_id?: string };
export type Feature = { type: 'corner_cut' | 'hole' | 'note'; posicion?: 'tl' | 'tr' | 'bl' | 'br'; size_w?: number; size_h?: number; x?: number; y?: number; diametro?: number; text?: string };
export interface PlanData {
  effective_board: { width: number; height: number };
  placements: Placement[];
  cuts: Cut[];
  features?: Feature[];
}

export function generatePlanImage(plan: PlanData, width = 1000, height = 600): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

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

    const bw = plan.effective_board?.width || 300;
    const bh = plan.effective_board?.height || 180;
    const pad = 30;
    const sx = (canvas.width - pad * 2) / (bw || 1);
    const sy = (canvas.height - pad * 2) / (bh || 1);
    const s = Math.min(sx, sy);

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, pad, bw * s, bh * s);

    // Mostrar dimensiones del tablero
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    // Ancho superior
    ctx.fillText(`${bw} cm`, pad + (bw * s) / 2, pad - 10);
    // Alto lateral
    ctx.save();
    ctx.translate(pad - 15, pad + (bh * s) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${bh} cm`, 0, 0);
    ctx.restore();

    // Mostrar placements
    plan.placements?.forEach((p, idx) => {
      ctx.fillStyle = `hsl(${(idx * 47) % 360} 70% 60%)`;
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1.5;
      ctx.fillRect(pad + p.x * s, pad + p.y * s, p.w * s, p.h * s);
      ctx.strokeRect(pad + p.x * s, pad + p.y * s, p.w * s, p.h * s);

      // Mostrar etiqueta con medidas - siempre visible
      const labelText = `${p.w}x${p.h}`;
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const centerX = pad + (p.x + p.w / 2) * s;
      const centerY = pad + (p.y + p.h / 2) * s;

      // Si el rectángulo es lo suficientemente grande, mostrar adentro
      if (p.w * s > 40 && p.h * s > 20) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(labelText, centerX, centerY);
      } else {
        // Si es pequeño, mostrar afuera con un fondo
        const textWidth = ctx.measureText(labelText).width + 8;
        const labelX = centerX;
        const labelY = pad + p.y * s - 15;

        ctx.fillStyle = '#374151';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(labelX - textWidth / 2, labelY - 10, textWidth, 20);
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(labelText, labelX, labelY);
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

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating plan image:', error);
    return '';
  }
}
