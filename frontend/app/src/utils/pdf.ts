export type EntregaLog = { timestamp: string; accion: string; usuario: string; detalles?: string };
export type ComprobanteEntregaArgs = {
  empresa: string;
  presupuesto: string;
  cliente: string;
  tipoCliente: 'constructor' | 'cliente_final';
  fechaEntrega: string;
  direccion?: string;
  firmaDataUrl?: string;
  nombreFirmante?: string;
  material?: string;
  piezas?: { x: number; y: number; w: number; h: number }[];
  logs?: EntregaLog[];
};

export function downloadComprobanteEntregaPDF(args: ComprobanteEntregaArgs) {
  const empresa = args.empresa || 'Empresa';
  const fechaStr = args.fechaEntrega;
  const piezasDetalle = (args.piezas || []).map((p, i) => `Pieza ${i + 1}: ${p.w}x${p.h} cm en (${p.x},${p.y})`);
  const html = `
    <html><head><title>Comprobante de Entrega</title><meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>body{font-family:Arial;padding:24px} h1{margin:0} .muted{color:#555} table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border:1px solid #ddd;padding:8px;text-align:left} .tag{display:inline-block;padding:4px 8px;border:1px solid #999;border-radius:4px;margin-right:8px}</style></head><body>
    <h1>${empresa}</h1>
    <p class="muted">Fecha de entrega: ${fechaStr}</p>
    <p>Presupuesto: ${args.presupuesto}</p>
    <p>Cliente: ${args.cliente}</p>
    <p>Tipo de cliente: ${args.tipoCliente === 'constructor' ? 'Retiro' : 'Cliente final'}</p>
    ${args.direccion ? `<p>Dirección: ${args.direccion}</p>` : ''}
    ${args.material ? `<p>Material: ${args.material}</p>` : ''}
    ${args.firmaDataUrl ? `<div style="margin-top:12px"><strong>Firma del receptor:</strong><br/><img src="${args.firmaDataUrl}" style="max-width:100%;border:1px solid #ddd;margin-top:6px"/></div>` : ''}
    ${args.nombreFirmante ? `<p>Firmado por: ${args.nombreFirmante}</p>` : ''}
    ${(args.logs || []).length ? `<div style="margin-top:12px"><strong>Historial:</strong><ul>${(args.logs || []).map(l => `<li>${l.timestamp} • ${l.usuario}: ${l.accion}${l.detalles ? ` — ${l.detalles}` : ''}</li>`).join('')}</ul></div>` : ''}
    ${(piezasDetalle || []).length ? `<div style="margin-top:12px"><strong>Piezas:</strong><ul>${piezasDetalle.map(d => `<li>${d}</li>`).join('')}</ul></div>` : ''}
    </body></html>`;
  const w = window.open('', '_blank', 'noopener');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
