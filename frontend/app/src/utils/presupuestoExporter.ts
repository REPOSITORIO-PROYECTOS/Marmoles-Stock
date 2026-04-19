export interface DatosPresupuesto {
  id: string;
  nombreArchivo?: string;
  correlativoGlobal?: number | string;
  fecha: string;
  cliente: {
    nombre: string;
    dni_cuit: string; // Importante para facturación
    direccion: string;
    telefono: string;
    condicionIva: string; // Resp. Inscripto, Consumidor Final, etc.
  };
  empresa: {
    nombre: string;
    cuit: string;
    direccion: string;
    logoUrl?: string;
  };
  items: Array<{
    detalle: string; // Material + Lote
    medidas: string;
    cantidad: number;
    precioUnitario: number;
    total: number;
    cortes?: string; // Detalle de cortes: "2 cortes especiales"
    extras?: string; // Detalle de extras: "2 agujeros, borde pulido"
  }>;
  total: number;
  imagenPlano?: string;
  anexosImagenes?: string[];
  observaciones: string;
  linkUbicacion?: string;
  subtotalMateriales?: number;
  subtotalCortes?: number;
  subtotalExtras?: number;
  subtotalNeto?: number;
  ivaMonto?: number;
  totalFinal?: number;
  piezasDetalle?: Array<{ w: number; h: number; agujeros: number; label: string }>;
}

export function imprimirPresupuestoArgentino(datos: DatosPresupuesto) {
  const anexos: string[] = [];
  if (datos.imagenPlano) anexos.push(datos.imagenPlano);
  if (Array.isArray(datos.anexosImagenes) && datos.anexosImagenes.length > 0) anexos.push(...datos.anexosImagenes);

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>${datos.nombreArchivo || `Presupuesto ${datos.id}`}</title>
      <style>
        body { font-family: 'Arial', sans-serif; font-size: 12px; color: #333; margin: 0; padding: 40px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
        .empresa h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
        .empresa p { margin: 2px 0; color: #555; }
        .presupuesto-info { text-align: right; }
        .presupuesto-info h2 { margin: 0; font-size: 20px; background: #eee; padding: 5px 10px; display: inline-block; }
        
        .cliente-box { border: 1px solid #ddd; padding: 10px; border-radius: 4px; margin-bottom: 20px; background: #f9f9f9; }
        .cliente-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .label { font-weight: bold; color: #000; width: 100px; }
        .link-ubicacion { color: #2563eb; text-decoration: underline; font-size: 11px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #000; color: #fff; padding: 8px; text-align: left; text-transform: uppercase; font-size: 11px; }
        td { padding: 8px; border-bottom: 1px solid #ccc; }
        .right { text-align: right; }
        .total-row td { border: none; font-size: 14px; font-weight: bold; padding-top: 15px; }

        .plano-container { 
          border: 2px dashed #ccc; 
          padding: 10px; 
          text-align: center; 
          margin-bottom: 20px; 
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 500px;
        }
        .plano-img { max-width: 95%; max-height: 800px; object-fit: contain; }

        .legales { font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 40px; }
        .legales ul { padding-left: 15px; margin: 5px 0; }
        
        .firma-box { margin-top: 60px; display: flex; justify-content: space-between; }
        .firma { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; font-size: 11px; }

        .page-break { break-before: page; page-break-before: always; }
        .avoid-break { break-inside: avoid-page; page-break-inside: avoid; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="empresa">
          <h1>${datos.empresa.nombre}</h1>
        </div>
        <div class="presupuesto-info">
          <h2>PRESUPUESTO</h2>
          <p><strong>Nº:</strong> ${datos.id}</p>
          ${datos.correlativoGlobal ? `<p><strong>Correlativo:</strong> ${datos.correlativoGlobal}</p>` : ''}
          <p><strong>Fecha:</strong> ${datos.fecha}</p>
          <p><strong>Válido hasta:</strong> ${new Date(Date.now() + 2 * 86400000).toLocaleDateString()} (48 horas)</p>
        </div>
      </div>

      <div class="cliente-box">
        <div class="cliente-row">
          <div><span class="label">Señor/a:</span> ${datos.cliente.nombre}</div>
          <div></div>
        </div>
        <div class="cliente-row">
          <div><span class="label">Dirección:</span> ${datos.cliente.direccion || '-'}</div>
          <div><span class="label">Cond. IVA:</span> ${datos.cliente.condicionIva || 'Consumidor Final'}</div>
        </div>
        <div class="cliente-row">
          <div></div>
          ${datos.linkUbicacion ? `<div><a href="${datos.linkUbicacion}" target="_blank" class="link-ubicacion">Ver ubicación en mapa</a></div>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Descripción / Material</th>
            <th>Medidas</th>
            <th class="right">Cant/m²</th>
            <th class="right">Precio Unit.</th>
            <th class="right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${datos.items.map(item => `
            <tr>
              <td>
                <strong>${item.detalle}</strong>
                ${item.cortes ? `<br><small style="color: #666;">📐 Cortes: ${item.cortes}</small>` : ''}
                ${item.extras ? `<br><small style="color: #666;">⚙️ Extras: ${item.extras}</small>` : ''}
              </td>
              <td>${item.medidas}</td>
              <td class="right">${item.cantidad.toFixed(2)}</td>
              <td class="right">$${item.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
              <td class="right">$${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
          <tr>
            <td colspan="3"></td>
            <td class="right">Subtotal Materiales:</td>
            <td class="right">$${Number(datos.subtotalMateriales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td colspan="3"></td>
            <td class="right">Subtotal Neto:</td>
            <td class="right">$${Number(datos.subtotalNeto ?? datos.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td colspan="3"></td>
            <td class="right">IVA:</td>
            <td class="right">$${Number(datos.ivaMonto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr class="total-row">
            <td colspan="3"></td>
            <td class="right">TOTAL FINAL:</td>
            <td class="right"><strong>$${Number(datos.totalFinal ?? datos.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong></td>
          </tr>
        </tbody>
      </table>

      ${datos.observaciones ? `
        <div style="background:#eee; padding:10px; border-radius:4px; margin-bottom:20px;">
          <strong>Observaciones:</strong> ${datos.observaciones}
        </div>
      ` : ''}

      <div class="legales">
        <strong>TÉRMINOS Y CONDICIONES GENERALES:</strong>
        <ul>
          <li><strong>Validez de la oferta:</strong> 48 horas corridas a partir de la fecha, sujeto a disponibilidad de stock.</li>
          <li><strong>Forma de Pago:</strong> Seña del 30% al aceptar el presupuesto y cancelación total antes de la instalación.</li>
          <li><strong>Tiempos de Entrega:</strong> A confirmar al momento de la seña (aprox. 10-15 días hábiles).</li>
          <li>Los productos pueden presentar variaciones de tono y vetas que no constituyen defecto.</li>
          <li>El presente presupuesto no constituye factura fiscal.</li>
        </ul>
      </div>

      <div class="firma-box">
        <div class="firma">Firma y Aclaración Cliente<br>Acepto conformidad</div>
        <div class="firma">Por ${datos.empresa.nombre}</div>
      </div>

      <section class="page-break">
        <h3 style="font-size:16px; font-weight:bold; margin-bottom:10px;">ANEXO 1 - Detalle de Piezas y Aperturas</h3>
        ${datos.piezasDetalle && datos.piezasDetalle.length > 0 ? `
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background: #f0f0f0;">
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Pieza</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Largo (m)</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Ancho (m)</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Aperturas</th>
              </tr>
            </thead>
            <tbody>
              ${datos.piezasDetalle.map((pieza, idx) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;">Pieza ${idx + 1}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${(pieza.h / 100).toFixed(2)}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${(pieza.w / 100).toFixed(2)}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${pieza.agujeros > 0 ? `${pieza.agujeros} agujero${pieza.agujeros > 1 ? 's' : ''}` : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="color: #666; padding: 10px;">No hay piezas detalladas disponibles.</p>'}
      </section>

      ${anexos.length > 0 ? `
        <section class="page-break">
          <h3 style="font-size:16px; font-weight:bold; margin-bottom:10px;">ANEXO 2 - Planos de Corte</h3>
          ${anexos.map((src, idx) => {
    // Verificar si la imagen es válida (tiene datos)
    if (!src || src.length < 100) {
      return `
                <div class="plano-container avoid-break" style="background: #f5f5f5; border: 2px dashed #ccc;">
                  <p style="color: #999; font-size: 14px; margin: 0;">Plan ${idx + 1}: Imagen no disponible</p>
                </div>
              `;
    }
    return `
              <div class="plano-container avoid-break">
                <img src="${src}" class="plano-img" alt="Plano de Corte ${idx + 1}" />
              </div>
            `;
  }).join('')}
        </section>
      ` : `
        <section class="page-break">
          <h3 style="font-size:16px; font-weight:bold; margin-bottom:10px;">ANEXO 2 - Planos de Corte</h3>
          <div class="plano-container avoid-break" style="background: #f5f5f5; border: 2px dashed #ccc;">
            <p style="color: #666; font-size: 14px; margin: 0;">No hay planos disponibles</p>
          </div>
        </section>
      `}

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  const popup = window.open('', '_blank', 'width=900,height=1000');
  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }
}

export function imprimirAnexosPlano(clienteNombre: string, presupuestoId: string, anexosImagenes: string[]) {
  if (!anexosImagenes || anexosImagenes.length === 0) {
    console.warn('No hay planos/anexos para descargar');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Plano Técnico ${presupuestoId}</title>
      <style>
        body { font-family: 'Arial', sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
        .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { margin: 0 0 5px 0; font-size: 18px; text-transform: uppercase; }
        .header p { margin: 2px 0; color: #555; font-size: 11px; }
        
        .plano-container { 
          border: 1px solid #ddd; 
          padding: 15px; 
          text-align: center; 
          margin-bottom: 20px; 
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          break-inside: avoid-page;
          page-break-inside: avoid;
        }
        .plano-img { max-width: 95%; max-height: 800px; object-fit: contain; }

        .page-break { break-before: page; page-break-before: always; }
        .avoid-break { break-inside: avoid-page; page-break-inside: avoid; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>PLANO TÉCNICO</h1>
        <p><strong>Cliente:</strong> ${clienteNombre}</p>
        <p><strong>Presupuesto:</strong> ${presupuestoId}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
      </div>

      ${anexosImagenes.map((src, idx) => `
        ${idx > 0 ? '<div class="page-break"></div>' : ''}
        <div class="plano-container avoid-break">
          <img src="${src}" class="plano-img" alt="Plano Técnico ${idx + 1}" />
        </div>
      `).join('')}

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  const popup = window.open('', '_blank', 'width=900,height=1000');
  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }
}
