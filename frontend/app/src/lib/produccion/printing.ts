import { toast } from 'sonner';
import { post } from '../../api';
import type { Pieza, TrabajoPendiente } from './plan';

/**
 * Abre diálogo de impresión de etiqueta (usa el navegador)
 */
export const abrirImpresionEtiqueta = (trabajo: TrabajoPendiente, pieza: Pieza, idx: number) => {
  const etiquetaData = {
    id: trabajo.id,
    cliente: trabajo.cliente,
    material: trabajo.material,
    color: trabajo.color,
    medidas: `${pieza.h || pieza.largo}×${pieza.w || pieza.ancho} cm`,
    cantidad: pieza.qty || pieza.cantidad || 1,
    ubicacion: "A-01"
  };

  // Abrir ventana de impresión
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('No se pudo abrir ventana de impresión');
    return;
  }

  const html = generarHTMLEtiqueta(etiquetaData);
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
};

/**
 * Genera HTML para etiqueta térmica
 */
export const generarHTMLEtiqueta = (data: {
  id: string;
  cliente: string;
  material: string;
  color?: string;
  medidas: string;
  cantidad: number;
  ubicacion: string;
}) => `
    <html>
      <head>
        <title>Etiqueta - ${data.cliente}</title>
        <style>
          @page { size: 80mm 50mm; margin: 0; }
          @media print { body { margin: 0; } }
          body { font-family: Arial, sans-serif; margin: 0; padding: 6px; }
          .etiqueta {
            border: 2px solid #000;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            height: 100%;
            justify-content: space-between;
          }
          .header { text-align: center; font-weight: bold; font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 3px; }
          .field { font-size: 9px; line-height: 1.2; }
          .label { font-weight: bold; }
          .ubicacion { 
            background: #000; 
            color: #fff; 
            text-align: center; 
            font-size: 16px; 
            font-weight: bold;
            padding: 4px;
            border-radius: 3px;
          }
        </style>
      </head>
      <body>
        <div class="etiqueta">
          <div class="header">ETIQUETA DE CORTE</div>
          <div class="field"><span class="label">Cliente:</span> ${data.cliente}</div>
          <div class="field"><span class="label">Orden:</span> ${data.id}</div>
          <div class="field"><span class="label">Material:</span> ${data.material}</div>
          <div class="field"><span class="label">Medidas:</span> ${data.medidas} × ${data.cantidad}u</div>
          <div class="ubicacion">${data.ubicacion}</div>
        </div>
      </body>
    </html>
`;

/**
 * Imprime una etiqueta individual para una pieza
 */
export const imprimirEtiquetaPieza = (trabajo: TrabajoPendiente, pieza: Pieza, idx: number) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <html>
      <head>
        <title>Etiqueta - ${trabajo.cliente}</title>
        <style>
          @page { size: 80mm 50mm; margin: 0; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 6px; }
          .etiqueta {
            border: 1px solid #000;
            padding: 6px;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .title { font-size: 11px; font-weight: bold; }
          .field { font-size: 9px; line-height: 1.2; }
          .label { font-weight: bold; color: #111; }
          .row { display: flex; justify-content: space-between; gap: 6px; }
          .chip { border: 1px solid #000; padding: 1px 4px; font-size: 8px; }
          .checks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-top: 4px; }
          .check { display: flex; align-items: center; gap: 3px; font-size: 8px; }
          .box { width: 8px; height: 8px; border: 1px solid #000; }
        </style>
      </head>
      <body>
        <div class="etiqueta">
          <div class="title">ETIQUETA DE CORTE</div>
          <div class="field"><span class="label">Cliente:</span> ${trabajo.cliente}</div>
          <div class="row">
            <div class="field"><span class="label">Orden:</span> ${trabajo.id.slice(0, 8)}</div>
            <div class="chip">P${idx + 1}</div>
          </div>
          <div class="field"><span class="label">Material:</span> ${trabajo.material}</div>
          <div class="field"><span class="label">Medidas:</span> ${pieza.h || pieza.largo}×${pieza.w || pieza.ancho} cm · ${pieza.qty || pieza.cantidad} u</div>
          <div class="field"><span class="label">Color:</span> ${trabajo.color || 'N/A'}</div>
          <div class="checks">
            <div class="check"><div class="box"></div> Pulido</div>
            <div class="check"><div class="box"></div> Bordes</div>
            <div class="check"><div class="box"></div> Medidas</div>
            <div class="check"><div class="box"></div> Sin roturas</div>
            <div class="check"><div class="box"></div> Limpieza</div>
            <div class="check"><div class="box"></div> OK</div>
          </div>
        </div>
        <script>window.print(); window.close();</script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  toast.success('Imprimiendo etiqueta...');
};

/**
 * Genera e imprime un plan de corte detallado
 */
export const imprimirPlanDeCorte = async (trabajoIds: string[], grupoKey: string, materialId?: string) => {
  try {
    toast.loading('Generando plan de corte...');

    // Traer datos reales del plan desde el backend
    const planData = await post<any>('/api/produccion/planificar', {
      material_id: materialId || '',
      trabajo_ids: trabajoIds,
      width: 140,
      height: 280,
      kerf: 3
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('No se pudo abrir ventana de impresión');
      return;
    }

    // Generar tabla de trabajos y piezas
    const trabajosHtml = planData.trabajos?.map((trabajo: any, tIdx: number) => `
      <div style="page-break-inside: avoid; margin-bottom: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 4px;">
        <h4 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 2px solid #0066cc; padding-bottom: 8px;">
          <strong>${tIdx + 1}. ${trabajo.cliente}</strong> (${trabajo.piezas?.length || 0} piezas)
        </h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #f0f0f0; border-bottom: 2px solid #333;">
              <th style="padding: 6px; text-align: left; border-right: 1px solid #ccc;">Pieza</th>
              <th style="padding: 6px; text-align: center; border-right: 1px solid #ccc;">Largo (cm)</th>
              <th style="padding: 6px; text-align: center; border-right: 1px solid #ccc;">Ancho (cm)</th>
              <th style="padding: 6px; text-align: center; border-right: 1px solid #ccc;">Qty</th>
              <th style="padding: 6px; text-align: center;">Área m²</th>
            </tr>
          </thead>
          <tbody>
            ${trabajo.piezas?.map((pieza: any) => `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 6px; border-right: 1px solid #ccc;">${pieza.nombre}</td>
                <td style="padding: 6px; text-align: center; border-right: 1px solid #ccc;"><strong>${pieza.h}</strong></td>
                <td style="padding: 6px; text-align: center; border-right: 1px solid #ccc;"><strong>${pieza.w}</strong></td>
                <td style="padding: 6px; text-align: center; border-right: 1px solid #ccc;"><strong>${pieza.qty}</strong></td>
                <td style="padding: 6px; text-align: center;"><strong>${pieza.area_total?.toFixed(2)}</strong></td>
              </tr>
            `).join('') || '<tr><td colspan="5" style="padding: 6px; text-align: center; color: #999;">Sin piezas</td></tr>'}
          </tbody>
        </table>
      </div>
    `).join('') || '<p style="color: #999;">No hay trabajos para mostrar</p>';

    // HTML completo del plan
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Plano de Corte - ${grupoKey}</title>
        <style>
          @media print {
            @page { size: A4; margin: 0.5cm; }
            body { margin: 0; padding: 0; }
          }
          body { 
            font-family: 'Courier New', monospace; 
            margin: 20px; 
            padding: 0;
            background: #fff;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #000;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
          }
          .header p {
            margin: 5px 0;
            font-size: 12px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 11px;
          }
          .plano-container {
            border: 2px solid #333;
            padding: 20px;
            margin: 20px 0;
            page-break-inside: avoid;
            background: #f9f9f9;
          }
          .trabajos-section {
            margin: 20px 0;
            padding: 0;
            page-break-inside: avoid;
          }
          .trabajos-titulo {
            font-size: 14px;
            font-weight: bold;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 15px;
            text-align: center;
          }
          .cortes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin: 20px 0;
          }
          .corte-item {
            border: 1px solid #999;
            padding: 12px;
            background: white;
            break-inside: avoid;
            page-break-inside: avoid;
            font-size: 10px;
          }
          .corte-titulo {
            font-weight: bold;
            font-size: 11px;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .corte-medidas {
            font-size: 13px;
            font-weight: bold;
            color: #000;
            margin: 6px 0;
            text-align: center;
          }
          .corte-cantidad {
            font-size: 10px;
            text-align: center;
            color: #555;
            margin: 4px 0;
          }
          .corte-info {
            font-size: 9px;
            margin: 4px 0;
            padding: 3px;
            background: #efefef;
            border-radius: 2px;
          }
          .stats {
            display: flex;
            justify-content: space-around;
            margin: 15px 0;
            padding: 10px;
            background: #f0f0f0;
            border-radius: 4px;
            font-size: 11px;
          }
          .stat-item {
            text-align: center;
          }
          .stat-label {
            font-weight: bold;
            color: #333;
          }
          .stat-value {
            font-size: 16px;
            font-weight: bold;
            color: #0066cc;
          }
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 2px solid #000;
            text-align: center;
            font-size: 10px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PLAN DE CORTE DETALLADO</h1>
          <p>${grupoKey}</p>
          <div class="info-row">
            <span>Fecha: ${new Date().toLocaleDateString()}</span>
            <span>Hora: ${new Date().toLocaleTimeString()}</span>
          </div>
        </div>
        
        <div class="plano-container">
          <div class="stats">
            <div class="stat-item">
              <div class="stat-label">Utilización</div>
              <div class="stat-value">${planData.utilization ? Math.round(planData.utilization * 100) : 0}%</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Trabajos</div>
              <div class="stat-value">${planData.trabajos?.length || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Piezas Totales</div>
              <div class="stat-value">${planData.total_piezas || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Área Piezas</div>
              <div class="stat-value">${planData.total_area_m2 || 0}m²</div>
            </div>
          </div>
        </div>
        
        <div style="background: #e8f4f8; border: 2px solid #0066cc; padding: 20px; margin: 20px 0; border-radius: 8px; page-break-inside: avoid;">
          <h3 style="margin: 0 0 15px 0; font-size: 13px; color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">📐 INFORMACIÓN DE LA PLANCHA</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; font-size: 11px;">
            <div style="background: white; padding: 12px; border-radius: 4px; border-left: 4px solid #0066cc;">
              <div style="font-weight: bold; color: #333; margin-bottom: 5px;">Tamaño Estándar</div>
              <div style="font-size: 13px; color: #0066cc; font-weight: bold;">${planData.placa_largo_cm}cm × ${planData.placa_ancho_cm}cm</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 4px; border-left: 4px solid #0066cc;">
              <div style="font-weight: bold; color: #333; margin-bottom: 5px;">Área Total Plancha</div>
              <div style="font-size: 13px; color: #0066cc; font-weight: bold;">${planData.placa_area_m2}m²</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 4px; border-left: 4px solid #009933;">
              <div style="font-weight: bold; color: #333; margin-bottom: 5px;">Área Usada</div>
              <div style="font-size: 13px; color: #009933; font-weight: bold;">${planData.total_area_m2}m²</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 4px; border-left: 4px solid #ff6b6b;">
              <div style="font-weight: bold; color: #333; margin-bottom: 5px;">Área Disponible</div>
              <div style="font-size: 13px; color: #ff6b6b; font-weight: bold;">${planData.area_disponible_m2}m²</div>
            </div>
          </div>
          ${planData.placas_necesarias > 1 ? `
            <div style="margin-top: 15px; padding: 12px; background: #fff3cd; border-radius: 4px; border-left: 4px solid #ffc107;">
              <div style="font-weight: bold; color: #856404; font-size: 12px;">
                ⚠️ Placas Necesarias: <span style="color: #ff6b6b; font-size: 14px; font-weight: bold;">${planData.placas_necesarias}</span>
              </div>
              <div style="font-size: 10px; color: #856404; margin-top: 8px;">
                Se requieren <strong>${planData.placas_necesarias} planchas</strong> para procesar todas las piezas.
                Área total requerida: ${(planData.placa_area_m2 * planData.placas_necesarias).toFixed(2)}m²
              </div>
            </div>
          ` : ''}
        </div>
        
        <div class="trabajos-section">
          <div class="trabajos-titulo">DETALLE DE TRABAJOS Y PIEZAS</div>
          ${trabajosHtml}
        </div>
        
        ${planData.placements && planData.placements.length > 0 ? `
          <div class="plano-container" style="page-break-inside: avoid;">
            <h3 style="text-align: center; margin: 15px 0; font-size: 13px; border-bottom: 2px solid #000; padding-bottom: 10px;">MAPA VISUAL DE CORTE</h3>
            <div style="text-align: center; padding: 20px; background: white;">
              <canvas id="planCanvas" width="800" height="1600" style="border: 2px solid #000; max-width: 100%; height: auto;"></canvas>
            </div>
          </div>
          
          <div class="plano-container">
            <h3 style="text-align: center; margin: 15px 0; font-size: 13px; border-bottom: 2px solid #000; padding-bottom: 10px;">DISPOSICIÓN DE CORTES EN PLANCHA</h3>
            <div class="cortes-grid">
              ${planData.placements.map((placement: any, idx: number) => {
      const area_m2 = ((placement.w || 0) * (placement.h || 0)) / 10000;
      let descHtml = '';
      if (placement.descripcion) {
        descHtml = '<div class="corte-info"><strong>Desc:</strong> ' + placement.descripcion + '</div>';
      }
      if (placement.pieza_nombre) {
        descHtml += '<div class="corte-info"><strong>Pieza:</strong> ' + placement.pieza_nombre + '</div>';
      }
      return `
                  <div class="corte-item">
                    <div class="corte-titulo">Corte #${idx + 1}</div>
                    <div class="corte-medidas">${placement.h || placement.height}cm × ${placement.w || placement.width}cm</div>
                    <div class="corte-cantidad">Qty: ${placement.qty || placement.quantity || 1}</div>
                    <div class="corte-info"><strong>Área:</strong> ${area_m2.toFixed(3)}m²</div>
                    <div class="corte-info"><strong>Pos:</strong> (${placement.x || 0}, ${placement.y || 0})</div>
                    ${descHtml}
                  </div>
                `;
    }).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="footer">
          <p>Plan de corte generado automáticamente desde el sistema de producción</p>
          <p style="font-size: 9px; color: #999;">Información en tiempo real - Revisar todas las medidas antes de proceder al corte</p>
        </div>
        
        <script>
          // Dibujar mapa visual de corte
          const canvas = document.getElementById('planCanvas');
          if (canvas && ${planData.placements ? 'true' : 'false'}) {
            const ctx = canvas.getContext('2d');
            const ancho = ${planData.placa_ancho_cm || 140};
            const largo = ${planData.placa_largo_cm || 280};
            const scale = Math.min(canvas.width / ancho, canvas.height / largo);
            
            // Fondo
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Cuadrícula
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            for (let x = 0; x < canvas.width; x += 25 * scale) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, canvas.height); // línea vertical (largo)
              ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += 25 * scale) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(canvas.width, y); // línea horizontal (ancho)
              ctx.stroke();
            }
            
            // Borde de la plancha
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.strokeRect(0, 0, ancho * scale, largo * scale);
            
            // Dibujar piezas
            const placements = ${JSON.stringify(planData.placements || [])};
            placements.forEach((p, idx) => {
              const x = (p.x || 0) * scale;
              const y = (p.y || 0) * scale;
              const ancho = (p.w || p.width || 0) * scale;
              const largo = (p.h || p.height || 0) * scale;
              
              // Rectángulo de la pieza
              ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
              ctx.fillRect(x, y, ancho, largo);
              ctx.strokeStyle = '#2563eb';
              ctx.lineWidth = 2;
              ctx.strokeRect(x, y, ancho, largo);
              
              // Número
              ctx.fillStyle = '#1e40af';
              ctx.font = 'bold ' + Math.max(12, Math.min(ancho / 3, largo / 3, 24)) + 'px Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('#' + (idx + 1), x + ancho/2, y + largo/2);
              
              // Medidas
              if (ancho > 60 && largo > 40) {
                ctx.font = Math.max(8, Math.min(ancho / 8, largo / 5, 10)) + 'px Arial';
              ctx.fillText((p.h || p.height) + '×' + (p.w || p.width) + ' cm', x + ancho/2, y + largo/2 + 15);
              }
            });
          }
          
          setTimeout(() => { window.print(); }, 500);
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    toast.success('Plan de corte listo para imprimir con todos los detalles');

  } catch (error: any) {
    toast.error('Error al generar plan: ' + error.message);
    console.error(error);
  }
};
