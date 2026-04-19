import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export type PresupuestoLinea = { material: string; medidas: string; m2: number; precio: number; subtotal: number };
export type PresupuestoArgs = {
  empresa: string;
  clienteNombre?: string;
  material?: string;
  imagenDataUrl?: string;
  lineas: PresupuestoLinea[];
  adicionales: { concepto: string; monto: number }[];
  precioPorCorte?: number;
  cortes: { cantidad: number; detalle: string }[];
  piezas: { x: number; y: number; w: number; h: number }[];
  subtotalNeto?: number;
  ivaMonto?: number;
  totalFinal?: number;
  vencimientoDias?: number;
};

function generatePresupuestoHTML(args: PresupuestoArgs): string {
  const empresa = args.empresa || 'Empresa';
  const hoy = new Date();
  const venc = new Date(hoy.getTime() + (args.vencimientoDias ?? 15) * 24 * 60 * 60 * 1000);
  const fechaStr = `${hoy.toLocaleDateString()}`;
  const vencStr = `${venc.toLocaleDateString()}`;
  const imgData = args.imagenDataUrl || '';
  const cortesCount = (args.cortes || []).reduce((s, c) => s + (c.cantidad || 0), 0);
  const totalAdic = (args.adicionales || []).reduce((s, a) => s + (a.monto || 0), 0) + (args.precioPorCorte || 0) * cortesCount;
  const totalLineas = (args.lineas || []).reduce((s, r) => s + (r.subtotal || 0), 0);
  const total = totalLineas + totalAdic;
  const subtotalNeto = Number(args.subtotalNeto ?? total);
  const ivaMonto = Number(args.ivaMonto ?? 0);
  const totalFinal = Number(args.totalFinal ?? (subtotalNeto + ivaMonto));
  const piezasDetalle = (args.piezas || []).map((p, i) => `Pieza ${i + 1}: ${p.w}x${p.h} cm en (${p.x},${p.y})`);
  const cortesDetalle = (args.cortes || []).map((c, i) => `Corte ${i + 1}: ${c.cantidad} • ${c.detalle}`);

  return `
    <div style="font-family: Arial, sans-serif; padding: 0; color: #333; max-width: 800px; margin: 0 auto; background: white;">
      <div style="padding: 24px;">
      <div style="margin-bottom: 24px;">
        <h1 style="margin: 0 0 8px; color: #000; font-size: 24px;">Mundo di Marmi</h1>
      </div>

      <div style="margin-bottom: 24px; padding: 12px; background: #f9f9f9; border-left: 4px solid #333;">
        <p style="margin: 4px 0; color: #666; font-size: 13px;">Fecha: ${fechaStr} • Vencimiento: ${vencStr}</p>
        <p style="margin: 4px 0; font-size: 13px;">Cliente: ${args.clienteNombre || '-'}</p>
        <p style="margin: 4px 0; font-size: 13px;">Material: ${args.material || '-'}</p>
      </div>
      
      ${imgData ? `<div style="margin-bottom: 24px; border: 1px solid #ddd;"><img src="${imgData}" style="max-width: 100%; display: block;" /></div>` : ''}
      
      <h2 style="font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #eee; padding-bottom: 8px;">Presupuesto</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
        <thead>
          <tr style="background: #f9f9f9;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Material</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Medidas</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">m²</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Precio/m²</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${(args.lineas || []).map(r => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${r.material}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${r.medidas}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${(r.m2 || 0).toFixed(3)}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${r.precio.toLocaleString()}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${r.subtotal.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="padding: 8px; border: 1px solid #ddd; text-align: right;">Adicionales</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${totalAdic.toLocaleString()}</td>
          </tr>
          <tr>
            <td colspan="4" style="padding: 8px; border: 1px solid #ddd; text-align: right;">Subtotal Neto</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">$${subtotalNeto.toLocaleString()}</td>
          </tr>
          <tr>
            <td colspan="4" style="padding: 8px; border: 1px solid #ddd; text-align: right;">IVA 21% + IVA</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">-</td>
          </tr>
          <tr>
            <td colspan="4" style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Total Final + IVA</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">$${totalFinal.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-bottom: 24px; font-size: 14px;">
        <div style="display: inline-block; padding: 4px 8px; border: 1px solid #999; border-radius: 4px; margin-right: 8px; font-size: 12px;">
          Cortes (manual): ${cortesCount}
        </div>
        ${cortesDetalle.length ? `<div style="margin-top: 12px;"><strong>Detalle de cortes:</strong><ul style="margin: 4px 0; padding-left: 20px;">${cortesDetalle.map(d => `<li>${d}</li>`).join('')}</ul></div>` : ''}
        ${(args.adicionales || []).length ? `<div style="margin-top: 12px;"><strong>Adicionales:</strong><ul style="margin: 4px 0; padding-left: 20px;">${args.adicionales.map(a => `<li>${a.concepto}: $${(a.monto || 0).toLocaleString()}</li>`).join('')}</ul></div>` : ''}
      </div>

      <div style="page-break-before: always; margin-top: 32px;">
        <h2 style="font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #eee; padding-bottom: 8px;">Piezas y medidas</h2>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
          ${piezasDetalle.map(d => `<li style="margin-bottom: 4px;">${d}</li>`).join('')}
        </ul>
      </div>

      <div style="page-break-before: always; padding-top: 32px;">
        <h2 style="font-size: 16px; margin-bottom: 12px; border-bottom: 2px solid #eee; padding-bottom: 8px;">TÉRMINOS Y CONDICIONES GENERALES</h2>
        
        <div style="font-size: 13px; line-height: 1.6;">
          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 8px; font-weight: bold;">Validez de la oferta:</p>
            <p style="margin: 0;">48 horas corridas a partir de la fecha, sujeto a disponibilidad de stock.</p>
          </div>

          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 8px; font-weight: bold;">Forma de Pago:</p>
            <p style="margin: 0;">Seña del 30% al aceptar el presupuesto y cancelación total antes de la instalación.</p>
          </div>

          <div style="margin-bottom: 16px;">
            <p style="margin: 0 0 8px; font-weight: bold;">Tiempos de Entrega:</p>
            <p style="margin: 0;">A confirmar al momento de la seña (aprox. 10-15 días hábiles).</p>
          </div>

          <div style="margin-bottom: 16px; padding: 12px; background: #f9f9f9; border-left: 2px solid #999;">
            <p style="margin: 0; font-size: 12px;">Los productos pueden presentar variaciones de tono y vetas que no constituyen defecto.</p>
            <p style="margin: 8px 0 0; font-size: 12px;">El presente presupuesto no constituye factura fiscal.</p>
          </div>
        </div>
      </div>

      <div style="page-break-before: always; padding-top: 32px;">
        <div style="border: 2px dashed #ccc; padding: 24px;">
          <h2 style="text-align: center; margin: 0 0 16px; font-size: 20px;">RECIBO / COMPROBANTE DE ACEPTACIÓN</h2>
          <div style="display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 14px;">
            <div>
              <p style="margin: 4px 0;"><strong>Fecha:</strong> ${fechaStr}</p>
              <p style="margin: 4px 0;"><strong>Cliente:</strong> ${args.clienteNombre || '-'}</p>
            </div>
            <div>
              <p style="margin: 4px 0;"><strong>Total Presupuestado:</strong> $${totalFinal.toLocaleString()}</p>
            </div>
          </div>
          <p style="margin-bottom: 32px; font-size: 14px; line-height: 1.5;">
            Por la presente acepto el presupuesto detallado anteriormente y autorizo el inicio de los trabajos / servicios.
            Entiendo que los tiempos de entrega son estimados y están sujetos a disponibilidad de material.
          </p>
          
          <div style="display: flex; justify-content: space-between; margin-top: 80px;">
            <div style="text-align: center; width: 40%; border-top: 1px solid #000; padding-top: 8px; font-size: 14px;">
              Firma del Cliente
            </div>
            <div style="text-align: center; width: 40%; border-top: 1px solid #000; padding-top: 8px; font-size: 14px;">
              Aclaración / DNI
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  `;
}

export async function generatePresupuestoPDFBlob(args: PresupuestoArgs): Promise<Blob> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.innerHTML = generatePresupuestoHTML(args);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'cm',
      format: 'a4'
    });

    const imgWidth = 210; // A4 width in cm
    const pageHeight = 297; // A4 height in cm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

export function downloadPresupuestoPDF(args: PresupuestoArgs) {
  // Legacy print method
  const html = `<html><head><title>Presupuesto</title></head><body>${generatePresupuestoHTML(args)}</body></html>`;
  const w = window.open('', '_blank', 'noopener');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

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
