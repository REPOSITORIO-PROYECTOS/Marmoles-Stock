/**
 * @vitest-environment jsdom
 *
 * Presupuesto de demostración (datos inventados) para documentar y validar
 * el render HTML del plan «PDF Marmoles».
 *
 * Cómo se ve en A4 (lectura humana):
 * Fondo: PDF_MARMOLES.svg a tamaño 210mm×297mm, repetido en vertical (repeat-y) si el
 *        contenido supera una hoja. El texto va en .pdf-content-wrap (z-index 1) con
 *        márgenes que dejan libres las franjas ~95/842 y ~110/842 del dibujo.
 * ┌─ Lámina A4 (header del dibujo) ───────────────────────────────────────┐
 * │  Título PRESUPUESTO · CUIT · Número y fecha                            │
 * ├─ / cuerpo: cliente, tabla 13px, totales, términos, firmas            │
 * └─ pie del dibujo ──────────────────────────────────────────────────────┘
 */
import { describe, it, expect } from 'vitest';
import { buildPresupuestoArgentinoHtml, type DatosPresupuesto } from './presupuestoExporter';
import { PDF_MARMOLES_SVG_PUBLIC_PATH } from './pdfMarmolesLayout';

/** Presupuesto de ejemplo: cocina + mesada, con IVA 21% y totales cuadrados. */
export const datosPresupuestoDemo: DatosPresupuesto = {
  id: 'P00042',
  nombreArchivo: 'Presupuesto_Demo_Cocina_2026.pdf',
  correlativoGlobal: 42,
  fecha: '23/04/2026',
  cliente: {
    nombre: 'María Gómez',
    dni_cuit: '27-33445566-7',
    direccion: 'Mitre 450, Capital, San Juan',
    telefono: '264-155123456',
    condicionIva: 'Consumidor Final',
  },
  empresa: {
    nombre: 'MUNDO DI MARMI',
    cuit: '',
    direccion: '',
  },
  items: [
    {
      detalle: 'Mesada granito Negro Absoluto — lote 12A',
      medidas: 'Corte según plano',
      cantidad: 1,
      precioUnitario: 350000,
      total: 350000,
      pdfEsMaterialM2: true,
      pdfCantidadPiezas: 1,
      pdfMetrosCuadrados: 2.4,
      pdfMedida: '1,20 × 0,60 m',
    },
    {
      detalle: 'Zócalo y regrueso',
      medidas: 'A medida',
      cantidad: 1,
      precioUnitario: 48000,
      total: 48000,
      pdfEsMaterialM2: false,
      pdfMedida: '',
    },
  ],
  total: 480200,
  observaciones: '',
  subtotalNeto: 398000,
  ivaMonto: 82200,
  totalFinal: 480200,
  ivaTasaDisplayPct: 21,
  linkUbicacion: 'https://www.google.com/maps?q=-31.5375,-68.5364',
  condicionesComercialesHtml: `
    <div class="condiciones-comerciales">
      <strong>Condiciones comerciales</strong>
      <p class="condiciones-comerciales-line">50% al aceptar presupuesto, 50% al instalar. Incluye colocación en Capital.</p>
    </div>
  `.trim(),
};

describe('buildPresupuestoArgentinoHtml (demo PDF Marmoles)', () => {
  it('aplica el SVG completo como fondo A4 (body) y márgenes de contenido 95/842, 110/842', () => {
    const html = buildPresupuestoArgentinoHtml(datosPresupuestoDemo);

    expect(html).toContain('body.pdf-marmoles-doc');
    expect(html).toMatch(/background-size:\s*210mm\s+297mm/);
    expect(html).toContain('background-repeat: repeat-y');
    expect(html).toContain('--pdf-header-mm: calc(95 / 842 * 297mm)');
    expect(html).toContain('--pdf-footer-mm: calc(110 / 842 * 297mm)');
    expect(html).toContain(PDF_MARMOLES_SVG_PUBLIC_PATH);
  });

  it('incluye bloque de cabecera, cliente, ítems de ejemplo y totales con IVA 21%', () => {
    const html = buildPresupuestoArgentinoHtml(datosPresupuestoDemo);

    expect(html).toContain('PRESUPUESTO');
    expect(html).toContain('P00042');
    expect(html).toContain('María Gómez');
    expect(html).toContain('Mitre 450');
    expect(html).toContain('Mesada granito Negro Absoluto');
    expect(html).toContain('1,20 × 0,60 m');
    expect(html).toContain('Zócalo y regrueso');
    expect(html).toContain('IVA (21%)');
    expect(html).toMatch(/\$398\.?000,00/);
    expect(html).toMatch(/\$82\.?200,00/);
    expect(html).toMatch(/\$480\.?200,00/);
    expect(html).toContain('TOTAL:');
  });

  it('aplica tipografía 13px en celdas de ítems y en el total final (clases CSS)', () => {
    const html = buildPresupuestoArgentinoHtml(datosPresupuestoDemo);

    expect(html).toMatch(/\.cell-desc-clean\s*\{[^}]*font-size:\s*13px/);
    expect(html).toMatch(/\.totals-foot \.total-final\s*\{[^}]*font-size:\s*13px/);
  });

  it('incluye condiciones comerciales y términos; link a mapa si hay linkUbicación', () => {
    const html = buildPresupuestoArgentinoHtml(datosPresupuestoDemo);

    expect(html).toContain('Condiciones comerciales');
    expect(html).toContain('TÉRMINOS Y CONDICIONES GENERALES');
    expect(html).toContain('Ver en mapa');
  });
});
